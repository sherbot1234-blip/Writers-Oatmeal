import { useState } from 'react';
import { useStoryCtx } from '../storyContext';
import { Link } from 'react-router-dom';
import { Avatar, CharacterChips, ColorPick, Empty, Field, Modal } from '../components/ui';
import { useChapters } from '../chapters';
import { trashItem, trashPlotPoint } from '../trash';
import { useLibrary } from '../store';
import { makeStructure, STRUCTURES } from '../defaults';
import { move, SWATCHES, uid } from '../util';
import type { Beat, Chapter, PlotPoint, PlotStatus, Story } from '../types';

const STATUS: { key: PlotStatus; label: string; icon: string }[] = [
  { key: 'idea', label: 'Idea', icon: '💭' },
  { key: 'planned', label: 'Planned', icon: '📝' },
  { key: 'written', label: 'Written', icon: '✅' },
];

type Drag = { arc: number; point: number } | null;

export default function Plot() {
  const { update } = useLibrary();
  const { story, upd, base } = useStoryCtx();
  const { chapters } = useChapters(story.id);
  const [view, setView] = useState<'board' | 'timeline' | 'structure' | 'outline'>('board');
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
            <button className={view === 'timeline' ? 'on' : ''} onClick={() => setView('timeline')}>Timeline</button>
            <button className={view === 'structure' ? 'on' : ''} onClick={() => setView('structure')}>Structure</button>
            <button className={view === 'outline' ? 'on' : ''} onClick={() => setView('outline')}>Outline</button>
          </div>
          <button className="btn primary" onClick={addArc}>+ Arc</button>
        </div>
      </div>

      {view === 'outline' ? (
        <Outline story={story} matches={matches} />
      ) : view === 'timeline' ? (
        <Timeline story={story} chapters={chapters} matches={matches} base={base} />
      ) : view === 'structure' ? (
        <StructureView story={story} chapters={chapters} />
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
                <button className="icon-btn tiny danger" title="Delete arc" onClick={() => confirm(`Delete arc “${arc.title}” and its ${arc.points.length} plot points? It goes to the bin for 30 days.`) && update((d) => trashItem(d, story.id, 'arcs', arc.id))}>🗑</button>
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
                      <PointEditor story={story} chapters={chapters} ai={ai} pi={pi} onClose={() => setOpen(null)} />
                    ) : (
                      <button className="point-summary" onClick={() => setOpen(p.id)}>
                        <span className="point-top">
                          <span className="point-num">{pi + 1}</span>
                          {chapterBadge(p, chapters)}
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

function chapterBadge(p: PlotPoint, chapters: Chapter[]) {
  const i = chapters.findIndex((c) => c.id === p.chapterId);
  return i >= 0 ? <span className="kind-badge ch-badge" title={chapters[i].title}>Ch. {i + 1}</span> : null;
}

function PointEditor({ story, chapters, ai, pi, onClose }: { story: Story; chapters: Chapter[]; ai: number; pi: number; onClose: () => void }) {
  const { update } = useLibrary();
  const { upd } = useStoryCtx();
  const p = story.arcs[ai].points[pi];
  const set = (fn: (p: PlotPoint) => void) => upd((s) => fn(s.arcs[ai].points[pi]));
  return (
    <div className="point-edit">
      <input className="input" autoFocus placeholder="What happens?" value={p.title} onChange={(e) => set((x) => void (x.title = e.target.value))} />
      <div className="row gap">
        {chapters.length > 0 && (
          <select className="input slim" value={p.chapterId ?? ''} onChange={(e) => set((x) => void (x.chapterId = e.target.value || undefined))} aria-label="Chapter">
            <option value="">No chapter</option>
            {chapters.map((c, i) => (
              <option key={c.id} value={c.id}>Ch. {i + 1}{c.title ? `: ${c.title}` : ''}</option>
            ))}
          </select>
        )}
        <input className="input slim" style={{ flex: 1, minWidth: 0 }} placeholder="Label (optional)" value={p.chapter} onChange={(e) => set((x) => void (x.chapter = e.target.value))} />
      </div>
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
        <button className="icon-btn danger" title="Delete" onClick={() => { if (confirm('Delete this plot point? It goes to the bin for 30 days.')) { update((d) => trashPlotPoint(d, story.id, p.id)); onClose(); } }}>🗑</button>
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

// ---------------------------------------------------------------- timeline

/** Arcs as rows, chapters as columns: see what happens in parallel. */
function Timeline({ story, chapters, matches, base }: { story: Story; chapters: Chapter[]; matches: (p: PlotPoint) => boolean; base: string }) {
  const { upd } = useStoryCtx();
  const [drag, setDrag] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  if (!chapters.length)
    return (
      <Empty icon="📅" title="Add chapters to see the timeline">
        <p className="muted">The timeline shows each arc as a row and each chapter as a column.</p>
        <Link className="btn primary" to={base + '/chapters'}>Go to chapters</Link>
      </Empty>
    );
  const known = new Set(chapters.map((c) => c.id));
  const cols = [...chapters.map((c, i) => ({ id: c.id, label: `Ch. ${i + 1}`, title: c.title })), { id: '', label: 'Not placed', title: '' }];
  const place = (pointId: string, ai: number, chapterId: string) =>
    upd((s) => {
      for (const a of s.arcs) {
        const i = a.points.findIndex((p) => p.id === pointId);
        if (i < 0) continue;
        const [p] = a.points.splice(i, 1);
        p.chapterId = chapterId || undefined;
        s.arcs[ai].points.push(p);
        return;
      }
    });
  const loc = editing ? story.arcs.flatMap((a, ai) => a.points.map((p, pi) => ({ p, ai, pi }))).find((x) => x.p.id === editing) : undefined;

  return (
    <div className="timeline-wrap card">
      <div className="timeline" style={{ gridTemplateColumns: `130px repeat(${cols.length}, minmax(150px, 1fr))` }}>
        <div className="tl-corner" />
        {cols.map((c) => (
          <div key={c.id || 'none'} className={'tl-head' + (c.id ? '' : ' none')}>
            {c.id ? <Link to={`${base}/chapters/${c.id}`}>{c.label}</Link> : c.label}
            {c.title && <span className="muted small">{c.title}</span>}
          </div>
        ))}
        {story.arcs.map((arc, ai) => (
          <div key={arc.id} className="tl-row" style={{ display: 'contents' }}>
            <div className="tl-arc" style={{ borderLeftColor: arc.color }}>{arc.title || 'Untitled arc'}</div>
            {cols.map((c) => {
              const pts = arc.points.filter((p) => (p.chapterId && known.has(p.chapterId) ? p.chapterId : '') === c.id);
              return (
                <div
                  key={c.id || 'none'}
                  className={'tl-cell' + (c.id ? '' : ' none')}
                  onDragOver={(e) => drag && e.preventDefault()}
                  onDrop={() => {
                    if (drag) place(drag, ai, c.id);
                    setDrag(null);
                  }}
                >
                  {pts.map((p) => (
                    <button
                      key={p.id}
                      draggable
                      onDragStart={() => setDrag(p.id)}
                      onDragEnd={() => setDrag(null)}
                      className={'tl-point' + (matches(p) ? '' : ' dim')}
                      style={{ borderLeftColor: arc.color }}
                      onClick={() => setEditing(p.id)}
                    >
                      <span>{STATUS.find((x) => x.key === p.status)?.icon}</span> {p.title || 'Untitled'}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <p className="muted small">Drag plot points between chapters and arcs. Click one to edit it.</p>
      {loc && (
        <Modal title="Plot point" onClose={() => setEditing(null)}>
          <PointEditor story={story} chapters={chapters} ai={loc.ai} pi={loc.pi} onClose={() => setEditing(null)} />
        </Modal>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- structure

function StructureView({ story, chapters }: { story: Story; chapters: Chapter[] }) {
  const { upd } = useStoryCtx();
  const st = story.structure;
  const allPoints = story.arcs.flatMap((a) => a.points.map((p) => ({ a, p })));

  if (!st)
    return (
      <>
        <p className="muted">Pick a structure to map your plot onto. You can rename, move, add or delete any beat afterwards.</p>
        <div className="structure-picker">
          {STRUCTURES.map((t) => (
            <button key={t.id} className="card structure-opt" onClick={() => upd((s) => void (s.structure = makeStructure(t.id)))}>
              <b>{t.name}</b>
              <span className="muted small">{t.blurb}</span>
              <span className="small">{t.beats.length} beats</span>
            </button>
          ))}
          <button className="card structure-opt" onClick={() => upd((s) => void (s.structure = makeStructure('custom')))}>
            <b>Build my own</b>
            <span className="muted small">Start empty and add your own beats, e.g. the 300 levels of a game.</span>
          </button>
        </div>
      </>
    );

  const beats = st.beats.map((b, i) => ({ b, i })).sort((x, y) => x.b.pct - y.b.pct);
  const setBeat = (i: number, fn: (b: Beat) => void) => upd((s) => fn(s.structure!.beats[i]));
  const approxChapter = (pct: number) => (chapters.length ? Math.min(chapters.length, Math.floor((pct / 100) * chapters.length) + 1) : null);

  return (
    <div className="structure">
      <div className="row between wrap gap">
        <Field className="sec-title" value={st.name} onChange={(v) => upd((s) => void (s.structure!.name = v))} />
        <button className="btn small ghost" onClick={() => confirm('Remove this structure? Your plot points are not affected.') && upd((s) => void (s.structure = undefined))}>Change structure</button>
      </div>
      <div className="ruler" aria-hidden>
        {beats.map(({ b }) => (
          <span key={b.id} className={'ruler-mark' + (b.pointIds.length ? ' filled' : '')} style={{ left: `${b.pct}%` }} title={`${b.name} · ${b.pct}%`} />
        ))}
      </div>
      <ol className="beats">
        {beats.map(({ b, i }) => {
          const ch = approxChapter(b.pct);
          const linked = b.pointIds.map((id) => allPoints.find((x) => x.p.id === id)).filter((x): x is NonNullable<typeof x> => !!x);
          return (
            <li key={b.id} className="beat card">
              <div className="beat-pos">
                <input className="input slim" type="number" min={0} max={100} value={b.pct} onChange={(e) => setBeat(i, (x) => void (x.pct = Math.max(0, Math.min(100, +e.target.value || 0))))} aria-label="Position (%)" />
                <span className="muted small">%{ch ? ` · ≈ Ch. ${ch}` : ''}</span>
              </div>
              <div className="beat-body">
                <Field className="beat-name" value={b.name} placeholder="Beat name" onChange={(v) => setBeat(i, (x) => void (x.name = v))} />
                {b.guide && <p className="muted small beat-guide">{b.guide}</p>}
                <Field multiline className="small" value={b.notes} placeholder="What happens here in your story?" onChange={(v) => setBeat(i, (x) => void (x.notes = v))} />
                <div className="chip-row">
                  {linked.map(({ a, p }) => (
                    <span key={p.id} className="chip on" style={{ borderColor: a.color }}>
                      {p.title || 'Untitled'}
                      <button className="icon-btn tiny" onClick={() => setBeat(i, (x) => void (x.pointIds = x.pointIds.filter((y) => y !== p.id)))} aria-label="Unlink">×</button>
                    </span>
                  ))}
                  {allPoints.length > linked.length && (
                    <select className="input slim" value="" onChange={(e) => e.target.value && setBeat(i, (x) => void x.pointIds.push(e.target.value))}>
                      <option value="">+ plot point</option>
                      {story.arcs.map((a) => (
                        <optgroup key={a.id} label={a.title}>
                          {a.points.filter((p) => !b.pointIds.includes(p.id)).map((p) => (
                            <option key={p.id} value={p.id}>{p.title || 'Untitled'}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  )}
                </div>
              </div>
              <button className="icon-btn danger" title="Delete beat" onClick={() => confirm(`Delete the beat “${b.name}”?`) && upd((s) => void s.structure!.beats.splice(i, 1))}>🗑</button>
            </li>
          );
        })}
      </ol>
      <button
        className="btn small dashed wide"
        onClick={() => upd((s) => void s.structure!.beats.push({ id: uid(), name: 'New beat', guide: '', pct: Math.min(100, (beats[beats.length - 1]?.b.pct ?? -5) + 5), notes: '', pointIds: [] }))}
      >
        + Beat
      </button>
    </div>
  );
}
