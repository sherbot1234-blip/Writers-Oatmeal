import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useStoryCtx } from '../storyContext';
import { Avatar, ColorPick, Empty, Field, Modal } from '../components/ui';
import { REL_PRESETS } from '../defaults';
import { move, uid } from '../util';
import { buildFamilyTree, findRel, isEmptyState, NODE_H, NODE_W, stateAt, typesOf } from '../relations';
import type { Character, FamilyRole, RelState, Story } from '../types';
import type { StoryUpdater } from '../store';

type View = 'cards' | 'web' | 'tree' | 'types';

export default function Relationships() {
  const { story, upd, base } = useStoryCtx();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<View>('cards');
  const [moment, setMoment] = useState(0);
  const [editing, setEditing] = useState<{ from: string; to: string } | null>(null);
  const [editMoments, setEditMoments] = useState(false);
  const chars = story.characters;
  const focusId = chars.some((c) => c.id === params.get('focus')) ? params.get('focus')! : chars[0]?.id;
  const focusIdx = chars.findIndex((c) => c.id === focusId);
  const focus = chars[focusIdx];
  const setFocus = (id: string) => setParams({ focus: id }, { replace: true });
  const m = Math.min(moment, story.moments.length - 1);

  return (
    <div className="page">
      <div className="page-head">
        <h1>Relationships</h1>
        <div className="seg">
          <button className={view === 'cards' ? 'on' : ''} onClick={() => setView('cards')}>Cards</button>
          <button className={view === 'web' ? 'on' : ''} onClick={() => setView('web')}>Web</button>
          <button className={view === 'tree' ? 'on' : ''} onClick={() => setView('tree')}>Family tree</button>
          <button className={view === 'types' ? 'on' : ''} onClick={() => setView('types')}>Types & meters</button>
        </div>
      </div>

      {view !== 'types' && chars.length >= 2 && (
        <MomentBar story={story} value={m} onChange={setMoment} onEdit={() => setEditMoments(true)} />
      )}

      {view === 'types' ? (
        <TypesEditor story={story} upd={upd} />
      ) : chars.length < 2 ? (
        <Empty icon="💞" title="Add at least two characters">
          <Link className="btn" to={`${base}/characters`}>Go to characters</Link>
        </Empty>
      ) : view === 'web' ? (
        <RelWeb
          story={story}
          moment={m}
          onPick={(id) => {
            setFocus(id);
            setView('cards');
          }}
        />
      ) : view === 'tree' ? (
        <FamilyTreeView story={story} moment={m} onPick={(id) => { setFocus(id); setView('cards'); }} />
      ) : (
        <>
          <div className="focus-bar card">
            <button className="icon-btn big" onClick={() => setFocus(chars[(focusIdx - 1 + chars.length) % chars.length].id)} aria-label="Previous character">‹</button>
            <div className="focus-list">
              {chars.map((c) => (
                <button key={c.id} className={'focus-chip' + (c.id === focusId ? ' on' : '')} onClick={() => setFocus(c.id)} style={c.id === focusId ? { borderColor: c.color } : undefined} title={c.name}>
                  <Avatar c={c} size={c.id === focusId ? 48 : 36} />
                  <span>{c.name || 'Unnamed'}</span>
                </button>
              ))}
            </div>
            <button className="icon-btn big" onClick={() => setFocus(chars[(focusIdx + 1) % chars.length].id)} aria-label="Next character">›</button>
          </div>

          <h2 className="focus-title">
            <Avatar c={focus} size={36} /> {focus.name || 'Unnamed'}&rsquo;s relationships
            <span className="muted small"> · {story.moments[m]?.label}</span>
          </h2>
          <div className="rel-grid">
            {chars
              .filter((o) => o.id !== focus.id)
              .map((o) => (
                <PairCard key={o.id} story={story} a={focus} b={o} moment={m} onEdit={(from, to) => setEditing({ from, to })} onFocus={() => setFocus(o.id)} />
              ))}
          </div>
        </>
      )}

      {editing && (
        <RelEditor
          key={editing.from + editing.to}
          story={story}
          from={editing.from}
          to={editing.to}
          moment={m}
          setMoment={setMoment}
          onSwitch={() => setEditing({ from: editing.to, to: editing.from })}
          onClose={() => setEditing(null)}
        />
      )}
      {editMoments && <MomentsEditor story={story} upd={upd} onClose={() => setEditMoments(false)} />}
    </div>
  );
}

