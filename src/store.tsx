import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { produce, type Draft } from 'immer';
import { get, getMany, setMany, update as idbUpdate } from 'idb-keyval';
import { merge3 } from './merge';
import type { Library, Story } from './types';
import { emptyLibrary, normalizeLibrary, TRASH_DAYS } from './defaults';
import { docId } from './sync/engine';

const KEY = 'writers-oatmeal-library';

type LibUpdater = (d: Draft<Library>) => void;
export type StoryUpdater = (fn: (s: Draft<Story>) => void) => void;

interface Ctx {
  lib: Library;
  update: (fn: LibUpdater) => void;
  replace: (lib: Library) => void;
  /** For sync: replaces the library without recording deletions as local edits. */
  applyRemote: (fn: (l: Library) => Library) => void;
  saveState: 'saved' | 'saving' | 'error';
  /** Writes everything to storage right now (e.g. before leaving the site). */
  saveNow: () => Promise<void>;
}

const LibraryContext = createContext<Ctx | null>(null);

/**
 * Runs after every local edit: stamps updatedAt on whatever story/universe
 * actually changed, and records deletions so they sync to other devices.
 */
function stamp(prev: Library, next: Library): Library {
  const now = Date.now();
  const touched: [('stories' | 'universes' | 'chapters' | 'trash'), string][] = [];
  const removed: string[] = [];
  for (const [key, kind] of [['stories', 'story'], ['universes', 'universe'], ['chapters', 'chapter'], ['trash', 'trash']] as const) {
    const prevList: { id: string; updatedAt: number }[] = prev[key];
    const nextList: { id: string; updatedAt: number }[] = next[key];
    const before = new Map(prevList.map((x) => [x.id, x]));
    const ids = new Set(nextList.map((x) => x.id));
    for (const x of nextList) {
      const old = before.get(x.id);
      if (old && old !== x && old.updatedAt === x.updatedAt) touched.push([key, x.id]);
    }
    for (const x of prevList) if (!ids.has(x.id)) removed.push(docId(kind, x.id));
  }
  const titleChanged = prev.siteTitle !== next.siteTitle;
  if (!touched.length && !removed.length && !titleChanged) return next;
  return produce(next, (d) => {
    for (const [key, id] of touched) {
      const x = (d[key] as { id: string; updatedAt: number }[]).find((y) => y.id === id);
      if (x) x.updatedAt = Math.max(now, x.updatedAt + 1);
    }
    removed.forEach((id) => (d.tombstones[id] = now));
    if (titleChanged) d.metaUpdatedAt = now;
  });
}

