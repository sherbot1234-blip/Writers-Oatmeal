/**
 * Three-way merge of two edited copies of the same thing.
 *
 * `base` is the version both copies started from. Anything only one side
 * changed is kept; when both changed the very same value differently, the
 * `prefer` side wins and the spot is reported in `conflicts`.
 *
 * Lists of things with an `id` (characters, sections, plot points…) are merged
 * item by item, so adding a character on one device and a plot point on another
 * keeps both. Lists of plain values (tags, ids) are merged as sets.
 */

type J = unknown;

const isObj = (v: J): v is Record<string, J> => !!v && typeof v === 'object' && !Array.isArray(v);
const hasIds = (v: J): v is { id: string }[] => Array.isArray(v) && v.length > 0 && v.every((x) => isObj(x) && typeof x.id === 'string');
const idList = (v: J) => Array.isArray(v) && v.every((x) => isObj(x) && typeof x.id === 'string');

export function same(a: J, b: J): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const bb = b as J[];
    return a.length === bb.length && a.every((x, i) => same(x, bb[i]));
  }
  const ka = Object.keys(a as object).filter((k) => (a as any)[k] !== undefined);
  const kb = Object.keys(b as object).filter((k) => (b as any)[k] !== undefined);
  return ka.length === kb.length && ka.every((k) => same((a as any)[k], (b as any)[k]));
}

export interface MergeResult<T> {
  value: T;
  conflicts: string[];
}

export function merge3<T>(base: J, a: T, b: T, prefer: 'a' | 'b'): MergeResult<T> {
  const conflicts: string[] = [];
  const value = m(base, a, b, prefer, '', conflicts) as T;
  return { value, conflicts };
}

function m(base: J, a: J, b: J, prefer: 'a' | 'b', path: string, out: string[]): J {
  if (same(a, b)) return a;
  if (same(base, a)) return b; // only b changed
  if (same(base, b)) return a; // only a changed

  if (isObj(a) && isObj(b)) {
    const bo = isObj(base) ? base : {};
    const res: Record<string, J> = {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      // bookkeeping timestamps aren't content: just take the later one
      if (k === 'updatedAt' && typeof a[k] === 'number' && typeof b[k] === 'number') {
        res[k] = Math.max(a[k] as number, b[k] as number);
        continue;
      }
      const v = m(bo[k], a[k], b[k], prefer, path + '.' + k, out);
      if (v !== undefined) res[k] = v;
    }
    return res;
  }

  if ((hasIds(a) || hasIds(b)) && idList(a) && idList(b)) return mergeById((idList(base) ? base : []) as { id: string }[], a as { id: string }[], b as { id: string }[], prefer, path, out);

  if (Array.isArray(a) && Array.isArray(b) && [...a, ...b].every((x) => typeof x !== 'object' || x === null)) {
    // plain values (tags, ids): keep additions from both, drop what either removed
    const bs = new Set(Array.isArray(base) ? (base as J[]) : []);
    const removed = new Set([...bs].filter((x) => !a.includes(x) || !b.includes(x)));
    const res = [...a.filter((x) => !removed.has(x))];
    for (const x of b) if (!removed.has(x) && !res.includes(x)) res.push(x);
    return res;
  }

  // both changed the same value differently
  out.push(path || '(whole)');
  return prefer === 'a' ? a : b;
}

function mergeById(base: { id: string }[], a: { id: string }[], b: { id: string }[], prefer: 'a' | 'b', path: string, out: string[]) {
  const B = new Map(base.map((x) => [x.id, x]));
  const A = new Map(a.map((x) => [x.id, x]));
  const Bb = new Map(b.map((x) => [x.id, x]));
  // order: follow the side that reordered things (if any), slotting in the other side's new items
  const aIds = a.map((x) => x.id);
  const bIds = b.map((x) => x.id);
  const primary = same(base.map((x) => x.id), aIds) ? bIds : aIds;
  const other = primary === aIds ? bIds : aIds;
  const order = [...primary];
  other.forEach((id, i) => {
    if (order.includes(id)) return;
    const prev = other[i - 1];
    const at = i === 0 ? 0 : prev && order.includes(prev) ? order.indexOf(prev) + 1 : order.length;
    order.splice(at, 0, id);
  });
  const res: { id: string }[] = [];
  for (const id of order) {
    const inA = A.get(id);
    const inB = Bb.get(id);
    const inBase = B.get(id);
    if (inA && inB) res.push(m(inBase, inA, inB, prefer, `${path}[${id}]`, out) as { id: string });
    else if (inA) {
      // b deleted it: gone, unless a changed it since (an edit beats a delete)
      if (!inBase || !same(inBase, inA)) res.push(inA);
    } else if (inB) {
      if (!inBase || !same(inBase, inB)) res.push(inB);
    }
  }
  return res;
}
