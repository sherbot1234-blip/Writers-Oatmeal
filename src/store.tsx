import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { produce, type Draft } from 'immer';
import { get, set } from 'idb-keyval';
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

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [lib, setLib] = useState<Library | null>(null);
  const [saveState, setSaveState] = useState<Ctx['saveState']>('saved');
  const timer = useRef<number>();
  const latest = useRef<Library | null>(null);

  useEffect(() => {
    get(KEY)
      .then((v) => setLib(normalizeLibrary(v) ?? emptyLibrary()))
      .catch(() => setLib(emptyLibrary()));
    // Ask the browser not to evict our data under storage pressure.
    navigator.storage?.persist?.().catch(() => {});
  }, []);

  const flush = useCallback(async () => {
    if (!latest.current) return;
    clearTimeout(timer.current);
    try {
      await set(KEY, latest.current);
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  }, []);

  useEffect(() => {
    if (!lib) return;
    if (latest.current === null) {
      latest.current = lib;
      return;
    }
    latest.current = lib;
    setSaveState('saving');
    clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, 400);
  }, [lib, flush]);

  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
    };
  }, [flush]);

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