const KEY_AT = KEY + ':savedAt';
/** identifies this tab when several are open */
const TAB_ID = Math.random().toString(36).slice(2);
const UNSAVED = 'wo-unsaved-changes';

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [lib, setLib] = useState<Library | null>(null);
  const [saveState, setSaveState] = useState<Ctx['saveState']>('saved');
  const timer = useRef<number>();
  const lastWrite = useRef(0);
  const latest = useRef<Library | null>(null);
  /** the version waiting to be written (null = everything is safely stored) */
  const dirty = useRef<Library | null>(null);
  /** what this tab knows is on disk: the common starting point when another tab saves */
  const base = useRef<Library | null>(null);
  /** a library adopted from another tab (already on disk: don't save it again) */
  const adopted = useRef<Library | null>(null);
  const channel = useRef<BroadcastChannel | null>(null);
  /** when the copy on disk that this tab last saw was written */
  const knownAt = useRef(0);

  useEffect(() => {
    (async () => {
      let stored: Library | null = null;
      let storedAt = 0;
      try {
        const [v, at] = await getMany([KEY, KEY_AT]);
        stored = normalizeLibrary(v);
        storedAt = (v as Library | undefined)?.savedAt ?? (typeof at === 'number' ? at : 0);
        knownAt.current = storedAt;
      } catch {
        /* fall through to an empty library */
      }
      // changes made just before the page closed last time, if they never reached main storage
      let rescued: Library | null = null;
      try {
        const raw = localStorage.getItem(UNSAVED);
        if (raw) {
          const u = JSON.parse(raw) as { at: number; lib: unknown };
          if (u.at > storedAt) rescued = normalizeLibrary(u.lib);
        }
        localStorage.removeItem(UNSAVED);
      } catch {
        /* ignore */
      }
      if (rescued) {
        // write them properly now
        latest.current = null;
        setLib(rescued);
        base.current = rescued;
        setMany([[KEY, rescued], [KEY_AT, Date.now()]]).catch(() => {});
      } else {
        const l = stored ?? emptyLibrary();
        base.current = l;
        setLib(l);
      }
    })();
    // Ask the browser not to evict our data under storage pressure.
    navigator.storage?.persist?.().catch(() => {});
  }, []);

  const flush = useCallback(async () => {
    const snapshot = latest.current;
    if (!snapshot) return;
    clearTimeout(timer.current);
    lastWrite.current = Date.now();
    try {
      // Read, combine and write in one step: if another tab saved since we last
      // looked, merge its changes in rather than writing over them.
      const now = Date.now();
      let written: Library = snapshot;
      await idbUpdate(KEY, (old: unknown) => {
        const disk = old as Library | undefined;
        if (disk && (disk.savedAt ?? 0) > knownAt.current && base.current) {
          const theirs = normalizeLibrary(disk);
          if (theirs) written = merge3(base.current, snapshot, theirs, 'a').value;
        }
        written = { ...written, savedAt: now };
        return written;
      });
      await setMany([[KEY_AT, now]]);
      knownAt.current = now;
      base.current = written;
      channel.current?.postMessage({ type: 'saved', from: TAB_ID, at: now });
      if (dirty.current === snapshot) dirty.current = null;
      // show the combined version (keeping anything typed while we were saving)
      setLib((cur) => {
        if (!cur) return cur;
        if (cur === snapshot) {
          adopted.current = written;
          return written;
        }
        return merge3(snapshot, cur, written, 'a').value;
      });
      setSaveState(dirty.current ? 'saving' : 'saved');
    } catch {
      setSaveState('error');
    }
  }, []);

  /**
   * Leaving the page (or switching away) while a save is still on its way: the
   * browser may stop that save, so also park the latest changes somewhere that
   * saves instantly. The next visit picks them up if they're newer.
   */
  const rescue = useCallback(() => {
    if (!dirty.current) return;
    try {
      localStorage.setItem(UNSAVED, JSON.stringify({ at: Date.now(), lib: dirty.current }));
    } catch {
      /* too big for this storage: the normal save below is all we can do */
    }
    flush();
  }, [flush]);

  useEffect(() => {
    if (!lib) return;
    if (lib === adopted.current) {
      // came from another tab and is already stored
      latest.current = lib;
      return;
    }
    if (latest.current === null) {
      latest.current = lib;
      return;
    }
    latest.current = lib;
    dirty.current = lib;
    setSaveState('saving');
    // Save straight away after a single change; while you're typing quickly,
    // save at most every 0.4 s.
    clearTimeout(timer.current);
    const since = Date.now() - lastWrite.current;
    if (since >= 400) flush();
    else timer.current = window.setTimeout(flush, 400 - since);
  }, [lib, flush]);

  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && rescue();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', rescue);
    window.addEventListener('beforeunload', rescue);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', rescue);
      window.removeEventListener('beforeunload', rescue);
    };
  }, [rescue]);

  // ---- several tabs open: when another tab saves, bring its changes in here
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel('writers-oatmeal-library');
    channel.current = ch;
    let t: number | undefined;
    ch.onmessage = (e) => {
      if (e.data?.type !== 'saved' || e.data.from === TAB_ID) return;
      clearTimeout(t);
      t = window.setTimeout(async () => {
        const disk = (await get(KEY).catch(() => null)) as Library | null;
        const theirs = normalizeLibrary(disk);
        if (!theirs || (disk?.savedAt ?? 0) <= knownAt.current) return; // nothing newer than what we have
        knownAt.current = disk?.savedAt ?? Date.now();
        const mine = latest.current;
        if (!mine || !dirty.current || !base.current) {
          // nothing unsaved here: just show what the other tab saved
          adopted.current = theirs;
          base.current = theirs;
          setLib(theirs);
          return;
        }
        // both tabs changed things: combine them (this tab's version wins a true clash)
        const merged = merge3(base.current, mine, theirs, 'a').value;
        base.current = theirs;
        setLib(merged);
      }, 250);
    };
    return () => {
      clearTimeout(t);
      ch.close();
      channel.current = null;
    };
  }, []);

  const update = useCallback((fn: LibUpdater) => setLib((prev) => (prev ? stamp(prev, produce(prev, fn)) : prev)), []);

  // empty the bin of anything older than 30 days (as a normal deletion, so it syncs)
  const loaded = !!lib;
  useEffect(() => {
    if (!loaded) return;
    update((d) => {
      const keep = d.trash.filter((t) => Date.now() - t.deletedAt < TRASH_DAYS * 864e5);
      if (keep.length !== d.trash.length) d.trash = keep;
    });
  }, [loaded, update]);
  const replace = useCallback((l: Library) => setLib((prev) => (prev ? stamp(prev, l) : l)), []);
  const applyRemote = useCallback((fn: (l: Library) => Library) => setLib((prev) => (prev ? fn(prev) : prev)), []);

  if (!lib)
    return (
      <div className="loading">
        <span className="loading-bowl">🥣</span>
        <p>Stirring your oatmeal…</p>
      </div>
    );
  return <LibraryContext.Provider value={{ lib, update, replace, applyRemote, saveState, saveNow: flush }}>{children}</LibraryContext.Provider>;
}

