import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { produce, type Draft } from 'immer';
import { get, set } from 'idb-keyval';
import type { Library, Story } from './types';
import { emptyLibrary, normalizeLibrary } from './defaults';

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
}

const LibraryContext = createContext<Ctx | null>(null);

/** Records deletions and settings changes so they can sync to other devices. */
function stamp(prev: Library, next: Library): Library {
  const ids = new Set(next.stories.map((s) => s.id));
  const removed = prev.stories.filter((s) => !ids.has(s.id));
  const titleChanged = prev.siteTitle !== next.siteTitle;
  if (!removed.length && !titleChanged) return next;
  const now = Date.now();
  return produce(next, (d) => {
    removed.forEach((s) => (d.tombstones[s.id] = now));
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

  const flush = useCallback(() => {
    if (!latest.current) return;
    set(KEY, latest.current)
      .then(() => setSaveState('saved'))
      .catch(() => setSaveState('error'));
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
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [flush]);

  const update = useCallback((fn: LibUpdater) => setLib((prev) => (prev ? stamp(prev, produce(prev, fn)) : prev)), []);
  const replace = useCallback((l: Library) => setLib((prev) => (prev ? stamp(prev, l) : l)), []);
  const applyRemote = useCallback((fn: (l: Library) => Library) => setLib((prev) => (prev ? fn(prev) : prev)), []);

  if (!lib) return <div className="loading">Loading your stories…</div>;
  return <LibraryContext.Provider value={{ lib, update, replace, applyRemote, saveState }}>{children}</LibraryContext.Provider>;
}

export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary outside provider');
  return ctx;
}

export function useStory(id: string | undefined): [Story | undefined, StoryUpdater] {
  const { lib, update } = useLibrary();
  const story = lib.stories.find((s) => s.id === id);
  const upd: StoryUpdater = useCallback(
    (fn) =>
      update((d) => {
        const s = d.stories.find((x) => x.id === id);
        if (s) {
          fn(s);
          s.updatedAt = Date.now();
        }
      }),
    [id, update],
  );
  return [story, upd];
}
