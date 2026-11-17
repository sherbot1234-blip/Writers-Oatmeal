import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { Draft } from 'immer';
import { useStoryCtx } from '../storyContext';
import { Avatar, CharacterChips, ColorPick, Empty, Field, Modal } from '../components/ui';
import { REL_PRESETS } from '../defaults';
import { move, uid } from '../util';
import { emptyState, isEmptyState, latest, partnersOf, relFor, stateAt, typesOf } from '../relations';
import { groupCharacters } from '../categories';
import type { Character, Relationship, RelState, Story } from '../types';
import type { StoryUpdater } from '../store';

type View = 'cards' | 'web' | 'types';

/** Applies an edit to the state that's in effect by the end of the story (where it was last set). */
function editLatest(s: Draft<Story>, r: Draft<Relationship>, fn: (st: RelState) => void) {
  const res = latest(r as Relationship, s.moments as Story['moments']);
  const mid = s.moments[res ? res.fromIndex : 0].id;
  r.states[mid] ??= emptyState();
  fn(r.states[mid] as RelState);
}

export default function Relationships() {
  const { story, upd, base } = useStoryCtx();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<View>('cards');
  const [details, setDetails] = useState<{ from: string; to: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const chars = story.characters;
  const focusId = chars.some((c) => c.id === params.get('focus')) ? params.get('focus')! : chars[0]?.id;
  const focusIdx = chars.findIndex((c) => c.id === focusId);
  const focus = chars[focusIdx];
  const setFocus = (id: string) => {
    setParams({ focus: id }, { replace: true });
    setAdding(false);
  };
  const others = focus ? partnersOf(story, focus.id).map((id) => chars.find((c) => c.id === id)).filter((c): c is Character => !!c) : [];

  return (
    <div className="page">
      <div className="page-head">
        <h1>Relationships</h1>
        <div className="seg">
          <button className={view === 'cards' ? 'on' : ''} onClick={() => setView('cards')}>Cards</button>
          <button className={view === 'web' ? 'on' : ''} onClick={() => setView('web')}>Web</button>
          <button className={view === 'types' ? 'on' : ''} onClick={() => setView('types')}>Types & meters</button>
        </div>
      </div>

      {view === 'types' ? (
        <TypesEditor story={story} upd={upd} />
      ) : chars.length < 2 ? (
        <Empty icon="💞" title="Add at least two characters">
          <Link className="btn" to={`${base}/characters`}>Go to characters</Link>
        </Empty>
      ) : view === 'web' ? (
        <RelWeb story={story} onPick={(id) => { setFocus(id); setView('cards'); }} />
      ) : (
        <>
          <div className="focus-bar card">
            <button className="icon-btn big" onClick={() => setFocus(chars[(focusIdx - 1 + chars.length) % chars.length].id)} aria-label="Previous character">‹</button>
            <div className="focus-list">
              {groupCharacters(story, chars).map((g, gi) => (
                <div key={g.cat?.id ?? 'none' + gi} className="focus-group">
                  {story.charCategories.length > 0 && <span className="focus-group-label" style={g.cat ? { color: g.cat.color } : undefined}>{g.cat ? `${g.cat.icon} ${g.cat.name}` : 'Other'}</span>}
                  <div className="focus-group-chars">
                    {g.chars.map((c) => (
                      <button key={c.id} className={'focus-chip' + (c.id === focusId ? ' on' : '')} onClick={() => setFocus(c.id)} style={c.id === focusId ? { borderColor: c.color } : undefined} title={c.name}>
                        <Avatar c={c} size={c.id === focusId ? 48 : 36} />
                        <span>{c.name || 'Unnamed'}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <button className="icon-btn big" onClick={() => setFocus(chars[(focusIdx + 1) % chars.length].id)} aria-label="Next character">›</button>
          </div>

          <div className="row between wrap gap focus-title-row">
            <h2 className="focus-title">
              <Avatar c={focus} size={36} /> {focus.name || 'Unnamed'}&rsquo;s relationships <span className="muted small">({others.length})</span>
            </h2>
            {!adding && <button className="btn primary" onClick={() => setAdding(true)}>+ Add relationship</button>}
          </div>

          {adding && <AddRelationship story={story} focus={focus} onDone={() => setAdding(false)} />}

          {others.length === 0 && !adding ? (
            <div className="card empty-rel">
              <p className="muted">No relationships for {focus.name || 'this character'} yet.</p>
              <button className="btn" onClick={() => setAdding(true)}>+ Add relationship</button>
            </div>
          ) : (
            <div className="rel-list">
              {others.map((o) => (
                <RelRow key={o.id} story={story} a={focus} b={o} onFocus={() => setFocus(o.id)} onDetails={(from, to) => setDetails({ from, to })} />
              ))}
            </div>
          )}
        </>
      )}

      {details && (
        <RelEditor key={details.from + details.to} story={story} from={details.from} to={details.to} onSwitch={() => setDetails({ from: details.to, to: details.from })} onClose={() => setDetails(null)} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- adding

/** Pick one or more people and a type in one go. */
function AddRelationship({ story, focus, onDone }: { story: Story; focus: Character; onDone: () => void }) {
  const { upd } = useStoryCtx();
  const [who, setWho] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [mutual, setMutual] = useState(true);
  const [feeling, setFeeling] = useState('');
  const candidates = story.characters.filter((c) => c.id !== focus.id);

  const add = () => {
    upd((s) => {
      for (const other of who) {
        const existing = s.relationships.find((r) => (r.from === focus.id && r.to === other) || (r.mutual && r.from === other && r.to === focus.id));
        if (existing) {
          // already related: just add the new types
          editLatest(s, existing, (st) => {
            st.typeIds = [...new Set([...st.typeIds, ...types])];
            if (feeling && !st.feeling) st.feeling = feeling;
          });
        } else {
          s.relationships.push({ id: uid(), from: focus.id, to: other, mutual, notes: '', states: { [s.moments[0].id]: { typeIds: [...types], feeling, values: {} } } });
        }
      }
    });
    onDone();
  };

  return (
    <div className="card add-rel">
      <label className="lbl" style={{ marginTop: 0 }}>Who? <span className="muted">(pick as many as you like: they all get the same relationship)</span></label>
      {story.charCategories.length > 0 ? (
        groupCharacters(story, candidates).map((g, gi) => (
          <div key={g.cat?.id ?? 'none' + gi} className="add-rel-group">
            <span className="muted small">{g.cat ? `${g.cat.icon} ${g.cat.name}` : 'Other'}</span>
            <CharacterChips characters={g.chars} selected={who} onChange={setWho} />
          </div>
        ))
      ) : (
        <CharacterChips characters={candidates} selected={who} onChange={setWho} />
      )}
      <label className="lbl">What are they to {focus.name || 'them'}?</label>
      <TypeChips story={story} selected={types} onToggle={(id) => setTypes(types.includes(id) ? types.filter((t) => t !== id) : [...types, id])} />
      <div className="row gap wrap" style={{ marginTop: 12 }}>
        <div className="seg small">
          <button className={mutual ? 'on' : ''} onClick={() => setMutual(true)}>⇄ Mutual</button>
          <button className={!mutual ? 'on' : ''} onClick={() => setMutual(false)}>→ Only how {focus.name || 'they'} see{focus.name ? 's' : ''} them</button>
        </div>
        <input className="input slim" style={{ flex: 1, minWidth: 180 }} placeholder="How do they feel? (optional)" value={feeling} onChange={(e) => setFeeling(e.target.value)} />
      </div>
      <div className="row end gap" style={{ marginTop: 12 }}>
        <button className="btn ghost" onClick={onDone}>Cancel</button>
        <button className="btn primary" disabled={!who.length} onClick={add}>
          Add {who.length > 1 ? `${who.length} relationships` : 'relationship'}
        </button>
      </div>
    </div>
  );
}

function TypeChips({ story, selected, onToggle }: { story: Story; selected: string[]; onToggle: (id: string) => void }) {
  return (
    <div className="type-grid">
      {story.relTypes.map((t) => (
        <button key={t.id} className={'type-opt' + (selected.includes(t.id) ? ' on' : '')} style={{ ['--tc' as any]: t.color }} onClick={() => onToggle(t.id)}>
          <span>{t.emoji}</span> {t.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- one relationship, on the card list

function Badges({ story, st }: { story: Story; st?: RelState }) {
  const types = typesOf(story, st);
  if (!types.length) return <span className="muted small">no type yet</span>;
  return (
    <span className="badges">
      {types.map((t) => (
        <span key={t.id} className="badge" style={{ background: t.color }}>{t.emoji} {t.label}</span>
      ))}
    </span>
  );
}

/** Quick editing of one side (or the mutual record): types by one click, feeling inline. */
function SideLine({ story, rel, from, to, label }: { story: Story; rel?: Relationship; from: Character; to: Character; label: string }) {
  const { upd } = useStoryCtx();
  const [picking, setPicking] = useState(false);
  const pop = useRef<HTMLDivElement>(null);
  const st = latest(rel, story.moments)?.state;

  useEffect(() => {
    if (!picking) return;
    const close = (e: MouseEvent) => !pop.current?.contains(e.target as Node) && setPicking(false);
    setTimeout(() => document.addEventListener('mousedown', close));
    return () => document.removeEventListener('mousedown', close);
  }, [picking]);

  /** Edit this side; creates the one-way record if it doesn't exist yet. */
  const edit = (fn: (s: RelState) => void) =>
    upd((s) => {
      let r = rel ? s.relationships.find((x) => x.id === rel.id) : undefined;
      if (!r) {
        s.relationships.push({ id: uid(), from: from.id, to: to.id, mutual: false, notes: '', states: {} });
        r = s.relationships[s.relationships.length - 1];
      }
      editLatest(s, r, fn);
    });

  return (
    <div className="side-line">
      <span className="side-label small muted">{label}</span>
      <div className="side-types" ref={pop}>
        <button className="type-pick-btn" onClick={() => setPicking(!picking)} title="Change relationship type">
          <Badges story={story} st={st} /> <span className="muted small">✎</span>
        </button>
        {picking && (
          <div className="type-pop card">
            {story.relTypes.map((t) => {
              const on = !!st?.typeIds.includes(t.id);
              return (
                <button
                  key={t.id}
                  className={'chip' + (on ? ' on' : '')}
                  style={on ? { borderColor: t.color, background: t.color + '33' } : undefined}
                  onClick={() => edit((x) => void (x.typeIds = on ? x.typeIds.filter((y) => y !== t.id) : [...x.typeIds, t.id]))}
                >
                  {t.emoji} {t.label}
                </button>
              );
            })}
            <button className="btn small primary" onClick={() => setPicking(false)}>Done</button>
          </div>
        )}
      </div>
      <Field className="side-feel small" value={st?.feeling ?? ''} placeholder="How they feel…" onChange={(v) => edit((x) => void (x.feeling = v))} />
    </div>
  );
}

function RelRow({ story, a, b, onFocus, onDetails }: { story: Story; a: Character; b: Character; onFocus: () => void; onDetails: (from: string, to: string) => void }) {
  const ab = relFor(story, a.id, b.id);
  const ba = relFor(story, b.id, a.id);
  const mutual = !!ab?.mutual;
  const changes = ab ? Object.keys(ab.states).length > 1 : false;
  const accent = typesOf(story, latest(ab ?? ba, story.moments)?.state)[0]?.color;
  return (
    <div className="card rel-row" style={accent ? { borderLeftColor: accent } : undefined}>
      <button className="rel-who" onClick={onFocus} title={`Switch to ${b.name}'s view`}>
        <Avatar c={b} size={42} />
        <span>
          <b>{b.name || 'Unnamed'}</b>
          {b.role && <span className="muted small">{b.role}</span>}
        </span>
      </button>
      <div className="rel-sides">
        {mutual ? (
          <SideLine story={story} rel={ab} from={a} to={b} label="⇄ each other" />
        ) : (
          <>
            <SideLine story={story} rel={ab} from={a} to={b} label={`${a.name || 'They'} → ${b.name || 'them'}`} />
            <SideLine story={story} rel={ba} from={b} to={a} label={`${b.name || 'They'} → ${a.name || 'them'}`} />
          </>
        )}
      </div>
      <div className="rel-actions">
        {changes && <span className="kind-badge" title="Changes over the story">⏳ changes</span>}
        <button className="btn small ghost" onClick={() => onDetails(a.id, b.id)}>Details</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- details (timeline, meters, notes, mutual switch)

function RelEditor({ story, from, to, onSwitch, onClose }: { story: Story; from: string; to: string; onSwitch: () => void; onClose: () => void }) {
  const { upd } = useStoryCtx();
  const a = story.characters.find((c) => c.id === from)!;
  const b = story.characters.find((c) => c.id === to)!;
  const rel = relFor(story, from, to);
  const reverse = relFor(story, to, from);
  const mutual = !!rel?.mutual;
  const [moment, setMoment] = useState(() => latest(rel, story.moments)?.fromIndex ?? 0);
  const res = stateAt(rel, story.moments, moment);
  const st: RelState = res?.state ?? emptyState();
  const momentId = story.moments[moment].id;
  const setHere = !!rel?.states[momentId];
  const inheritedFrom = res && res.fromIndex !== moment ? story.moments[res.fromIndex] : undefined;

  const edit = (fn: (s: RelState) => void) =>
    upd((s) => {
      let r = rel ? s.relationships.find((x) => x.id === rel.id) : undefined;
      if (!r) {
        s.relationships.push({ id: uid(), from, to, mutual: true, notes: '', states: {} });
        r = s.relationships[s.relationships.length - 1];
      }
      if (!r.states[momentId]) {
        const inherited = stateAt(r as Relationship, s.moments as Story['moments'], moment)?.state;
        r.states[momentId] = inherited ? JSON.parse(JSON.stringify(inherited)) : emptyState();
      }
      fn(r.states[momentId] as RelState);
    });

  const makeMutual = (on: boolean) =>
    upd((s) => {
      const r = rel && s.relationships.find((x) => x.id === rel.id);
      if (!r) return;
      if (on) {
        // keep this side; the other side's separate record goes
        s.relationships = s.relationships.filter((x) => !(x.from === to && x.to === from && x.id !== r.id));
        r.mutual = true;
      } else {
        r.mutual = false;
        if (!s.relationships.some((x) => x.from === to && x.to === from)) s.relationships.push({ id: uid(), from: to, to: from, mutual: false, notes: r.notes, states: JSON.parse(JSON.stringify(r.states)) });
      }
    });

  const title = mutual ? (
    <span className="row gap wrap"><Avatar c={a} size={28} /> {a.name || 'Unnamed'} ⇄ <Avatar c={b} size={28} /> {b.name || 'Unnamed'}</span>
  ) : (
    <span className="row gap wrap"><Avatar c={a} size={28} /> How {a.name || 'Unnamed'} sees <Avatar c={b} size={28} /> {b.name || 'Unnamed'}</span>
  );

  return (
    <Modal wide onClose={onClose} title={title}>
      <div className="row gap wrap">
        {rel && (
          <div className="seg small">
            <button className={mutual ? 'on' : ''} onClick={() => !mutual && (reverse && reverse.id !== rel.id && Object.keys(reverse.states).length ? confirm(`Make it mutual? ${b.name || 'Their'}'s separate side will be replaced by this one.`) && makeMutual(true) : makeMutual(true))}>⇄ Mutual</button>
            <button className={!mutual ? 'on' : ''} onClick={() => mutual && makeMutual(false)}>Each side different</button>
          </div>
        )}
        {!mutual && <button className="btn small" onClick={onSwitch}>⇄ Switch to {b.name || 'their'}'s side</button>}
      </div>

      {story.moments.length > 1 && (
        <>
          <label className="lbl">Over the story <span className="muted">(optional: change it at later moments)</span></label>
          <div className="seg small moment-seg">
            {story.moments.map((mo, i) => (
              <button key={mo.id} className={i === moment ? 'on' : ''} onClick={() => setMoment(i)}>
                {rel?.states[mo.id] ? '● ' : ''}{mo.label || `Moment ${i + 1}`}
              </button>
            ))}
          </div>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            {setHere
              ? moment === 0
                ? 'How it starts. Later moments keep this until you change them.'
                : `Changed at “${story.moments[moment].label}”.`
              : inheritedFrom
                ? `Same as at “${inheritedFrom.label}”. Edit anything to record a change here.`
                : `Nothing set at “${story.moments[moment].label}” yet.`}
          </p>
        </>
      )}

      <label className="lbl">Relationship</label>
      <TypeChips story={story} selected={st.typeIds} onToggle={(id) => edit((x) => void (x.typeIds = x.typeIds.includes(id) ? x.typeIds.filter((t) => t !== id) : [...x.typeIds, id]))} />

      <label className="lbl">{mutual ? 'How do they feel about each other?' : `How does ${a.name || 'this character'} feel about ${b.name || 'them'}?`}</label>
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
                  {v !== undefined ? <button className="icon-btn tiny" title="Clear" onClick={() => edit((x) => void delete x.values[mt.id])}>×</button> : <span />}
                </div>
              );
            })}
          </div>
        </>
      )}

      <label className="lbl">Notes</label>
      <Field
        multiline
        className="input"
        value={rel?.notes ?? ''}
        placeholder="History, key moments, how it changes over the story…"
        onChange={(v) =>
          upd((s) => {
            const r = rel && s.relationships.find((x) => x.id === rel.id);
            if (r) r.notes = v;
            else s.relationships.push({ id: uid(), from, to, mutual: true, notes: v, states: {} });
          })
        }
      />

      <div className="row gap wrap" style={{ marginTop: 16 }}>
        {setHere && moment > 0 && (
          <button className="btn small ghost" onClick={() => upd((s) => void delete s.relationships.find((x) => x.id === rel!.id)!.states[momentId])}>Undo change at this moment</button>
        )}
        {rel && (
          <button
            className="btn small ghost danger"
            onClick={() => {
              if (!confirm(`Remove the relationship between ${a.name || 'them'} and ${b.name || 'them'}?`)) return;
              upd((s) => void (s.relationships = s.relationships.filter((x) => !((x.from === from && x.to === to) || (x.from === to && x.to === from)))));
              onClose();
            }}
          >
            Remove relationship
          </button>
        )}
        <span style={{ flex: 1 }} />
        <button
          className="btn primary"
          onClick={() => {
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

function RelWeb({ story, onPick }: { story: Story; onPick: (id: string) => void }) {
  const [hidden, setHidden] = useState<string[]>([]);
  const [moment, setMoment] = useState(story.moments.length - 1);
  const m = Math.min(moment, story.moments.length - 1);
  const chars = story.characters;
  const size = 640;
  const R = size / 2 - 70;
  const pos = new Map(
    chars.map((c, i) => {
      const ang = (Math.PI * 2 * i) / chars.length - Math.PI / 2;
      return [c.id, { x: size / 2 + Math.cos(ang) * R, y: size / 2 + Math.sin(ang) * R }];
    }),
  );
  const edges = story.relationships
    .filter((r) => pos.has(r.from) && pos.has(r.to))
    .map((r) => ({ r, types: typesOf(story, stateAt(r, story.moments, m)?.state).filter((t) => !hidden.includes(t.id)) }))
    .filter((e) => e.types.length);
  const used = story.relTypes.filter((t) => story.relationships.some((r) => typesOf(story, stateAt(r, story.moments, m)?.state).some((x) => x.id === t.id)));

  return (
    <div className="card web">
      {story.moments.length > 1 && (
        <div className="row gap wrap small">
          <span className="muted">At:</span>
          <div className="seg small">
            {story.moments.map((mo, i) => (
              <button key={mo.id} className={i === m ? 'on' : ''} onClick={() => setMoment(i)}>{mo.label || `Moment ${i + 1}`}</button>
            ))}
          </div>
        </div>
      )}
      <div className="chip-row">
        {used.map((t) => {
          const off = hidden.includes(t.id);
          return (
            <button key={t.id} className={'chip' + (off ? '' : ' on')} style={off ? undefined : { borderColor: t.color, background: t.color + '33' }} onClick={() => setHidden(off ? hidden.filter((x) => x !== t.id) : [...hidden, t.id])}>
              {t.emoji} {t.label}
            </button>
          );
        })}
        {!used.length && <span className="muted small">No relationships yet. Add some in the Cards view.</span>}
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
          // one-way relationships sit slightly to one side so A→B and B→A don't overlap
          const off = r.mutual ? 0 : 9;
          const nx = -uy * off, ny = ux * off;
          const s = { x: p1.x + ux * 32 + nx, y: p1.y + uy * 32 + ny };
          const e = { x: p2.x - ux * 34 + nx, y: p2.y - uy * 34 + ny };
          const mid = { x: (s.x + e.x) / 2 + nx * 2, y: (s.y + e.y) / 2 + ny * 2 };
          return (
            <g key={r.id}>
              <path
                d={`M${s.x},${s.y} Q${mid.x},${mid.y} ${e.x},${e.y}`}
                stroke={t.color}
                strokeWidth={r.mutual ? 3 : 2.5}
                fill="none"
                markerEnd={`url(#arrow-${t.id})`}
                markerStart={r.mutual ? `url(#arrow-${t.id})` : undefined}
                opacity={0.9}
              />
              <text x={mid.x} y={mid.y} fontSize={14} textAnchor="middle" dominantBaseline="middle">{types.map((x) => x.emoji).join('')}</text>
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
      <p className="muted small">Double-headed arrows are mutual. Single arrows point from a character to the person they feel that way about. Click a character to see their relationships.</p>
    </div>
  );
}

// ---------------------------------------------------------------- types & meters

function TypesEditor({ story, upd }: { story: Story; upd: StoryUpdater }) {
  const have = new Set(story.relTypes.map((t) => t.label.toLowerCase()));
  const presetsLeft = REL_PRESETS.filter((p) => !have.has(p.label.toLowerCase()));
  const count = (id: string) => story.relationships.filter((r) => Object.values(r.states).some((s) => s.typeIds.includes(id))).length;

  return (
    <>
      <section className="card">
        <h2 className="sec-title">Relationship types</h2>
        <p className="muted small">The types you pick from in this story. Rename them, change emoji and colour, or add your own (e.g. “Sworn Blade”, “Blood Debt”).</p>
        <div className="types-list">
          {story.relTypes.map((t, i) => (
            <div key={t.id} className="type-row">
              <input className="emoji-input" value={t.emoji} onChange={(e) => upd((s) => void (s.relTypes[i].emoji = e.target.value))} aria-label="Emoji" />
              <Field value={t.label} placeholder="Name" onChange={(v) => upd((s) => void (s.relTypes[i].label = v))} />
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
        <p className="muted small">Sliders in each relationship's Details, rated 0–10, e.g. Trust, Fear, Loyalty, Suspicion.</p>
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
      <MomentsEditor story={story} upd={upd} />
    </>
  );
}

function MomentsEditor({ story, upd }: { story: Story; upd: StoryUpdater }) {
  return (
    <section className="card">
      <h2 className="sec-title">Story timeline</h2>
      <p className="muted small">Moments where relationships can change (acts, arcs, big events). Use them in a relationship's Details.</p>
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
      <button className="btn small" style={{ marginTop: 8 }} onClick={() => upd((s) => void s.moments.push({ id: uid(), label: `Moment ${s.moments.length + 1}` }))}>+ Moment</button>
    </section>
  );
}
