import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { produce, type Draft } from 'immer';
import { getMany, setMany } from 'idb-keyval';
import type { Library, Story } from './types';
import { emptyLibrary, normalizeLibrary } from './defaults';
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
  const touched: [('stories' | 'universes' | 'chapters'), string][] = [];
  const removed: string[] = [];
  for (const [key, kind] of [['stories', 'story'], ['universes', 'universe'], ['chapters', 'chapter']] as const) {
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
const UNSAVED = 'wo-unsaved-changes';

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [lib, setLib] = useState<Library | null>(null);
  const [saveState, setSaveState] = useState<Ctx['saveState']>('saved');
  const timer = useRef<number>();
  const lastWrite = useRef(0);
  const latest = useRef<Library | null>(null);
  /** the version waiting to be written (null = everything is safely stored) */
  const dirty = useRef<Library | null>(null);

  useEffect(() => {
    (async () => {
      let stored: Library | null = null;
      let storedAt = 0;
      try {
        const [v, at] = await getMany([KEY, KEY_AT]);
        stored = normalizeLibrary(v);
        storedAt = typeof at === 'number' ? at : 0;
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
        setMany([[KEY, rescued], [KEY_AT, Date.now()]]).catch(() => {});
      } else setLib(stored ?? emptyLibrary());
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
      await setMany([[KEY, snapshot], [KEY_AT, Date.now()]]);
      if (dirty.current === snapshot) dirty.current = null;
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

  const update = useCallback((fn: LibUpdater) => setLib((prev) => (prev ? stamp(prev, produce(prev, fn)) : prev)), []);
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
