import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useStoryCtx } from '../storyContext';
import { Avatar, ColorPick, Empty, Field, Modal } from '../components/ui';
import { REL_PRESETS } from '../defaults';
import { uid } from '../util';
import type { Character, RelType, Relationship, Story } from '../types';

type View = 'cards' | 'web' | 'types';

export default function Relationships() {
  const { story, upd } = useStoryCtx();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<View>('cards');
  const [editing, setEditing] = useState<{ from: string; to: string } | null>(null);
  const chars = story.characters;
  const focusId = chars.some((c) => c.id === params.get('focus')) ? params.get('focus')! : chars[0]?.id;
  const focusIdx = chars.findIndex((c) => c.id === focusId);
  const focus = chars[focusIdx];
  const setFocus = (id: string) => setParams({ focus: id }, { replace: true });

  return (
    <div className="page">
      <div className="page-head">
        <h1>Relationships</h1>
        <div className="seg">
          <button className={view === 'cards' ? 'on' : ''} onClick={() => setView('cards')}>Cards</button>
          <button className={view === 'web' ? 'on' : ''} onClick={() => setView('web')}>Web</button>
          <button className={view === 'types' ? 'on' : ''} onClick={() => setView('types')}>Relationship types</button>
        </div>
      </div>

      {view === 'types' ? (
        <TypesEditor story={story} upd={upd} />
      ) : chars.length < 2 ? (
        <Empty icon="💞" title="Add at least two characters">
          <Link className="btn" to={`/story/${story.id}/characters`}>Go to characters</Link>
        </Empty>
      ) : view === 'web' ? (
        <RelWeb
          story={story}
          onPick={(id) => {
            setFocus(id);
            setView('cards');
          }}
        />
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
          </h2>
          <div className="rel-grid">
            {chars
              .filter((o) => o.id !== focus.id)
              .map((o) => (
                <PairCard key={o.id} story={story} a={focus} b={o} onEdit={(from, to) => setEditing({ from, to })} onFocus={() => setFocus(o.id)} />
              ))}
          </div>
        </>
      )}

      {editing && <RelEditor key={editing.from + editing.to} story={story} from={editing.from} to={editing.to} onSwitch={() => setEditing({ from: editing.to, to: editing.from })} onClose={() => setEditing(null)} />}
    </div>
  );
}

const findRel = (s: Story, from: string, to: string) => s.relationships.find((r) => r.from === from && r.to === to);

function DirRow({ story, from, to, onEdit }: { story: Story; from: Character; to: Character; onEdit: () => void }) {
  const rel = findRel(story, from.id, to.id);
  const type = rel && story.relTypes.find((t) => t.id === rel.typeId);
  return (
    <button className="dir-row" onClick={onEdit} style={type ? { borderLeftColor: type.color } : undefined}>
      <span className="dir-who small muted">
        {from.name || 'Unnamed'} → {to.name || 'Unnamed'}
      </span>
      {type ? (
        <span className="badge" style={{ background: type.color }}>
          {type.emoji} {type.label}
        </span>
      ) : (
        <span className="muted small">+ Set how {from.name || 'they'} sees {to.name || 'them'}</span>
      )}
      {rel?.feeling && <span className="dir-feel">“{rel.feeling}”</span>}
    </button>
  );
}

function PairCard({ story, a, b, onEdit, onFocus }: { story: Story; a: Character; b: Character; onEdit: (from: string, to: string) => void; onFocus: () => void }) {
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
      <DirRow story={story} from={a} to={b} onEdit={() => onEdit(a.id, b.id)} />
      <DirRow story={story} from={b} to={a} onEdit={() => onEdit(b.id, a.id)} />
    </div>
  );
}

function RelEditor({ story, from, to, onSwitch, onClose }: { story: Story; from: string; to: string; onSwitch: () => void; onClose: () => void }) {
  const { upd } = useStoryCtx();
  const a = story.characters.find((c) => c.id === from)!;
  const b = story.characters.find((c) => c.id === to)!;
  const rel = findRel(story, from, to);
  const reverse = findRel(story, to, from);

  const set = (patch: Partial<Relationship>) =>
    upd((s) => {
      let r = s.relationships.find((x) => x.from === from && x.to === to);
      if (!r) {
        r = { id: uid(), from, to, typeId: '', feeling: '', notes: '' };
        s.relationships.push(r);
      }
      Object.assign(r, patch);
    });

  return (
    <Modal
      wide
      onClose={onClose}
      title={
        <span className="row gap">
          <Avatar c={a} size={28} /> How {a.name || 'Unnamed'} sees <Avatar c={b} size={28} /> {b.name || 'Unnamed'}
        </span>
      }
    >
      <button className="btn small" onClick={onSwitch}>⇄ Switch perspective: how {b.name || 'they'} see{b.name ? 's' : ''} {a.name || 'them'}</button>

      <label className="lbl">Relationship</label>
      <div className="type-grid">
        {story.relTypes.map((t) => (
          <button key={t.id} className={'type-opt' + (rel?.typeId === t.id ? ' on' : '')} style={{ ['--tc' as any]: t.color }} onClick={() => set({ typeId: rel?.typeId === t.id ? '' : t.id })}>
            <span>{t.emoji}</span> {t.label}
          </button>
        ))}
      </div>

      <label className="lbl">How does {a.name || 'this character'} feel about {b.name || 'them'}?</label>
      <input className="input" value={rel?.feeling ?? ''} placeholder="e.g. Trusts them with her life, but would never admit it" onChange={(e) => set({ feeling: e.target.value })} />

      <label className="lbl">Notes</label>
      <Field multiline className="input" value={rel?.notes ?? ''} placeholder="History, key moments, how it changes over the story…" onChange={(v) => set({ notes: v })} />

      <div className="row gap wrap" style={{ marginTop: 16 }}>
        {rel?.typeId && (
          <button
            className="btn small ghost"
            onClick={() =>
              upd((s) => {
                const r = s.relationships.find((x) => x.from === to && x.to === from);
                if (r) r.typeId = rel.typeId;
                else s.relationships.push({ id: uid(), from: to, to: from, typeId: rel.typeId, feeling: '', notes: '' });
              })
            }
          >
            Make it mutual{reverse?.typeId && reverse.typeId !== rel.typeId ? ' (overwrite their side)' : ''}
          </button>
        )}
        {rel && (
          <button className="btn small ghost danger" onClick={() => upd((s) => void (s.relationships = s.relationships.filter((x) => x.id !== rel.id)))}>
            Clear
          </button>
        )}
        <span style={{ flex: 1 }} />
        <button className="btn primary" onClick={onClose}>Done</button>
      </div>
    </Modal>
  );
}