export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary outside provider');
  return ctx;
}

/** Finds a story or universe by id. */
export const findAny = (lib: Library | Draft<Library>, id: string | undefined) =>
  lib.stories.find((s) => s.id === id) ?? lib.universes.find((u) => u.id === id);

/**
 * A story (or universe) plus an updater. For a story in a universe, `characters`
 * includes the universe characters shared into it; edits to those land on the
 * universe, so they show up in every story that uses them. Removing a shared
 * character from the list only removes it from this story.
 */
export function useStory(id: string | undefined): [Story | undefined, StoryUpdater, Story | undefined] {
  const { lib, update } = useLibrary();
  const own = findAny(lib, id) as Story | undefined;
  const universe = own?.kind === 'story' && own.universeId ? lib.universes.find((u) => u.id === own.universeId) : undefined;

  const view = useMemo(() => {
    if (!own || !universe || !own.sharedCharacterIds.length) return own;
    const shared = own.sharedCharacterIds.map((cid) => universe.characters.find((c) => c.id === cid)).filter((c) => !!c);
    return { ...own, characters: [...own.characters, ...shared] };
  }, [own, universe]);

  const upd: StoryUpdater = useCallback(
    (fn) =>
      update((d) => {
        const s = findAny(d, id);
        if (!s) return;
        const u = s.kind === 'story' && s.universeId ? d.universes.find((x) => x.id === s.universeId) : undefined;
        if (!u || !s.sharedCharacterIds.length) return fn(s);

        const sharedIds = new Set(s.sharedCharacterIds);
        const ownBefore = [...s.characters];
        let merged = [...s.characters, ...s.sharedCharacterIds.map((cid) => u.characters.find((c) => c.id === cid)).filter((c) => !!c)];
        const view = new Proxy(s, {
          get: (t, k) => (k === 'characters' ? merged : (t as any)[k]),
          set: (t, k, v) => {
            if (k === 'characters') merged = v;
            else (t as any)[k] = v;
            return true;
          },
        });
        fn(view);
        const ownAfter = merged.filter((c) => !sharedIds.has(c.id));
        const sharedAfter = merged.filter((c) => sharedIds.has(c.id)).map((c) => c.id);
        if (ownAfter.length !== ownBefore.length || ownAfter.some((c, i) => c !== ownBefore[i])) s.characters = ownAfter;
        if (sharedAfter.join() !== s.sharedCharacterIds.join()) s.sharedCharacterIds = sharedAfter;
      }),
    [id, update],
  );
  return [view, upd, universe];
}
