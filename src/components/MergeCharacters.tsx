import { useMemo, useState } from 'react';
import type { Draft } from 'immer';
import { useLibrary } from '../store';
import { Avatar, Modal } from './ui';
import { FramedImg } from './Framed';
import { trashCharacter } from '../trash';
import { emptyState, latest } from '../relations';
import { uid } from '../util';
import type { Character, Section, Story } from '../types';

type Pick = 'a' | 'b' | 'both' | 'none';
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const key = (s: Section) => s.kind + ':' + s.title.trim().toLowerCase();

/** How much is filled in, to suggest the fuller version by default. */
function filled(s?: Section): number {
  if (!s) return 0;
  return (
    (s.text?.trim().length ? 1 : 0) +
    (s.facts ?? []).filter((f) => f.value.trim()).length +
    (s.tags?.length ?? 0) +
    (s.images?.length ?? 0) +
    (s.quotes ?? []).filter((q) => q.text.trim()).length +
    (s.voice?.trim() ? 1 : 0) +
    (s.stats ?? []).filter((x) => x.value !== 5).length
  );
}

function preview(s?: Section): string {
  if (!s) return '—';
  if (s.kind === 'facts') return (s.facts ?? []).filter((f) => f.value).map((f) => `${f.label}: ${f.value}`).join(' · ') || '(empty)';
  if (s.kind === 'text') return s.text?.trim().slice(0, 140) || '(empty)';
  if (s.kind === 'tags') return s.tags?.join(', ') || '(empty)';
  if (s.kind === 'stats') return (s.stats ?? []).map((x) => `${x.label} ${x.value}`).join(' · ') || '(empty)';
  if (s.kind === 'images') return `${s.images?.length ?? 0} picture(s)`;
  if (s.kind === 'quotes') return (s.quotes ?? []).map((q) => `“${q.text}”`).join(' ').slice(0, 140) || s.voice || '(empty)';
  return '';
}

