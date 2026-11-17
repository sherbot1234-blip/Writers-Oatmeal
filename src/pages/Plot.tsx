import { useState } from 'react';
import { useStoryCtx } from '../storyContext';
import { Avatar, CharacterChips, ColorPick, Field } from '../components/ui';
import { move, SWATCHES, uid } from '../util';
import type { PlotPoint, PlotStatus, Story } from '../types';

const STATUS: { key: PlotStatus; label: string; icon: string }[] = [
  { key: 'idea', label: 'Idea', icon: '💭' },
  { key: 'planned', label: 'Planned', icon: '📝' },
  { key: 'written', label: 'Written', icon: '✅' },
];

type Drag = { arc: number; point: number } | null;

export default function Plot() {
  const { story, upd } = useStoryCtx();
  const [view, setView] = useState<'board' | 'outline'>('board');
  const [open, setOpen] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag>(null);
  const [filter, setFilter] = useState('');

  const addArc = () =>
    upd((s) => void s.arcs.push({ id: uid(), title: 'New Arc', description: '', color: SWATCHES[s.arcs.length % SWATCHES.length], points: [] }));

  const addPoint = (ai: number) => {
    const id = uid();
    upd((s) => void s.arcs[ai].points.push({ id, title: '', description: '', chapter: '', status: 'idea', characterIds: filter ? [filter] : [] }));
    setOpen(id);
  };

  const drop = (toArc: number, toPoint: number) => {
    if (!drag) return;
    upd((s) => {
      const [p] = s.arcs[drag.arc].points.splice(drag.point, 1);
      let idx = toPoint;
      if (drag.arc === toArc && drag.point < toPoint) idx--;
      s.arcs[toArc].points.splice(Math.max(0, idx), 0, p);
    });
    setDrag(null);
  };

  const matches = (p: PlotPoint) => !filter || p.characterIds.includes(filter);

  return (
    <div className="page wide">
      <div className="page-head">
        <h1>Plot</h1>
        <div className="row gap wrap">
          {story.characters.length > 0 && (
            <select className="input slim" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">All characters</option>
              {story.characters.map((c) => (
                <option key={c.id} value={c.id}>Only {c.name || 'Unnamed'}</option>
              ))}
            </select>
          )}
          <div className="seg">
            <button className={view === 'board' ? 'on' : ''} onClick={() => setView('board')}>Board</button>
            <button className={view === 'outline' ? 'on' : ''} onClick={() => setView('outline')}>Outline</button>
          </div>
          <button className="btn primary" onClick={addArc}>+ Arc</button>
        </div>
      </div>

      {view === 'outline' ? (
        <Outline story={story} matches={matches} />
      ) : (
        <div className="board">
          {story.arcs.map((arc, ai) => (
            <div
              key={arc.id}
              className="arc card"
              style={{ borderTopColor: arc.color }}
              onDragOver={(e) => drag && e.preventDefault()}
              onDrop={() => drop(ai, arc.points.length)}
            >
              <div className="arc-head">
                <ColorPick value={arc.color} onChange={(v) => upd((s) => void (s.arcs[ai].color = v))} />
                <Field className="arc-title" value={arc.title} placeholder="Arc name" onChange={(v) => upd((s) => void (s.arcs[ai].title = v))} />
                <span className="muted small">{arc.points.length}</span>
              </div>
              <Field multiline className="small muted-field" value={arc.description} placeholder="What is this arc about?" onChange={(v) => upd((s) => void (s.arcs[ai].description = v))} />
              <div className="arc-tools">
                <button className="icon-btn tiny" title="Move arc left" onClick={() => upd((s) => move(s.arcs, ai, ai - 1))}>←</button>
                <button className="icon-btn tiny" title="Move arc right" onClick={() => upd((s) => move(s.arcs, ai, ai + 1))}>→</button>
                <button className="icon-btn tiny danger" title="Delete arc" onClick={() => confirm(`Delete arc “${arc.title}” and its ${arc.points.length} plot points?`) && upd((s) => void s.arcs.splice(ai, 1))}>🗑</button>
              </div>

              <div className="points">
                {arc.points.map((p, pi) => (
                  <div
                    key={p.id}
                    className={'point' + (matches(p) ? '' : ' dim') + (drag?.arc === ai && drag.point === pi ? ' dragging' : '')}
                    draggable={open !== p.id}
                    onDragStart={() => setDrag({ arc: ai, point: pi })}
                    onDragEnd={() => setDrag(null)}
                    onDragOver={(e) => drag && e.preventDefault()}
                    onDrop={(e) => {
                      e.stopPropagation();
                      drop(ai, pi);
                    }}
                    style={{ borderLeftColor: arc.color }}
                  >
                    {open === p.id ? (
                      <PointEditor story={story} ai={ai} pi={pi} onClose={() => setOpen(null)} />
                    ) : (
                      <button className="point-summary" onClick={() => setOpen(p.id)}>
                        <span className="point-top">
                          <span className="point-num">{pi + 1}</span>
                          {p.chapter && <span className="kind-badge">{p.chapter}</span>}
                          <span title={p.status}>{STATUS.find((s) => s.key === p.status)?.icon}</span>
                        </span>
                        <span className="point-title">{p.title || <span className="muted">Untitled plot point</span>}</span>
                        {p.description && <span className="point-desc muted small">{p.description}</span>}
                        {p.characterIds.length > 0 && (
                          <span className="point-chars">
                            {story.characters.filter((c) => p.characterIds.includes(c.id)).map((c) => <Avatar key={c.id} c={c} size={20} />)}
                          </span>
                        )}
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button className="btn small dashed wide" onClick={() => addPoint(ai)}>+ Plot point</button>
            </div>
          ))}
          <button className="arc add card" onClick={addArc}>+ New arc</button>
        </div>
      )}
      {view === 'board' && <p className="muted small">Tip: drag plot points to reorder them or move them between arcs.</p>}
    </div>
  );
}

function PointEditor({ story, ai, pi, onClose }: { story: Story; ai: number; pi: number; onClose: () => void }) {
  const { upd } = useStoryCtx();
  const p = story.arcs[ai].points[pi];
  const set = (fn: (p: PlotPoint) => void) => upd((s) => fn(s.arcs[ai].points[pi]));
  return (
    <div className="point-edit">
      <input className="input" autoFocus placeholder="What happens?" value={p.title} onChange={(e) => set((x) => void (x.title = e.target.value))} />
      <input className="input slim" placeholder="Chapter / label (optional)" value={p.chapter} onChange={(e) => set((x) => void (x.chapter = e.target.value))} />
      <div className="seg small">
        {STATUS.map((s) => (
          <button key={s.key} className={p.status === s.key ? 'on' : ''} onClick={() => set((x) => void (x.status = s.key))}>
            {s.icon} {s.label}
          </button>
        ))}
      </div>
      <Field multiline className="input" placeholder="Details…" value={p.description} onChange={(v) => set((x) => void (x.description = v))} />
      <label className="lbl">Characters involved</label>
      <CharacterChips characters={story.characters} selected={p.characterIds} onChange={(ids) => set((x) => void (x.characterIds = ids))} />
      <div className="row gap wrap" style={{ marginTop: 8 }}>
        {story.arcs.length > 1 && (
          <select
            className="input slim"
            value=""
            onChange={(e) => {
              const to = +e.target.value;
              upd((s) => {
                const [pt] = s.arcs[ai].points.splice(pi, 1);
                s.arcs[to].points.push(pt);
              });
              onClose();
            }}
          >
            <option value="" disabled>Move to arc…</option>
            {story.arcs.map((a, i) => i !== ai && <option key={a.id} value={i}>{a.title || 'Untitled arc'}</option>)}
          </select>
        )}
        <button className="icon-btn" title="Move up" onClick={() => upd((s) => move(s.arcs[ai].points, pi, pi - 1))}>↑</button>
        <button className="icon-btn" title="Move down" onClick={() => upd((s) => move(s.arcs[ai].points, pi, pi + 1))}>↓</button>
        <button className="icon-btn danger" title="Delete" onClick={() => { if (confirm('Delete this plot point?')) { upd((s) => void s.arcs[ai].points.splice(pi, 1)); onClose(); } }}>🗑</button>
        <span style={{ flex: 1 }} />
        <button className="btn small primary" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}

function Outline({ story, matches }: { story: Story; matches: (p: PlotPoint) => boolean }) {
  return (
    <div className="outline">
      {story.arcs.map((arc) => (
        <section key={arc.id} className="card outline-arc" style={{ borderLeftColor: arc.color }}>
          <h2 className="sec-title" style={{ color: arc.color }}>{arc.title || 'Untitled arc'}</h2>
          {arc.description && <p className="muted prose-static">{arc.description}</p>}
          <ol>
            {arc.points.filter(matches).map((p) => (
              <li key={p.id}>
                <div className="row gap">
                  <b>{p.title || 'Untitled'}</b>
                  {p.chapter && <span className="kind-badge">{p.chapter}</span>}
                  <span>{STATUS.find((s) => s.key === p.status)?.icon}</span>
                </div>
                {p.description && <p className="prose-static">{p.description}</p>}
                {p.characterIds.length > 0 && (
                  <p className="muted small">With: {story.characters.filter((c) => p.characterIds.includes(c.id)).map((c) => c.name || 'Unnamed').join(', ')}</p>
                )}
              </li>
            ))}
          </ol>
          {!arc.points.length && <p className="muted small">No plot points yet.</p>}
        </section>
      ))}
    </div>
  );
}
