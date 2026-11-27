/**
 * Deleting things into the "Recently deleted" bin, and putting them back.
 * Everything that belongs with a deleted thing (a character's relationships,
 * tree spots, song tags…) travels with it, so a restore is complete.
 */
import type { Draft } from 'immer';
import type { Chapter, Character, Library, Story, TrashItem } from './types';
import { uid } from './util';
import { deleteUniverse } from './universe';

type D = Draft<Library>;
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const findStory = (d: D, id?: string) => (id ? d.stories.find((s) => s.id === id) ?? d.universes.find((u) => u.id === id) : undefined);

function put(d: D, item: Omit<TrashItem, 'id' | 'deletedAt' | 'updatedAt'>) {
  const now = Date.now();
  d.trash.push({ ...item, id: uid(), deletedAt: now, updatedAt: now } as TrashItem);
}

// ---------------------------------------------------------------- stories & universes

export function trashStory(d: D, storyId: string) {
  const s = d.stories.find((x) => x.id === storyId);
  if (!s) return;
  const chapters = d.chapters.filter((c) => c.storyId === storyId);
  put(d, { kind: 'story', title: s.title || 'Untitled', what: 'Story', storyId, payload: { story: clone(s), chapters: clone(chapters) } });
  d.stories = d.stories.filter((x) => x.id !== storyId);
  d.chapters = d.chapters.filter((c) => c.storyId !== storyId);
}

export function trashUniverse(d: D, universeId: string) {
  const u = d.universes.find((x) => x.id === universeId);
  if (!u) return;
  put(d, { kind: 'universe', title: u.title || 'Untitled universe', what: 'Universe', storyId: universeId, payload: { universe: clone(u) } });
  deleteUniverse(d, universeId); // its stories stay, with their own copies of the shared cast
}

// ---------------------------------------------------------------- characters

/** Removes a character and everything pointing at them; returns what was removed so it can be put back. */
function detachCharacter(s: Draft<Story>, charId: string) {
  const rels = s.relationships.filter((r) => r.from === charId || r.to === charId);
  const treeBits = s.trees
    .map((t) => {
      const nodes = t.nodes.filter((n) => n.charId === charId);
      const ids = new Set(nodes.map((n) => n.id));
      return { treeId: t.id, nodes: clone(nodes), links: clone(t.links.filter((l) => ids.has(l.from) || ids.has(l.to))) };
    })
    .filter((x) => x.nodes.length);
  const extra = {
    rels: clone(rels),
    cats: s.charCategoryMap[charId] ? [...s.charCategoryMap[charId]] : undefined,
    arc: s.characterArcs[charId] ? clone(s.characterArcs[charId]) : undefined,
    songs: s.songs.filter((x) => x.characterIds.includes(charId)).map((x) => x.id),
    points: s.arcs.flatMap((a) => a.points.filter((p) => p.characterIds.includes(charId)).map((p) => p.id)),
    pov: s.relPovs.includes(charId),
    chart: s.relCharts[charId] ? clone(s.relCharts[charId]) : undefined,
    spots: Object.entries(s.relCharts).flatMap(([pov, spots]) => spots.filter((x) => x.charId === charId).map((x) => ({ pov, spot: clone(x) }))),
    treeBits,
  };
  s.relationships = s.relationships.filter((r) => r.from !== charId && r.to !== charId);
  for (const t of s.trees) {
    const ids = new Set(t.nodes.filter((n) => n.charId === charId).map((n) => n.id));
    t.nodes = t.nodes.filter((n) => !ids.has(n.id));
    t.links = t.links.filter((l) => !ids.has(l.from) && !ids.has(l.to));
  }
  delete s.charCategoryMap[charId];
  delete s.characterArcs[charId];
  s.songs.forEach((x) => (x.characterIds = x.characterIds.filter((y) => y !== charId)));
  s.arcs.forEach((a) => a.points.forEach((p) => (p.characterIds = p.characterIds.filter((y) => y !== charId))));
  s.relPovs = s.relPovs.filter((x) => x !== charId);
  delete s.relCharts[charId];
  for (const k of Object.keys(s.relCharts)) s.relCharts[k] = s.relCharts[k].filter((x) => x.charId !== charId);
  s.sharedCharacterIds = s.sharedCharacterIds.filter((x) => x !== charId);
  return extra;
}

