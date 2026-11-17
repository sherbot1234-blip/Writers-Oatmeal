import type { Draft } from 'immer';
import type { Library, Story } from './types';

type D = Draft<Library>;

export const storiesIn = (lib: Library, universeId: string) =>
  lib.stories.filter((s) => s.universeId === universeId).sort((a, b) => a.seriesOrder - b.seriesOrder);

/** Turns the universe characters a story uses into the story's own copies. */
function detachShared(d: D, s: Draft<Story>) {
  const u = d.universes.find((x) => x.id === s.universeId);
  if (u) {
    for (const cid of s.sharedCharacterIds) {
      const c = u.characters.find((x) => x.id === cid);
      if (c && !s.characters.some((x) => x.id === cid)) s.characters.push(JSON.parse(JSON.stringify(c)));
    }
  }
  s.sharedCharacterIds = [];
}

/** Moves a story into a universe (or out of one, with universeId undefined). Nothing is lost on the way out. */
export function setStoryUniverse(d: D, storyId: string, universeId: string | undefined) {
  const s = d.stories.find((x) => x.id === storyId);
  if (!s || s.universeId === universeId) return;
  if (s.universeId) detachShared(d, s);
  s.universeId = universeId;
  if (universeId) {
    const orders = d.stories.filter((x) => x.universeId === universeId && x.id !== storyId).map((x) => x.seriesOrder);
    s.seriesOrder = orders.length ? Math.max(...orders) + 1 : 1;
  }
}

/** Moves one of a story's own characters into its universe, so other stories can use them too. */
export function shareCharacter(d: D, storyId: string, charId: string) {
  const s = d.stories.find((x) => x.id === storyId);
  const u = s && d.universes.find((x) => x.id === s.universeId);
  if (!s || !u) return;
  const i = s.characters.findIndex((c) => c.id === charId);
  if (i < 0) return;
  const [c] = s.characters.splice(i, 1);
  u.characters.push(c);
  s.sharedCharacterIds.push(charId);
}

export function includeShared(d: D, storyId: string, charIds: string[]) {
  const s = d.stories.find((x) => x.id === storyId);
  if (!s) return;
  for (const id of charIds) if (!s.sharedCharacterIds.includes(id)) s.sharedCharacterIds.push(id);
}

/** Deletes a universe character everywhere it appears. */
export function deleteUniverseCharacter(d: D, universeId: string, charId: string) {
  const u = d.universes.find((x) => x.id === universeId);
  if (!u) return;
  u.characters = u.characters.filter((c) => c.id !== charId);
  u.relationships = u.relationships.filter((r) => r.from !== charId && r.to !== charId);
  for (const s of d.stories) {
    if (s.universeId !== universeId || !s.sharedCharacterIds.includes(charId)) continue;
    s.sharedCharacterIds = s.sharedCharacterIds.filter((x) => x !== charId);
    s.relationships = s.relationships.filter((r) => r.from !== charId && r.to !== charId);
  }
}

/** Deletes a universe. Its stories stay, each keeping its own copy of the shared characters it used. */
export function deleteUniverse(d: D, universeId: string) {
  for (const s of d.stories) {
    if (s.universeId !== universeId) continue;
    detachShared(d, s);
    s.universeId = undefined;
  }
  d.universes = d.universes.filter((u) => u.id !== universeId);
}

/** Which stories use a given universe character. */
export const storiesUsing = (lib: Library, charId: string) => lib.stories.filter((s) => s.sharedCharacterIds.includes(charId));
