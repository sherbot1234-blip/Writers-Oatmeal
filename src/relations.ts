import type { Moment, Relationship, RelState, RelType, Story } from './types';

export interface ResolvedState {
  state: RelState;
  /** index of the moment this state was set at (≤ the moment asked about) */
  fromIndex: number;
}

/** How `rel` stands at moment `idx`: the latest state set at or before it. */
export function stateAt(rel: Relationship | undefined, moments: Moment[], idx: number): ResolvedState | undefined {
  if (!rel) return undefined;
  for (let i = Math.min(idx, moments.length - 1); i >= 0; i--) {
    const st = rel.states[moments[i].id];
    if (st) return { state: st, fromIndex: i };
  }
  return undefined;
}

export const findRel = (s: Pick<Story, 'relationships'>, from: string, to: string) =>
  s.relationships.find((r) => r.from === from && r.to === to);

export const typesOf = (s: Pick<Story, 'relTypes'>, st: RelState | undefined) =>
  (st?.typeIds ?? []).map((id) => s.relTypes.find((t) => t.id === id)).filter((t): t is RelType => !!t);

/** True when nothing meaningful is set (so the moment can be cleared). */
export const isEmptyState = (st: RelState) => !st.typeIds.length && !st.feeling.trim() && !Object.keys(st.values).length;

/**
 * How `a` sees `b`: their own one-way relationship if there is one,
 * otherwise a mutual relationship between the two (stored either way round).
 */
export const relFor = (s: Pick<Story, 'relationships'>, a: string, b: string) =>
  s.relationships.find((r) => r.from === a && r.to === b) ?? s.relationships.find((r) => r.mutual && r.from === b && r.to === a);

/** Everyone `id` has a relationship with, in either direction. */
export function partnersOf(s: Pick<Story, 'relationships'>, id: string): string[] {
  const out: string[] = [];
  for (const r of s.relationships) {
    const other = r.from === id ? r.to : r.to === id ? r.from : null;
    if (other && !out.includes(other)) out.push(other);
  }
  return out;
}

/** The state that's in effect by the end of the story, and which moment it was set at. */
export const latest = (rel: Relationship | undefined, moments: Moment[]) => stateAt(rel, moments, moments.length - 1);

export const emptyState = (): RelState => ({ typeIds: [], feeling: '', values: {} });
