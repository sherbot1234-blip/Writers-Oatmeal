import type { Character, FamilyRole, Moment, Relationship, RelState, RelType, Story } from './types';

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

// ---------------------------------------------------------------- family tree

export interface TreeNode {
  id: string;
  x: number;
  y: number;
  gen: number;
}
export interface TreeEdge {
  parents: string[];
  child: string;
  adoptive: boolean;
}
export interface FamilyTree {
  nodes: TreeNode[];
  childEdges: TreeEdge[];
  spouses: [string, string][];
  /** sibling groups with no shared parent drawn above them */
  siblingLinks: [string, string][];
  width: number;
  height: number;
}

export const NODE_W = 120;
export const NODE_H = 96;
const GAP_X = 28;
const GAP_Y = 70;

/**
 * Builds a family tree from relationship types that have a family role.
 * "A → B: Parent" means B is A's parent; "A → B: Child" means B is A's child.
 */
export function buildFamilyTree(story: Story, characters: Character[], momentIdx: number): FamilyTree | null {
  const known = new Set(characters.map((c) => c.id));
  const parentOf = new Map<string, Map<string, boolean>>(); // child → (parent → adoptive?)
  const spouse = new Set<string>();
  const sibling = new Set<string>();
  const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const addParent = (child: string, parent: string, adoptive: boolean) => {
    if (child === parent) return;
    if (!parentOf.has(child)) parentOf.set(child, new Map());
    const m = parentOf.get(child)!;
    m.set(parent, (m.get(parent) ?? true) && adoptive); // a biological link wins
  };

  for (const rel of story.relationships) {
    if (!known.has(rel.from) || !known.has(rel.to)) continue;
    const st = stateAt(rel, story.moments, momentIdx)?.state;
    for (const t of typesOf(story, st)) {
      const role: FamilyRole | undefined = t.family;
      if (role === 'parent') addParent(rel.from, rel.to, false);
      else if (role === 'adoptive-parent') addParent(rel.from, rel.to, true);
      else if (role === 'child') addParent(rel.to, rel.from, false);
      else if (role === 'adoptive-child') addParent(rel.to, rel.from, true);
      else if (role === 'spouse') spouse.add(key(rel.from, rel.to));
      else if (role === 'sibling') sibling.add(key(rel.from, rel.to));
    }
  }

  const ids = new Set<string>();
  parentOf.forEach((ps, c) => {
    ids.add(c);
    ps.forEach((_, p) => ids.add(p));
  });
  [...spouse, ...sibling].forEach((k) => k.split('|').forEach((x) => ids.add(x)));
  if (!ids.size) return null;

  // ---- generations: parents one row above children; spouses & siblings share a row
  const gen = new Map([...ids].map((id) => [id, 0]));
  const pairs = (set: Set<string>) => [...set].map((k) => k.split('|') as [string, string]);
  for (let iter = 0; iter < ids.size * 4; iter++) {
    let changed = false;
    parentOf.forEach((ps, c) =>
      ps.forEach((_, p) => {
        if (gen.get(c)! < gen.get(p)! + 1) {
          gen.set(c, gen.get(p)! + 1);
          changed = true;
        }
      }),
    );
    for (const [a, b] of [...pairs(spouse), ...pairs(sibling)]) {
      const m = Math.max(gen.get(a)!, gen.get(b)!);
      if (gen.get(a) !== m || gen.get(b) !== m) {
        gen.set(a, m);
        gen.set(b, m);
        changed = true;
      }
    }
    if (!changed) break;
  }
  const minGen = Math.min(...gen.values());
  gen.forEach((g, id) => gen.set(id, g - minGen));
  const maxGen = Math.max(...gen.values());

  // ---- order within each row: under parents, spouses side by side, siblings together
  const order = characters.map((c) => c.id);
  const rows: string[][] = Array.from({ length: maxGen + 1 }, () => []);
  for (const id of order) if (ids.has(id)) rows[gen.get(id)!].push(id);
  const xOf = new Map<string, number>();
  const place = (row: string[]) => row.forEach((id, i) => xOf.set(id, i));
  place(rows[0]);
  for (let g = 0; g <= maxGen; g++) {
    const row = rows[g];
    if (g > 0) {
      const bary = (id: string) => {
        const ps = [...(parentOf.get(id)?.keys() ?? [])].filter((p) => xOf.has(p));
        return ps.length ? ps.reduce((n, p) => n + xOf.get(p)!, 0) / ps.length : xOf.get(id) ?? row.indexOf(id);
      };
      row.sort((a, b) => bary(a) - bary(b));
    }
    // pull spouses next to each other
    for (const [a, b] of pairs(spouse)) {
      if (gen.get(a) !== g) continue;
      const ia = row.indexOf(a);
      const ib = row.indexOf(b);
      if (Math.abs(ia - ib) > 1) {
        row.splice(ib, 1);
        row.splice(row.indexOf(a) + 1, 0, b);
      }
    }
    place(row);
  }

  // ---- coordinates (each row centred)
  const widest = Math.max(...rows.map((r) => r.length));
  const width = widest * (NODE_W + GAP_X) + GAP_X;
  const nodes: TreeNode[] = [];
  rows.forEach((row, g) => {
    const rowW = row.length * (NODE_W + GAP_X) - GAP_X;
    const x0 = (width - rowW) / 2;
    row.forEach((id, i) => nodes.push({ id, gen: g, x: x0 + i * (NODE_W + GAP_X), y: GAP_X + g * (NODE_H + GAP_Y) }));
  });

  const childEdges: TreeEdge[] = [];
  parentOf.forEach((ps, child) => {
    // group biological and adoptive parents into separate lines
    const bio = [...ps].filter(([, a]) => !a).map(([p]) => p);
    const ado = [...ps].filter(([, a]) => a).map(([p]) => p);
    if (bio.length) childEdges.push({ parents: bio, child, adoptive: false });
    if (ado.length) childEdges.push({ parents: ado, child, adoptive: true });
  });

  // siblings that share no parent in the tree get a bracket line
  const siblingLinks = pairs(sibling).filter(([a, b]) => {
    const pa = parentOf.get(a);
    const pb = parentOf.get(b);
    return !pa || !pb || ![...pa.keys()].some((p) => pb.has(p));
  });

  return { nodes, childEdges, spouses: pairs(spouse), siblingLinks, width, height: (maxGen + 1) * (NODE_H + GAP_Y) + GAP_X };
}