function reattachCharacter(d: D, s: Draft<Story>, charId: string, extra: any) {
  const known = new Set([...s.characters.map((c) => c.id), ...s.sharedCharacterIds]);
  for (const r of extra.rels ?? []) if (known.has(r.from === charId ? r.to : r.from) && !s.relationships.some((x) => x.id === r.id)) s.relationships.push(r);
  if (extra.cats) s.charCategoryMap[charId] = extra.cats.filter((c: string) => s.charCategories.some((k) => k.id === c));
  if (extra.arc) s.characterArcs[charId] = extra.arc;
  s.songs.forEach((x) => extra.songs?.includes(x.id) && !x.characterIds.includes(charId) && x.characterIds.push(charId));
  s.arcs.forEach((a) => a.points.forEach((p) => extra.points?.includes(p.id) && !p.characterIds.includes(charId) && p.characterIds.push(charId)));
  if (extra.pov && !s.relPovs.includes(charId)) s.relPovs.push(charId);
  if (extra.chart) s.relCharts[charId] = extra.chart;
  for (const { pov, spot } of extra.spots ?? []) if (s.relCharts[pov] && !s.relCharts[pov].some((x) => x.charId === charId)) s.relCharts[pov].push(spot);
  for (const tb of extra.treeBits ?? []) {
    const t = s.trees.find((x) => x.id === tb.treeId);
    if (!t) continue;
    t.nodes.push(...tb.nodes);
    const ids = new Set(t.nodes.map((n) => n.id));
    t.links.push(...tb.links.filter((l: any) => ids.has(l.from) && ids.has(l.to)));
  }
  void d;
}

/** Deletes a story's own character (or a universe's shared one) into the bin. */
export function trashCharacter(d: D, ownerId: string, charId: string) {
  const owner = findStory(d, ownerId);
  if (!owner) return;
  const c = owner.characters.find((x) => x.id === charId);
  if (!c) return;
  const extra = detachCharacter(owner, charId);
  // a shared (universe) character also leaves every story that used them
  const usedBy: { storyId: string; extra: any }[] = [];
  if (owner.kind === 'universe')
    for (const s of d.stories) if (s.universeId === owner.id && s.sharedCharacterIds.includes(charId)) usedBy.push({ storyId: s.id, extra: detachCharacter(s, charId) });
  owner.characters = owner.characters.filter((x) => x.id !== charId);
  put(d, { kind: 'character', title: c.name || 'Unnamed', what: owner.kind === 'universe' ? 'Shared character' : 'Character', storyId: ownerId, storyTitle: owner.title, payload: { char: clone(c), extra, usedBy } });
}

// ---------------------------------------------------------------- chapters & smaller things

export function trashChapter(d: D, chapterId: string) {
  const c = d.chapters.find((x) => x.id === chapterId);
  if (!c) return;
  const s = d.stories.find((x) => x.id === c.storyId);
  const points = s ? s.arcs.flatMap((a) => a.points.filter((p) => p.chapterId === chapterId).map((p) => p.id)) : [];
  s?.arcs.forEach((a) => a.points.forEach((p) => p.chapterId === chapterId && (p.chapterId = undefined)));
  s?.songs.forEach((x) => (x.chapterIds = x.chapterIds.filter((y) => y !== chapterId)));
  put(d, { kind: 'chapter', title: c.title || 'Untitled chapter', what: 'Chapter', storyId: c.storyId, storyTitle: s?.title, payload: { chapter: clone(c), points } });
  d.chapters = d.chapters.filter((x) => x.id !== chapterId);
}

/** Lists inside a story that can be binned item by item. */
export type ItemList = 'songs' | 'lore' | 'worldImages' | 'events' | 'glossary' | 'trees' | 'customPages' | 'relationships' | 'arcs';
const WHAT: Record<ItemList, string> = {
  songs: 'Song',
  lore: 'Wiki page',
  worldImages: 'Picture',
  events: 'History event',
  glossary: 'Glossary term',
  trees: 'Family tree',
  customPages: 'Page',
  relationships: 'Relationship',
  arcs: 'Plot arc',
};

export function trashItem(d: D, storyId: string, list: ItemList, itemId: string, title?: string) {
  const s = findStory(d, storyId);
  if (!s) return;
  const arr = (s as any)[list] as { id: string; title?: string; name?: string; term?: string }[];
  const i = arr.findIndex((x) => x.id === itemId);
  if (i < 0) return;
  const item = arr[i];
  put(d, { kind: 'item', title: title ?? item.title ?? item.name ?? item.term ?? 'Untitled', what: WHAT[list], storyId, storyTitle: s.title, payload: { list, index: i, item: clone(item) } });
  arr.splice(i, 1);
}