export function MergeCharacters({ story, a, b, onClose, onDone }: { story: Story; a: string; b: string; onClose: () => void; onDone: () => void }) {
  const { update } = useLibrary();
  const A = story.characters.find((c) => c.id === a)!;
  const B = story.characters.find((c) => c.id === b)!;
  const [keep, setKeep] = useState<'a' | 'b'>('a');

  // which parts to take from which side
  const [basics, setBasics] = useState<Record<'name' | 'role' | 'picture' | 'colour' | 'arc', 'a' | 'b'>>(() => ({
    name: A.name ? 'a' : 'b',
    role: A.role ? 'a' : 'b',
    picture: A.image ? 'a' : 'b',
    colour: 'a',
    arc: story.characterArcs[A.id] ? 'a' : 'b',
  }));
  const rows = useMemo(() => {
    const out: { k: string; title: string; sa?: Section; sb?: Section }[] = [];
    for (const s of A.sections) out.push({ k: key(s), title: s.title, sa: s });
    for (const s of B.sections) {
      const row = out.find((r) => r.k === key(s) && !r.sb);
      if (row) row.sb = s;
      else out.push({ k: key(s) + ':b' + s.id, title: s.title, sb: s });
    }
    return out;
  }, [A, B]);
  const [secPick, setSecPick] = useState<Record<string, Pick>>(() =>
    Object.fromEntries(rows.map((r) => [r.k, r.sa && r.sb ? (filled(r.sb) > filled(r.sa) ? 'b' : 'a') : r.sa ? 'a' : 'b'])),
  );
  const [erasKeep, setErasKeep] = useState(true);

  const apply = () =>
    update((d) => {
      const s = d.stories.find((x) => x.id === story.id) as Draft<Story> | undefined;
      if (!s) return;
      const [keepC, goC] = keep === 'a' ? [A, B] : [B, A];
      const from = (side: 'a' | 'b') => (side === 'a' ? A : B);
      const kept = s.characters.find((c) => c.id === keepC.id)!;
      const goneId = goC.id;
      const keptId = keepC.id;

      // ---- the merged card
      kept.name = from(basics.name).name;
      kept.role = from(basics.role).role;
      kept.image = from(basics.picture).image;
      kept.imageFrame = from(basics.picture).imageFrame;
      kept.color = from(basics.colour).color;
      const sections: Section[] = [];
      for (const r of rows) {
        const pick = secPick[r.k];
        const take = (sec?: Section, fromOther?: boolean) => sec && sections.push(fromOther ? { ...clone(sec), id: uid() } : clone(sec));
        if (pick === 'a' || pick === 'both') take(r.sa, keep !== 'a');
        if (pick === 'b' || pick === 'both') take(r.sb, keep !== 'b');
      }
      kept.sections = sections;
      if (erasKeep) kept.eras = [...(A.eras ?? []), ...(B.eras ?? [])].map((e, i, all) => (all.findIndex((x) => x.id === e.id) === i ? clone(e) : { ...clone(e), id: uid() }));
      kept.links = [...(A.links ?? []), ...(B.links ?? []).filter((l) => !(A.links ?? []).some((x) => x.url === l.url))].map(clone);
      const arc = story.characterArcs[from(basics.arc).id];
      if (arc) s.characterArcs[keptId] = clone(arc);
      s.charCategoryMap[keptId] = [...new Set([...(s.charCategoryMap[A.id] ?? []), ...(s.charCategoryMap[B.id] ?? [])])];

      // ---- move everything that pointed at the duplicate onto the kept one
      for (const r of [...s.relationships]) {
        if (r.from !== goneId && r.to !== goneId) continue;
        const other = r.from === goneId ? r.to : r.from;
        if (other === keptId) {
          s.relationships = s.relationships.filter((x) => x.id !== r.id); // a relationship between the two copies
          continue;
        }
        const nf = r.from === goneId ? keptId : r.from;
        const nt = r.to === goneId ? keptId : r.to;
        const existing = s.relationships.find((x) => x.id !== r.id && ((x.from === nf && x.to === nt) || (x.mutual && x.from === nt && x.to === nf)));
        if (existing) {
          // already related: keep the kept one's record, adding the duplicate's types
          const res = latest(r as any, s.moments as any);
          const res2 = latest(existing as any, s.moments as any);
          const mid = s.moments[res2 ? res2.fromIndex : 0].id;
          existing.states[mid] ??= emptyState();
          const st = existing.states[mid];
          st.typeIds = [...new Set([...st.typeIds, ...(res?.state.typeIds ?? [])])];
          if (!st.feeling && res?.state.feeling) st.feeling = res.state.feeling;
          if (!existing.notes && r.notes) existing.notes = r.notes;
          s.relationships = s.relationships.filter((x) => x.id !== r.id);
        } else {
          r.from = nf;
          r.to = nt;
        }
      }
      const swap = (ids: string[]) => [...new Set(ids.map((x) => (x === goneId ? keptId : x)))];
      s.songs.forEach((x) => (x.characterIds = swap(x.characterIds)));
      s.arcs.forEach((ar) => ar.points.forEach((p) => (p.characterIds = swap(p.characterIds))));
      d.chapters.forEach((c) => c.storyId === s.id && c.povId === goneId && (c.povId = keptId));
      for (const t of s.trees) {
        const gone = t.nodes.find((n) => n.charId === goneId);
        if (!gone) continue;
        const keptNode = t.nodes.find((n) => n.charId === keptId);
        if (!keptNode) gone.charId = keptId;
        else {
          t.links.forEach((l) => {
            if (l.from === gone.id) l.from = keptNode.id;
            if (l.to === gone.id) l.to = keptNode.id;
          });
          t.links = t.links.filter((l) => l.from !== l.to);
          t.nodes = t.nodes.filter((n) => n.id !== gone.id);
        }
      }
      s.relPovs = swap(s.relPovs);
      if (s.relCharts[goneId] && !s.relCharts[keptId]) s.relCharts[keptId] = s.relCharts[goneId];
      delete s.relCharts[goneId];
      for (const k of Object.keys(s.relCharts)) {
        const spots = s.relCharts[k].map((x) => (x.charId === goneId ? { ...x, charId: keptId } : x));
        s.relCharts[k] = spots.filter((x, i) => spots.findIndex((y) => y.charId === x.charId) === i && x.charId !== k);
      }

      // ---- the duplicate goes to the bin (restorable on its own)
      trashCharacter(d, s.id, goneId);
      const last = d.trash[d.trash.length - 1];
      if (last) last.what = `Character (merged into ${kept.name || 'another'})`;
    });

  const Choice = ({ value, onChange, both }: { value: Pick; onChange: (p: Pick) => void; both?: boolean }) => (
    <div className="seg small merge-choice">
      <button className={value === 'a' ? 'on' : ''} onClick={() => onChange('a')}>Left</button>
      <button className={value === 'b' ? 'on' : ''} onClick={() => onChange('b')}>Right</button>
      {both && <button className={value === 'both' ? 'on' : ''} onClick={() => onChange('both')}>Both</button>}
    </div>
  );
  const basicRow = (label: string, k: keyof typeof basics, va: React.ReactNode, vb: React.ReactNode) => (
    <div className="merge-row">
      <span className="merge-label">{label}</span>
      <span className={'merge-cell' + (basics[k] === 'a' ? ' on' : '')} onClick={() => setBasics({ ...basics, [k]: 'a' })}>{va}</span>
      <span className={'merge-cell' + (basics[k] === 'b' ? ' on' : '')} onClick={() => setBasics({ ...basics, [k]: 'b' })}>{vb}</span>
    </div>
  );
  const pic = (c: Character) => (c.image ? <FramedImg src={c.image} frame={c.imageFrame} className="merge-pic" /> : <span className="muted">No picture</span>);

  return (
    <Modal title="Merge two characters" onClose={onClose} wide>
      <p className="muted small">Click the version you want to keep in each row (highlighted). Everything that pointed at either one (relationships, songs, plot points, POV chapters, family-tree spots) ends up on the merged character. The other copy goes to the bin.</p>
      <div className="merge-head">
        <span />
        {([['a', A], ['b', B]] as const).map(([side, c]) => (
          <label key={side} className={'merge-who' + (keep === side ? ' on' : '')}>
            <Avatar c={c} size={36} />
            <span>
              <b>{c.name || 'Unnamed'}</b>
              <span className="muted small">{side === 'a' ? 'Left' : 'Right'}</span>
            </span>
            <span className="small row gap"><input type="radio" checked={keep === side} onChange={() => setKeep(side)} /> keep this one</span>
          </label>
        ))}
      </div>
      <div className="merge-table">
        {basicRow('Name', 'name', A.name || '—', B.name || '—')}
        {basicRow('Role', 'role', A.role || '—', B.role || '—')}
        {basicRow('Picture', 'picture', pic(A), pic(B))}
        {basicRow('Colour', 'colour', <span className="swatch" style={{ background: A.color }} />, <span className="swatch" style={{ background: B.color }} />)}
        {(story.characterArcs[A.id] || story.characterArcs[B.id]) &&
          basicRow('Arc', 'arc', story.characterArcs[A.id]?.start || '—', story.characterArcs[B.id]?.start || '—')}
        {rows.map((r) => (
          <div key={r.k} className="merge-row">
            <span className="merge-label">
              {r.title || 'Untitled section'}
              <Choice value={secPick[r.k]} both={!!(r.sa && r.sb)} onChange={(p) => setSecPick({ ...secPick, [r.k]: p })} />
            </span>
            <span className={'merge-cell small' + (secPick[r.k] === 'a' || secPick[r.k] === 'both' ? ' on' : '')} onClick={() => r.sa && setSecPick({ ...secPick, [r.k]: 'a' })}>
              {r.sa ? preview(r.sa) : <span className="muted">not on this one</span>}
            </span>
            <span className={'merge-cell small' + (secPick[r.k] === 'b' || secPick[r.k] === 'both' ? ' on' : '')} onClick={() => r.sb && setSecPick({ ...secPick, [r.k]: 'b' })}>
              {r.sb ? preview(r.sb) : <span className="muted">not on this one</span>}
            </span>
          </div>
        ))}
        {((A.eras?.length ?? 0) + (B.eras?.length ?? 0) > 0) && (
          <div className="merge-row">
            <span className="merge-label">Looks & eras</span>
            <label className="small row gap" style={{ gridColumn: 'span 2' }}>
              <input type="checkbox" checked={erasKeep} onChange={(e) => setErasKeep(e.target.checked)} /> Keep all looks from both ({(A.eras?.length ?? 0) + (B.eras?.length ?? 0)})
            </label>
          </div>
        )}
      </div>
      <div className="row end gap" style={{ marginTop: 14 }}>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button
          className="btn primary"
          onClick={() => {
            apply();
            onDone();
          }}
        >
          Merge into one
        </button>
      </div>
    </Modal>
  );
}