function RelWeb({ story, onPick }: { story: Story; onPick: (id: string) => void }) {
  const [hidden, setHidden] = useState<string[]>([]);
  const chars = story.characters;
  const size = 640;
  const R = size / 2 - 70;
  const pos = new Map(chars.map((c, i) => {
    const a = (Math.PI * 2 * i) / chars.length - Math.PI / 2;
    return [c.id, { x: size / 2 + Math.cos(a) * R, y: size / 2 + Math.sin(a) * R }];
  }));
  const used = story.relTypes.filter((t) => story.relationships.some((r) => r.typeId === t.id));
  const rels = story.relationships.filter((r) => r.typeId && !hidden.includes(r.typeId) && pos.has(r.from) && pos.has(r.to));

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
        {!used.length && <span className="muted small">No relationships set yet — use the Cards view to add some.</span>}
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
        {rels.map((r) => {
          const t = story.relTypes.find((x) => x.id === r.typeId)!;
          const p1 = pos.get(r.from)!;
          const p2 = pos.get(r.to)!;
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const len = Math.hypot(dx, dy) || 1;
          const ux = dx / len, uy = dy / len;
          // offset perpendicular so A→B and B→A sit side by side
          const nx = -uy * 9, ny = ux * 9;
          const s = { x: p1.x + ux * 32 + nx, y: p1.y + uy * 32 + ny };
          const e = { x: p2.x - ux * 34 + nx, y: p2.y - uy * 34 + ny };
          const m = { x: (s.x + e.x) / 2 + nx * 2, y: (s.y + e.y) / 2 + ny * 2 };
          return (
            <g key={r.id}>
              <path d={`M${s.x},${s.y} Q${m.x},${m.y} ${e.x},${e.y}`} stroke={t.color} strokeWidth={2.5} fill="none" markerEnd={`url(#arrow-${t.id})`} opacity={0.9} />
              <text x={m.x} y={m.y} fontSize={14} textAnchor="middle" dominantBaseline="middle">{t.emoji}</text>
            </g>
          );
        })}
        {chars.map((c) => {
          const p = pos.get(c.id)!;
          const initials = (c.name || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
          return (
            <g key={c.id} transform={`translate(${p.x},${p.y})`} className="web-node" onClick={() => onPick(c.id)}>
              <circle r={29} fill={c.color} />
              {c.image ? (
                <image href={c.image} x={-26} y={-26} width={52} height={52} clipPath={`url(#clip-${c.id})`} preserveAspectRatio="xMidYMid slice" />
              ) : (
                <text textAnchor="middle" dominantBaseline="central" fill="#fff" fontWeight={700} fontSize={16}>{initials}</text>
              )}
              <text y={46} textAnchor="middle" className="web-label">{c.name || 'Unnamed'}</text>
            </g>
          );
        })}
      </svg>
      <p className="muted small">Arrows point from a character to the person they feel that way about. Click a character to see their cards.</p>
    </div>
  );
}

function TypesEditor({ story, upd }: { story: Story; upd: ReturnType<typeof useStoryCtx>['upd'] }) {
  const have = new Set(story.relTypes.map((t) => t.label.toLowerCase()));
  const presetsLeft = REL_PRESETS.filter((p) => !have.has(p.label.toLowerCase()));
  const count = (t: RelType) => story.relationships.filter((r) => r.typeId === t.id).length;

  return (
    <>
      <section className="card">
        <p className="muted small">These are the relationship templates you can pick from in this story. Rename them, change their emoji and colour, or add your own (e.g. “Sworn Blade”, “Blood Debt”).</p>
        <div className="types-list">
          {story.relTypes.map((t, i) => (
            <div key={t.id} className="type-row">
              <input className="emoji-input" value={t.emoji} onChange={(e) => upd((s) => void (s.relTypes[i].emoji = e.target.value))} aria-label="Emoji" />
              <Field value={t.label} placeholder="Name" onChange={(v) => upd((s) => void (s.relTypes[i].label = v))} />
              <ColorPick value={t.color} onChange={(v) => upd((s) => void (s.relTypes[i].color = v))} />
              <span className="muted small">{count(t)} used</span>
              <button
                className="icon-btn danger"
                title="Delete"
                onClick={() => {
                  const n = count(t);
                  if (n && !confirm(`${n} relationship(s) use “${t.label}”. They'll be cleared. Continue?`)) return;
                  upd((s) => {
                    s.relTypes.splice(i, 1);
                    s.relationships = s.relationships.filter((r) => r.typeId !== t.id);
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
    </>
  );
}