// ---------------------------------------------------------------- timeline

function MomentBar({ story, value, onChange, onEdit }: { story: Story; value: number; onChange: (i: number) => void; onEdit: () => void }) {
  const n = story.moments.length;
  return (
    <div className="moment-bar card">
      <span className="moment-label small muted">Story timeline</span>
      <div className="moment-track">
        {n > 1 && (
          <input
            type="range"
            min={0}
            max={n - 1}
            value={value}
            onChange={(e) => onChange(+e.target.value)}
            aria-label="Moment in the story"
            style={{ accentColor: story.theme.accent }}
          />
        )}
        <div className="moment-ticks" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
          {story.moments.map((mo, i) => (
            <button key={mo.id} className={'moment-tick' + (i === value ? ' on' : '')} onClick={() => onChange(i)}>
              {mo.label || `Moment ${i + 1}`}
            </button>
          ))}
        </div>
      </div>
      <button className="btn small ghost" onClick={onEdit} title="Rename, add or remove moments">Edit moments</button>
    </div>
  );
}

function MomentsEditor({ story, upd, onClose }: { story: Story; upd: StoryUpdater; onClose: () => void }) {
  return (
    <Modal title="Story timeline" onClose={onClose}>
      <p className="muted small">
        Moments are the points where relationships can change: acts, chapters, arcs or big events. A relationship stays the same until you change it at a later moment.
      </p>
      {story.moments.map((mo, i) => (
        <div key={mo.id} className="tab-row">
          <input className="input slim" value={mo.label} placeholder={`Moment ${i + 1}`} onChange={(e) => upd((s) => void (s.moments[i].label = e.target.value))} />
          <button className="icon-btn" disabled={i === 0} onClick={() => upd((s) => move(s.moments, i, i - 1))} title="Earlier">↑</button>
          <button className="icon-btn" disabled={i === story.moments.length - 1} onClick={() => upd((s) => move(s.moments, i, i + 1))} title="Later">↓</button>
          <button
            className="icon-btn danger"
            disabled={story.moments.length < 2}
            title="Remove"
            onClick={() => {
              const used = story.relationships.filter((r) => r.states[mo.id]).length;
              if (used && !confirm(`${used} relationship change(s) happen at “${mo.label}”. Remove it anyway? Changes that can't move to the next moment will be lost.`)) return;
              upd((s) => {
                const next = s.moments[i + 1]?.id;
                for (const r of s.relationships) {
                  const st = r.states[mo.id];
                  if (st && next && !r.states[next]) r.states[next] = st;
                  delete r.states[mo.id];
                }
                s.moments.splice(i, 1);
              });
            }}
          >
            🗑
          </button>
        </div>
      ))}
      <div className="row between" style={{ marginTop: 12 }}>
        <button className="btn small" onClick={() => upd((s) => void s.moments.push({ id: uid(), label: `Moment ${s.moments.length + 1}` }))}>+ Moment</button>
        <button className="btn primary" onClick={onClose}>Done</button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- cards

function Badges({ story, st }: { story: Story; st?: RelState }) {
  const types = typesOf(story, st);
  if (!types.length) return null;
  return (
    <span className="badges">
      {types.map((t) => (
        <span key={t.id} className="badge" style={{ background: t.color }}>{t.emoji} {t.label}</span>
      ))}
    </span>
  );
}

function MiniMeters({ story, st }: { story: Story; st?: RelState }) {
  const set = story.relMeters.filter((mt) => st?.values[mt.id] !== undefined);
  if (!set.length) return null;
  return (
    <span className="mini-meters">
      {set.map((mt) => (
        <span key={mt.id} className="mini-meter" title={`${mt.label}: ${st!.values[mt.id]}/10`}>
          <span className="mini-meter-label">{mt.label}</span>
          <span className="bar-track"><span className="bar-fill" style={{ width: st!.values[mt.id] * 10 + '%', background: mt.color }} /></span>
        </span>
      ))}
    </span>
  );
}

function DirRow({ story, from, to, moment, onEdit }: { story: Story; from: Character; to: Character; moment: number; onEdit: () => void }) {
  const res = stateAt(findRel(story, from.id, to.id), story.moments, moment);
  const st = res?.state;
  const types = typesOf(story, st);
  const changedHere = res && res.fromIndex === moment && moment > 0;
  return (
    <button className="dir-row" onClick={onEdit} style={types[0] ? { borderLeftColor: types[0].color } : undefined}>
      <span className="dir-who small muted">
        {from.name || 'Unnamed'} → {to.name || 'Unnamed'}
        {changedHere && <span className="changed-tag">changed here</span>}
      </span>
      {types.length ? <Badges story={story} st={st} /> : !st?.feeling && <span className="muted small">+ Set how {from.name || 'they'} sees {to.name || 'them'}</span>}
      {st?.feeling && <span className="dir-feel">“{st.feeling}”</span>}
      <MiniMeters story={story} st={st} />
    </button>
  );
}

function PairCard({ story, a, b, moment, onEdit, onFocus }: { story: Story; a: Character; b: Character; moment: number; onEdit: (from: string, to: string) => void; onFocus: () => void }) {
  return (
    <div className="card pair">
      <button className="pair-head" onClick={onFocus} title={`Switch to ${b.name}'s view`}>
        <Avatar c={b} size={44} />
        <div>
          <b>{b.name || 'Unnamed'}</b>
          {b.role && <div className="muted small">{b.role}</div>}
        </div>
        <span className="muted small pair-switch">⇄ view</span>
      </button>
      <DirRow story={story} from={a} to={b} moment={moment} onEdit={() => onEdit(a.id, b.id)} />
      <DirRow story={story} from={b} to={a} moment={moment} onEdit={() => onEdit(b.id, a.id)} />
    </div>
  );
}

// ---------------------------------------------------------------- editor

function RelEditor({
  story,
  from,
  to,
  moment,
  setMoment,
  onSwitch,
  onClose,
}: {
  story: Story;
  from: string;
  to: string;
  moment: number;
  setMoment: (i: number) => void;
  onSwitch: () => void;
  onClose: () => void;
}) {
  const { upd } = useStoryCtx();
  const a = story.characters.find((c) => c.id === from)!;
  const b = story.characters.find((c) => c.id === to)!;
  const rel = findRel(story, from, to);
  const res = stateAt(rel, story.moments, moment);
  const st: RelState = res?.state ?? { typeIds: [], feeling: '', values: {} };
  const momentId = story.moments[moment].id;
  const setHere = !!rel?.states[momentId];
  const inheritedFrom = res && res.fromIndex !== moment ? story.moments[res.fromIndex] : undefined;

  /** Edits the state at this moment, starting from whatever it inherited. */
  const edit = (fn: (s: RelState) => void) =>
    upd((s) => {
      let r = s.relationships.find((x) => x.from === from && x.to === to);
      if (!r) {
        r = { id: uid(), from, to, notes: '', states: {} };
        s.relationships.push(r);
        r = s.relationships[s.relationships.length - 1];
      }
      if (!r.states[momentId]) {
        const inherited = stateAt(r as any, s.moments as any, moment)?.state;
        r.states[momentId] = inherited ? JSON.parse(JSON.stringify(inherited)) : { typeIds: [], feeling: '', values: {} };
      }
      fn(r.states[momentId]);
    });

  const haveLabels = new Set(story.relTypes.map((t) => t.label.toLowerCase()));
  const presetsLeft = REL_PRESETS.filter((p) => !haveLabels.has(p.label.toLowerCase()));
  const toggleType = (id: string) => edit((x) => void (x.typeIds = x.typeIds.includes(id) ? x.typeIds.filter((t) => t !== id) : [...x.typeIds, id]));

  return (
    <Modal
      wide
      onClose={onClose}
      title={
        <span className="row gap wrap">
          <Avatar c={a} size={28} /> How {a.name || 'Unnamed'} sees <Avatar c={b} size={28} /> {b.name || 'Unnamed'}
        </span>
      }
    >
      <div className="row gap wrap">
        <button className="btn small" onClick={onSwitch}>⇄ Switch perspective</button>
        {story.moments.length > 1 && (
          <div className="seg small moment-seg">
            {story.moments.map((mo, i) => (
              <button key={mo.id} className={i === moment ? 'on' : ''} onClick={() => setMoment(i)}>
                {rel?.states[mo.id] ? '● ' : ''}{mo.label || `Moment ${i + 1}`}
              </button>
            ))}
          </div>
        )}
      </div>
      {story.moments.length > 1 && (
        <p className="muted small" style={{ marginBottom: 0 }}>
          {setHere
            ? moment === 0
              ? `This is how it starts. Later moments keep this until you change them.`
              : `Changed at “${story.moments[moment].label}”.`
            : inheritedFrom
              ? `Same as at “${inheritedFrom.label}”. Edit anything to record a change at “${story.moments[moment].label}”.`
              : `Nothing set yet at “${story.moments[moment].label}”.`}
        </p>
      )}

      <label className="lbl">Relationship <span className="muted">(pick as many as fit)</span></label>
      <div className="type-grid">
        {story.relTypes.map((t) => (
          <button key={t.id} className={'type-opt' + (st.typeIds.includes(t.id) ? ' on' : '')} style={{ ['--tc' as any]: t.color }} onClick={() => toggleType(t.id)}>
            <span>{t.emoji}</span> {t.label}
          </button>
        ))}
      </div>

      {presetsLeft.length > 0 && (
        <details className="more-types">
          <summary className="small">+ More templates ({presetsLeft.length})</summary>
          <div className="chip-row">
            {presetsLeft.map((p) => (
              <button
                key={p.label}
                className="chip"
                onClick={() => {
                  const id = uid();
                  upd((s) => void s.relTypes.push({ ...p, id }));
                  toggleType(id);
                }}
              >
                {p.emoji} {p.label} +
              </button>
            ))}
          </div>
        </details>
      )}

      <label className="lbl">How does {a.name || 'this character'} feel about {b.name || 'them'}?</label>
      <input className="input" value={st.feeling} placeholder="e.g. Trusts them with her life, but would never admit it" onChange={(e) => edit((x) => void (x.feeling = e.target.value))} />

      {story.relMeters.length > 0 && (
        <>
          <label className="lbl">Intensity</label>
          <div className="meters">
            {story.relMeters.map((mt) => {
              const v = st.values[mt.id];
              return (
                <div key={mt.id} className={'meter-line' + (v === undefined ? ' unset' : '')}>
                  <span>{mt.label}</span>
                  <input type="range" min={0} max={10} value={v ?? 5} style={{ accentColor: mt.color }} onChange={(e) => edit((x) => void (x.values[mt.id] = +e.target.value))} />
                  <span className="bar-val">{v ?? '—'}</span>
                  {v !== undefined ? (
                    <button className="icon-btn tiny" title="Clear" onClick={() => edit((x) => void delete x.values[mt.id])}>×</button>
                  ) : <span />}
                </div>
              );
            })}
          </div>
        </>
      )}

      <label className="lbl">Notes <span className="muted">(for the whole story)</span></label>
      <Field
        multiline
        className="input"
        value={rel?.notes ?? ''}
        placeholder="History, key moments, how it changes over the story…"
        onChange={(v) =>
          upd((s) => {
            const r = s.relationships.find((x) => x.from === from && x.to === to);
            if (r) r.notes = v;
            else s.relationships.push({ id: uid(), from, to, notes: v, states: {} });
          })
        }
      />

      <div className="row gap wrap" style={{ marginTop: 16 }}>
        {st.typeIds.length > 0 && (
          <button
            className="btn small ghost"
            onClick={() =>
              upd((s) => {
                let r = s.relationships.find((x) => x.from === to && x.to === from);
                if (!r) {
                  s.relationships.push({ id: uid(), from: to, to: from, notes: '', states: {} });
                  r = s.relationships[s.relationships.length - 1];
                }
                const cur = r.states[momentId] ?? (stateAt(r as any, s.moments as any, moment)?.state ? JSON.parse(JSON.stringify(stateAt(r as any, s.moments as any, moment)!.state)) : { typeIds: [], feeling: '', values: {} });
                cur.typeIds = [...st.typeIds];
                r.states[momentId] = cur;
              })
            }
          >
            Make it mutual
          </button>
        )}
        {setHere && moment > 0 && (
          <button className="btn small ghost" onClick={() => upd((s) => void delete s.relationships.find((x) => x.id === rel!.id)!.states[momentId])}>
            Undo change at this moment
          </button>
        )}
        {rel && (
          <button
            className="btn small ghost danger"
            onClick={() => confirm('Remove this relationship at every moment?') && upd((s) => void (s.relationships = s.relationships.filter((x) => x.id !== rel.id)))}
          >
            Remove relationship
          </button>
        )}
        <span style={{ flex: 1 }} />
        <button
          className="btn primary"
          onClick={() => {
            // don't leave empty "changes" behind
            if (rel && setHere && moment > 0 && isEmptyState(st) && !inheritedFrom) upd((s) => void delete s.relationships.find((x) => x.id === rel.id)!.states[momentId]);
            onClose();
          }}
        >
          Done
        </button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- web

function RelWeb({ story, moment, onPick }: { story: Story; moment: number; onPick: (id: string) => void }) {
  const [hidden, setHidden] = useState<string[]>([]);
  const chars = story.characters;
  const size = 640;
  const R = size / 2 - 70;
  const pos = new Map(
    chars.map((c, i) => {
      const a = (Math.PI * 2 * i) / chars.length - Math.PI / 2;
      return [c.id, { x: size / 2 + Math.cos(a) * R, y: size / 2 + Math.sin(a) * R }];
    }),
  );
  const edges = story.relationships
    .filter((r) => pos.has(r.from) && pos.has(r.to))
    .map((r) => ({ r, types: typesOf(story, stateAt(r, story.moments, moment)?.state).filter((t) => !hidden.includes(t.id)) }))
    .filter((e) => e.types.length);
  const used = story.relTypes.filter((t) => story.relationships.some((r) => typesOf(story, stateAt(r, story.moments, moment)?.state).some((x) => x.id === t.id)));

  return (
    <div className="card web">
      <div className="chip-row">
        {used.map((t) => {
          const off = hidden.includes(t.id);
          return (
            <button key={t.id} className={'chip' + (off ? '' : ' on')} style={off ? undefined : { borderColor: t.color, background: t.color + '33' }} onClick={() => setHidden(off ? hidden.filter((x) => x !== t.id) : [...hidden, t.id])}>
              {t.emoji} {t.label}
            </button>
          );
        })}
        {!used.length && <span className="muted small">No relationships at this moment. Use the Cards view to add some.</span>}
      </div>
      <svg viewBox={`0 0 ${size} ${size}`} className="web-svg">
        <defs>
          {story.relTypes.map((t) => (
            <marker key={t.id} id={'arrow-' + t.id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill={t.color} />
            </marker>
          ))}
          {chars.map((c) => (
            <clipPath key={c.id} id={'clip-' + c.id}>
              <circle r={26} />
            </clipPath>
          ))}
        </defs>
        {edges.map(({ r, types }) => {
          const t = types[0];
          const p1 = pos.get(r.from)!;
          const p2 = pos.get(r.to)!;
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const len = Math.hypot(dx, dy) || 1;
          const ux = dx / len, uy = dy / len;
          const nx = -uy * 9, ny = ux * 9; // offset so A→B and B→A sit side by side
          const s = { x: p1.x + ux * 32 + nx, y: p1.y + uy * 32 + ny };
          const e = { x: p2.x - ux * 34 + nx, y: p2.y - uy * 34 + ny };
          const mid = { x: (s.x + e.x) / 2 + nx * 2, y: (s.y + e.y) / 2 + ny * 2 };
          return (
            <g key={r.id}>
              <path d={`M${s.x},${s.y} Q${mid.x},${mid.y} ${e.x},${e.y}`} stroke={t.color} strokeWidth={2.5} fill="none" markerEnd={`url(#arrow-${t.id})`} opacity={0.9} />
              <text x={mid.x} y={mid.y} fontSize={14} textAnchor="middle" dominantBaseline="middle">{types.map((x) => x.emoji).join('')}</text>
            </g>
          );
        })}
        {chars.map((c) => (
          <Node key={c.id} c={c} x={pos.get(c.id)!.x} y={pos.get(c.id)!.y} onClick={() => onPick(c.id)} />
        ))}
      </svg>
      <p className="muted small">Arrows point from a character to the person they feel that way about. Move the timeline to watch relationships change. Click a character to see their cards.</p>
    </div>
  );
}

function Node({ c, x, y, onClick }: { c: Character; x: number; y: number; onClick: () => void }) {
  const initials = (c.name || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <g transform={`translate(${x},${y})`} className="web-node" onClick={onClick}>
      <circle r={29} fill={c.color} />
      {c.image ? (
        <image href={c.image} x={-26} y={-26} width={52} height={52} clipPath={`url(#clip-${c.id})`} preserveAspectRatio="xMidYMid slice" />
      ) : (
        <text textAnchor="middle" dominantBaseline="central" fill="#fff" fontWeight={700} fontSize={16}>{initials}</text>
      )}
      <text y={46} textAnchor="middle" className="web-label">{c.name || 'Unnamed'}</text>
    </g>
  );
}

// ---------------------------------------------------------------- family tree

function FamilyTreeView({ story, moment, onPick }: { story: Story; moment: number; onPick: (id: string) => void }) {
  const tree = buildFamilyTree(story, story.characters, moment);
  const familyTypes = story.relTypes.filter((t) => t.family);
  if (!tree)
    return (
      <Empty icon="🌳" title="No family links yet">
        <p className="muted">
          The tree is drawn from relationships whose type has a family role:{' '}
          {familyTypes.length ? familyTypes.map((t) => `${t.emoji} ${t.label}`).join(', ') : 'none yet'}. Set roles under <b>Types & meters</b>.
          <br />
          For example, set <i>Hayashi → his mother: Parent</i> or <i>Hayashi → his aunt: Adoptive parent</i>.
        </p>
      </Empty>
    );
  const byId = new Map(tree.nodes.map((n) => [n.id, n]));
  const chars = new Map(story.characters.map((c) => [c.id, c]));
  const cx = (id: string) => byId.get(id)!.x + NODE_W / 2;
  const top = (id: string) => byId.get(id)!.y;
  const bottom = (id: string) => byId.get(id)!.y + NODE_H;

  return (
    <div className="card tree-wrap">
      <div className="tree-scroll">
        <svg width={tree.width} height={tree.height} className="tree-svg" role="img" aria-label="Family tree">
          <defs>
            {story.characters.map((c) => (
              <clipPath key={c.id} id={'tclip-' + c.id}>
                <circle cx={NODE_W / 2} cy={30} r={24} />
              </clipPath>
            ))}
          </defs>
          {/* parent → child lines */}
          {tree.childEdges.map((e, i) => {
            const px = e.parents.reduce((n, p) => n + cx(p), 0) / e.parents.length;
            const py = Math.max(...e.parents.map(bottom)) - (e.parents.length > 1 ? NODE_H / 2 : 0);
            const midY = top(e.child) - 26;
            return (
              <path
                key={i}
                d={`M${px},${py} V${midY} H${cx(e.child)} V${top(e.child)}`}
                fill="none"
                stroke="currentColor"
                strokeOpacity={0.45}
                strokeWidth={2}
                strokeDasharray={e.adoptive ? '6 5' : undefined}
              />
            );
          })}
          {/* spouses */}
          {tree.spouses.map(([a, b], i) => {
            const [l, r] = byId.get(a)!.x < byId.get(b)!.x ? [a, b] : [b, a];
            const y = top(l) + NODE_H / 2;
            return (
              <g key={i} stroke="#c9184a" strokeOpacity={0.7} strokeWidth={2}>
                <line x1={byId.get(l)!.x + NODE_W} y1={y - 3} x2={byId.get(r)!.x} y2={y - 3} />
                <line x1={byId.get(l)!.x + NODE_W} y1={y + 3} x2={byId.get(r)!.x} y2={y + 3} />
              </g>
            );
          })}
          {/* siblings without shared parents */}
          {tree.siblingLinks.map(([a, b], i) => {
            const y = top(a) - 12;
            return <path key={i} d={`M${cx(a)},${top(a)} V${y} H${cx(b)} V${top(b)}`} fill="none" stroke="#ddb34c" strokeWidth={2} strokeDasharray="3 4" />;
          })}
          {tree.nodes.map((n) => {
            const c = chars.get(n.id)!;
            const initials = (c.name || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
            return (
              <g key={n.id} transform={`translate(${n.x},${n.y})`} className="tree-node" onClick={() => onPick(n.id)}>
                <rect width={NODE_W} height={NODE_H} rx={12} className="tree-card" style={{ stroke: c.color }} />
                <circle cx={NODE_W / 2} cy={30} r={25} fill={c.color} />
                {c.image ? (
                  <image href={c.image} x={NODE_W / 2 - 24} y={6} width={48} height={48} clipPath={`url(#tclip-${c.id})`} preserveAspectRatio="xMidYMid slice" />
                ) : (
                  <text x={NODE_W / 2} y={30} textAnchor="middle" dominantBaseline="central" fill="#fff" fontWeight={700} fontSize={15}>{initials}</text>
                )}
                <text x={NODE_W / 2} y={72} textAnchor="middle" className="tree-name">{(c.name || 'Unnamed').slice(0, 16)}</text>
                {c.role && <text x={NODE_W / 2} y={87} textAnchor="middle" className="tree-role">{c.role.slice(0, 18)}</text>}
              </g>
            );
          })}
        </svg>
      </div>
      <p className="muted small">
        Solid lines: parents. Dashed: adoptive. Pink double lines: spouses. Built from {familyTypes.map((t) => t.label).join(', ')} links. Click someone to open their cards.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- types & meters

const FAMILY_OPTIONS: { value: FamilyRole | ''; label: string }[] = [
  { value: '', label: 'Not in family tree' },
  { value: 'parent', label: 'Tree: they are my parent' },
  { value: 'child', label: 'Tree: they are my child' },
  { value: 'sibling', label: 'Tree: sibling' },
  { value: 'spouse', label: 'Tree: spouse / partner' },
  { value: 'adoptive-parent', label: 'Tree: adoptive parent' },
  { value: 'adoptive-child', label: 'Tree: adopted child' },
];

function TypesEditor({ story, upd }: { story: Story; upd: StoryUpdater }) {
  const have = new Set(story.relTypes.map((t) => t.label.toLowerCase()));
  const presetsLeft = REL_PRESETS.filter((p) => !have.has(p.label.toLowerCase()));
  const count = (id: string) => story.relationships.filter((r) => Object.values(r.states).some((s) => s.typeIds.includes(id))).length;

  return (
    <>
      <section className="card">
        <h2 className="sec-title">Relationship types</h2>
        <p className="muted small">The templates you pick from in this story. Rename them, change emoji and colour, choose where they go in the family tree, or add your own (e.g. “Sworn Blade”, “Blood Debt”).</p>
        <div className="types-list">
          {story.relTypes.map((t, i) => (
            <div key={t.id} className="type-row">
              <input className="emoji-input" value={t.emoji} onChange={(e) => upd((s) => void (s.relTypes[i].emoji = e.target.value))} aria-label="Emoji" />
              <Field value={t.label} placeholder="Name" onChange={(v) => upd((s) => void (s.relTypes[i].label = v))} />
              <select className="input slim family-select" value={t.family ?? ''} onChange={(e) => upd((s) => void (s.relTypes[i].family = (e.target.value || undefined) as FamilyRole | undefined))}>
                {FAMILY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <ColorPick value={t.color} onChange={(v) => upd((s) => void (s.relTypes[i].color = v))} />
              <span className="muted small">{count(t.id)} used</span>
              <button
                className="icon-btn danger"
                title="Delete"
                onClick={() => {
                  const n = count(t.id);
                  if (n && !confirm(`${n} relationship(s) use “${t.label}”. It will be removed from them. Continue?`)) return;
                  upd((s) => {
                    s.relTypes.splice(i, 1);
                    for (const r of s.relationships) for (const st of Object.values(r.states)) st.typeIds = st.typeIds.filter((x) => x !== t.id);
                  });
                }}
              >
                🗑
              </button>
            </div>
          ))}
        </div>
        <button className="btn small" onClick={() => upd((s) => void s.relTypes.push({ id: uid(), label: 'New type', emoji: '✨', color: '#888888' }))}>+ Custom type</button>
      </section>
      {presetsLeft.length > 0 && (
        <section className="card">
          <h2 className="sec-title">Add from templates</h2>
          <div className="chip-row">
            {presetsLeft.map((p) => (
              <button key={p.label} className="chip" onClick={() => upd((s) => void s.relTypes.push({ ...p, id: uid() }))}>
                {p.emoji} {p.label} +
              </button>
            ))}
          </div>
        </section>
      )}
      <section className="card">
        <h2 className="sec-title">Intensity meters</h2>
        <p className="muted small">Sliders shown on every relationship in this story, rated 0–10, e.g. Trust, Fear, Loyalty, Suspicion.</p>
        <div className="types-list">
          {story.relMeters.map((mt, i) => (
            <div key={mt.id} className="meter-row">
              <Field value={mt.label} placeholder="Meter name" onChange={(v) => upd((s) => void (s.relMeters[i].label = v))} />
              <ColorPick value={mt.color} onChange={(v) => upd((s) => void (s.relMeters[i].color = v))} />
              <button className="icon-btn" onClick={() => upd((s) => move(s.relMeters, i, i - 1))} title="Up">↑</button>
              <button
                className="icon-btn danger"
                title="Delete"
                onClick={() =>
                  confirm(`Remove the “${mt.label}” meter from every relationship?`) &&
                  upd((s) => {
                    s.relMeters.splice(i, 1);
                    for (const r of s.relationships) for (const st of Object.values(r.states)) delete st.values[mt.id];
                  })
                }
              >
                🗑
              </button>
            </div>
          ))}
        </div>
        <button className="btn small" onClick={() => upd((s) => void s.relMeters.push({ id: uid(), label: 'New meter', color: '#3a86ff' }))}>+ Meter</button>
      </section>
    </>
  );
}