export function trashPlotPoint(d: D, storyId: string, pointId: string) {
  const s = findStory(d, storyId);
  const arc = s?.arcs.find((a) => a.points.some((p) => p.id === pointId));
  if (!s || !arc) return;
  const i = arc.points.findIndex((p) => p.id === pointId);
  const p = arc.points[i];
  put(d, { kind: 'item', title: p.title || 'Untitled', what: 'Plot point', storyId, storyTitle: s.title, payload: { list: 'points', arcId: arc.id, index: i, item: clone(p) } });
  arc.points.splice(i, 1);
  s.structure?.beats.forEach((b) => (b.pointIds = b.pointIds.filter((x) => x !== pointId)));
  s.songs.forEach((x) => (x.pointIds = x.pointIds.filter((y) => y !== pointId)));
}

// ---------------------------------------------------------------- putting things back

/** Returns a message if it couldn't be restored (e.g. its story is gone). */
export function restore(d: D, trashId: string): string | null {
  const t = d.trash.find((x) => x.id === trashId);
  if (!t) return 'Already restored.';
  const p = t.payload;
  const story = findStory(d, t.storyId);
  const fresh = <T extends { id: string }>(list: T[], x: T): T => (list.some((y) => y.id === x.id) ? { ...x, id: uid() } : x);

  switch (t.kind) {
    case 'story': {
      const s = fresh(d.stories, p.story as Story);
      if (s.universeId && !d.universes.some((u) => u.id === s.universeId)) s.universeId = undefined;
      d.stories.unshift(s);
      for (const c of p.chapters as Chapter[]) d.chapters.push({ ...fresh(d.chapters, c), storyId: s.id });
      break;
    }
    case 'universe':
      d.universes.push(fresh(d.universes, p.universe as Story));
      break;
    case 'character': {
      if (!story) return `“${t.storyTitle ?? 'Its story'}” is no longer here. Restore the story first.`;
      const c = p.char as Character;
      if (story.characters.some((x) => x.id === c.id)) return `${c.name || 'This character'} is already back.`;
      story.characters.push(c);
      reattachCharacter(d, story, c.id, p.extra);
      for (const u of p.usedBy ?? []) {
        const s = d.stories.find((x) => x.id === u.storyId);
        if (!s || s.universeId !== story.id) continue;
        if (!s.sharedCharacterIds.includes(c.id)) s.sharedCharacterIds.push(c.id);
        reattachCharacter(d, s, c.id, u.extra);
      }
      break;
    }
    case 'chapter': {
      if (!d.stories.some((s) => s.id === t.storyId)) return `“${t.storyTitle ?? 'Its story'}” is no longer here. Restore the story first.`;
      const c = fresh(d.chapters, p.chapter as Chapter);
      d.chapters.push(c);
      const s = d.stories.find((x) => x.id === t.storyId)!;
      s.arcs.forEach((a) => a.points.forEach((pt) => p.points?.includes(pt.id) && !pt.chapterId && (pt.chapterId = c.id)));
      break;
    }
    case 'item': {
      if (!story) return `“${t.storyTitle ?? 'Its story'}” is no longer here. Restore the story first.`;
      if (p.list === 'points') {
        const arc = story.arcs.find((a) => a.id === p.arcId) ?? story.arcs[0];
        if (!arc) {
          story.arcs.push({ id: uid(), title: 'Restored', description: '', color: '#888888', points: [] });
        }
        const target = story.arcs.find((a) => a.id === p.arcId) ?? story.arcs[0];
        target.points.splice(Math.min(p.index, target.points.length), 0, fresh(target.points, p.item));
      } else {
        const arr = (story as any)[p.list] as { id: string }[];
        arr.splice(Math.min(p.index, arr.length), 0, fresh(arr, p.item));
      }
      break;
    }
    case 'version': {
      // an older version that lost to a newer edit during sync: bring it back as a separate copy
      const data = clone(p.data);
      if (p.kind === 'chapter') {
        if (!d.stories.some((s) => s.id === data.storyId)) return 'Its story is no longer here.';
        d.chapters.push({ ...data, id: uid(), title: `${data.title || 'Chapter'} (older version)`, order: (data.order ?? 0) + 0.5 });
      } else if (p.kind === 'story' || p.kind === 'universe') {
        const copy = { ...data, id: uid(), title: `${data.title || 'Untitled'} (older version)` };
        if (p.kind === 'universe') d.universes.push(copy);
        else d.stories.unshift(copy);
      } else return 'This kind of older version can only be deleted.';
      break;
    }
  }
  d.trash = d.trash.filter((x) => x.id !== trashId);
  return null;
}

export const daysLeft = (t: TrashItem, keepDays: number) => Math.max(0, Math.ceil(keepDays - (Date.now() - t.deletedAt) / 864e5));
