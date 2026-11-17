import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStoryCtx } from '../storyContext';
import { Avatar, ColorPick, Empty, Field, Modal } from '../components/ui';
import { groupCharacters } from '../categories';
import { uid } from '../util';
import type { FamilyTree, LineStyle, Story, TreeLink, TreeLineType, TreeNode } from '../types';
import { palette } from './Library';

const NODE_W = 132;
const NODE_H = 84;
const GRID = 12;
const snap = (v: number) => Math.round(v / GRID) * GRID;

const DASH: Record<LineStyle, string | undefined> = { solid: undefined, dashed: '9 6', dotted: '1.5 6', double: undefined };

export default function FamilyTrees() {
  const { story, upd } = useStoryCtx();
  const [treeId, setTreeId] = useState<string | null>(() => story.trees[0]?.id ?? null);
  const [typesOpen, setTypesOpen] = useState(false);
  const ti = story.trees.findIndex((t) => t.id === treeId);
  const tree = story.trees[ti];

  useEffect(() => {
    if (!tree && story.trees.length) setTreeId(story.trees[0].id);
  }, [tree, story.trees]);

  const newTree = () => {
    const name = prompt('Name this family tree', story.trees.length ? 'New family tree' : `${story.title || 'The'} family`);
    if (!name?.trim()) return;
    const t: FamilyTree = { id: uid(), name: name.trim(), nodes: [], links: [] };
    upd((s) => void s.trees.push(t));
    setTreeId(t.id);
  };

  return (
    <div className="page wide">
      <div className="page-head">
        <h1>Family trees</h1>
        <div className="row gap wrap">
          <button className="btn ghost" onClick={() => setTypesOpen(true)}>Line types</button>
          <button className="btn primary" onClick={newTree}>+ New tree</button>
        </div>
      </div>
      {story.trees.length > 1 && (
        <nav className="sub-tabs">
          {story.trees.map((t) => (
            <button key={t.id} className={t.id === treeId ? 'on' : ''} onClick={() => setTreeId(t.id)}>🌳 {t.name || 'Untitled tree'}</button>
          ))}
        </nav>
      )}
      {!tree ? (
        <Empty icon="🌳" title="No family trees yet">
          <p className="muted">
            Build trees by hand: drop in characters (or name-only ancestors), drag them where you like, and draw lines between them: parents, partners, adoption, blood bonds or anything you invent.
            <br />Make as many as you need, like the riders' family, the 800-year bloodline, or Hayashi's real family.
          </p>
          <button className="btn primary" onClick={newTree}>+ New tree</button>
        </Empty>
      ) : (
        <TreeEditor story={story} ti={ti} tree={tree} onDeleted={() => setTreeId(null)} />
      )}
      {typesOpen && <LineTypesEditor story={story} onClose={() => setTypesOpen(false)} />}
    </div>
  );
}

// ---------------------------------------------------------------- editor

type Sel = { kind: 'node' | 'link'; id: string } | null;

function TreeEditor({ story, ti, tree, onDeleted }: { story: Story; ti: number; tree: FamilyTree; onDeleted: () => void }) {
  const { upd, base } = useStoryCtx();
  const [zoom, setZoom] = useState(1);
  const [lineType, setLineType] = useState(story.treeLineTypes[0]?.id ?? '');
  const [drawing, setDrawing] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [sel, setSel] = useState<Sel>(null);
  const [dragPos, setDragPos] = useState<{ id: string; x: number; y: number } | null>(null);
  const [q, setQ] = useState('');
  const [nameDraft, setNameDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number; moved: boolean } | null>(null);
  const bg = palette(story.theme).surface;

  const setTree = (fn: (t: FamilyTree) => void) => upd((s) => fn(s.trees[ti] as FamilyTree));
  const charOf = (n: TreeNode) => story.characters.find((c) => c.id === n.charId);
  const pos = (n: TreeNode) => (dragPos?.id === n.id ? dragPos : n);
  const width = Math.max(1600, ...tree.nodes.map((n) => n.x + NODE_W + 300));
  const height = Math.max(1000, ...tree.nodes.map((n) => n.y + NODE_H + 300));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPending(null);
        setDrawing(false);
        setSel(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /** Puts a new person in the middle of what you can see. */
  const place = (patch: Partial<TreeNode>) => {
    const el = scrollRef.current;
    const cx = el ? (el.scrollLeft + el.clientWidth / 2) / zoom : 300;
    const cy = el ? (el.scrollTop + el.clientHeight / 2) / zoom : 200;
    const spot = freeSpot(tree.nodes, cx - NODE_W / 2, cy - NODE_H / 2);
    const n: TreeNode = { id: uid(), note: '', x: spot.x, y: spot.y, ...patch };
    setTree((t) => void t.nodes.push(n));
    setSel({ kind: 'node', id: n.id });
  };

  const clickNode = (id: string) => {
    if (!drawing) return setSel({ kind: 'node', id });
    if (!pending) return setPending(id);
    if (pending === id) return setPending(null);
    const link: TreeLink = { id: uid(), from: pending, to: id, typeId: lineType, label: '' };
    setTree((t) => void t.links.push(link));
    setPending(null);
    setSel({ kind: 'link', id: link.id });
  };

  // ---- dragging people around
  const onPointerDown = (e: React.PointerEvent, n: TreeNode) => {
    if (drawing || e.button !== 0) return;
    const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
    drag.current = { id: n.id, dx: (e.clientX - rect.left) / zoom - n.x, dy: (e.clientY - rect.top) / zoom - n.y, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
    const x = Math.max(0, (e.clientX - rect.left) / zoom - d.dx);
    const y = Math.max(0, (e.clientY - rect.top) / zoom - d.dy);
    d.moved = true;
    setDragPos({ id: d.id, x, y });
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.moved && dragPos) {
      const { x, y } = dragPos;
      setSel({ kind: 'node', id: d.id }); // the person you just moved is the one you're working on
      setTree((t) => {
        const n = t.nodes.find((m) => m.id === d.id);
        if (n) {
          n.x = snap(x);
          n.y = snap(y);
        }
      });
    }
    setDragPos(null);
  };

  const onTree = new Set(tree.nodes.map((n) => n.charId).filter(Boolean));
  const visibleChars = story.characters.filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()));
  const selNode = sel?.kind === 'node' ? tree.nodes.find((n) => n.id === sel.id) : undefined;
  const selLink = sel?.kind === 'link' ? tree.links.find((l) => l.id === sel.id) : undefined;
  const nodeName = (n?: TreeNode) => (n ? (n.charId ? charOf(n)?.name || 'Unnamed' : n.name || 'Unnamed') : '?');

  return (
    <div className="tree-editor">
      <aside className="tree-side card">
        <Field className="sec-title" value={tree.name} placeholder="Tree name" onChange={(v) => setTree((t) => void (t.name = v))} />
        <label className="lbl">Add people</label>
        {story.characters.length > 6 && <input className="input slim" style={{ width: '100%', marginBottom: 6 }} placeholder="Find…" value={q} onChange={(e) => setQ(e.target.value)} />}
        <div className="tree-people">
          {groupCharacters(story, visibleChars).map((g, gi) => (
            <div key={g.cat?.id ?? 'none' + gi}>
              {story.charCategories.length > 0 && <div className="small muted tree-people-group">{g.cat ? `${g.cat.icon} ${g.cat.name}` : 'Others'}</div>}
              {g.chars.map((c) => (
                <button key={g.cat?.id + c.id} className="tree-person" disabled={onTree.has(c.id)} onClick={() => place({ charId: c.id })} title={onTree.has(c.id) ? 'Already on this tree' : 'Add to the tree'}>
                  <Avatar c={c} size={24} /> <span>{c.name || 'Unnamed'}</span> <span className="muted">{onTree.has(c.id) ? '✓' : '+'}</span>
                </button>
              ))}
            </div>
          ))}
          {!story.characters.length && <p className="muted small">No characters yet.</p>}
        </div>
        <label className="lbl">Name-only person</label>
        <div className="row gap">
          <input
            className="input slim"
            style={{ flex: 1, minWidth: 0 }}
            placeholder="e.g. Great-grandmother Aiko"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && nameDraft.trim()) {
                place({ name: nameDraft.trim() });
                setNameDraft('');
              }
            }}
          />
          <button className="btn small" disabled={!nameDraft.trim()} onClick={() => { place({ name: nameDraft.trim() }); setNameDraft(''); }}>+</button>
        </div>
        <button
          className="btn small ghost danger"
          style={{ marginTop: 16 }}
          onClick={() => {
            if (!confirm(`Delete the tree “${tree.name}”? Your characters are not affected.`)) return;
            upd((s) => void s.trees.splice(ti, 1));
            onDeleted();
          }}
        >
          Delete this tree
        </button>
      </aside>

      <div className="tree-main">
        <div className="tree-toolbar card">
          <button className={'btn small' + (drawing ? ' primary' : '')} onClick={() => { setDrawing(!drawing); setPending(null); }}>
            {drawing ? '✓ Done drawing' : '✏️ Draw lines'}
          </button>
          <div className="line-picker">
            {story.treeLineTypes.map((lt) => (
              <button key={lt.id} className={'line-opt' + (lineType === lt.id ? ' on' : '')} onClick={() => { setLineType(lt.id); setDrawing(true); }} title={lt.label}>
                <LineSample lt={lt} bg={bg} />
                <span>{lt.label}</span>
              </button>
            ))}
          </div>
          <span className="row gap zoom">
            <button className="icon-btn" onClick={() => setZoom(Math.max(0.4, +(zoom - 0.1).toFixed(1)))} aria-label="Zoom out">−</button>
            <span className="small muted">{Math.round(zoom * 100)}%</span>
            <button className="icon-btn" onClick={() => setZoom(Math.min(1.6, +(zoom + 0.1).toFixed(1)))} aria-label="Zoom in">+</button>
          </span>
        </div>
        {drawing && (
          <p className="draw-hint small">
            {pending ? <>Now click the second person. Line goes from <b>{nodeName(tree.nodes.find((n) => n.id === pending))}</b>. (Esc to cancel)</> : <>Click the first person{story.treeLineTypes.find((l) => l.id === lineType)?.shape === 'down' ? ' (the parent / older one)' : ''}.</>}
          </p>
        )}

        <div className="tree-canvas" ref={scrollRef} onClick={(e) => e.target === e.currentTarget && setSel(null)}>
          <div className={'tree-board' + (drawing ? ' drawing' : '')} style={{ width: width * zoom, height: height * zoom }} onClick={(e) => e.target === e.currentTarget && setSel(null)}>
            <div className="tree-scale" style={{ width, height, transform: `scale(${zoom})` }}>
              <svg width={width} height={height} className="tree-lines">
                {tree.links.map((l) => {
                  const a = tree.nodes.find((n) => n.id === l.from);
                  const b = tree.nodes.find((n) => n.id === l.to);
                  const lt = story.treeLineTypes.find((t) => t.id === l.typeId) ?? story.treeLineTypes[0];
                  if (!a || !b || !lt) return null;
                  const pa = pos(a), pb = pos(b);
                  const { d, mid } = linkPath(pa, pb, lt.shape);
                  const on = sel?.kind === 'link' && sel.id === l.id;
                  return (
                    <g key={l.id} className="tree-link" onClick={(e) => { e.stopPropagation(); setSel({ kind: 'link', id: l.id }); }}>
                      <path d={d} stroke="transparent" strokeWidth={16} fill="none" />
                      {on && <path d={d} stroke={lt.color} strokeOpacity={0.25} strokeWidth={12} fill="none" />}
                      <StyledPath d={d} lt={lt} bg={bg} />
                      {l.label && (
                        <text x={mid.x} y={mid.y} className="tree-link-label" textAnchor="middle" dominantBaseline="middle" style={{ stroke: bg }}>
                          {l.label}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
              {tree.nodes.map((n) => {
                const c = charOf(n);
                const p = pos(n);
                const on = (sel?.kind === 'node' && sel.id === n.id) || pending === n.id;
                return (
                  <div
                    key={n.id}
                    className={'tree-card' + (on ? ' on' : '') + (n.charId ? '' : ' name-only')}
                    style={{ left: p.x, top: p.y, width: NODE_W, height: NODE_H, borderColor: c?.color }}
                    onPointerDown={(e) => onPointerDown(e, n)}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!dragPos) clickNode(n.id);
                    }}
                  >
                    {c ? <Avatar c={c} size={34} /> : <span className="tree-initial">{(n.name || '?')[0]?.toUpperCase()}</span>}
                    <b className="tree-card-name">{n.charId ? c?.name || '(removed character)' : n.name || 'Unnamed'}</b>
                    {n.note && <span className="tree-card-note">{n.note}</span>}
                  </div>
                );
              })}
              {!tree.nodes.length && <p className="tree-empty muted">Add people from the list on the left. They'll appear here, ready to drag into place.</p>}
            </div>
          </div>
        </div>

        {(selNode || selLink) && (
          <div className="tree-inspector card">
            {selNode && (
              <>
                {selNode.charId ? (
                  <b className="row gap">
                    {charOf(selNode) && <Avatar c={charOf(selNode)!} size={26} />} {nodeName(selNode)}
                    {charOf(selNode) && <Link className="small" to={`${base}/characters/${selNode.charId}`}>open card →</Link>}
                  </b>
                ) : (
                  <input className="input slim" value={selNode.name ?? ''} placeholder="Name" onChange={(e) => setTree((t) => void (t.nodes.find((n) => n.id === selNode.id)!.name = e.target.value))} />
                )}
                <input
                  className="input slim"
                  value={selNode.note}
                  placeholder="Note or dates, e.g. b. 1203 – † 1250, missing, “the aunt”"
                  onChange={(e) => setTree((t) => void (t.nodes.find((n) => n.id === selNode.id)!.note = e.target.value))}
                />
                <button
                  className="btn small ghost danger"
                  onClick={() => {
                    setTree((t) => {
                      t.nodes = t.nodes.filter((n) => n.id !== selNode.id);
                      t.links = t.links.filter((l) => l.from !== selNode.id && l.to !== selNode.id);
                    });
                    setSel(null);
                  }}
                >
                  Remove from tree
                </button>
              </>
            )}
            {selLink && (
              <>
                <span className="small">
                  <b>{nodeName(tree.nodes.find((n) => n.id === selLink.from))}</b> → <b>{nodeName(tree.nodes.find((n) => n.id === selLink.to))}</b>
                </span>
                <select className="input slim" value={selLink.typeId} onChange={(e) => setTree((t) => void (t.links.find((l) => l.id === selLink.id)!.typeId = e.target.value))}>
                  {story.treeLineTypes.map((lt) => (
                    <option key={lt.id} value={lt.id}>{lt.label}</option>
                  ))}
                </select>
                <input className="input slim" value={selLink.label} placeholder="Label on the line (optional)" onChange={(e) => setTree((t) => void (t.links.find((l) => l.id === selLink.id)!.label = e.target.value))} />
                <button className="btn small ghost" onClick={() => setTree((t) => { const l = t.links.find((x) => x.id === selLink.id)!; [l.from, l.to] = [l.to, l.from]; })} title="Swap which end is which">⇅ Flip</button>
                <button className="btn small ghost danger" onClick={() => { setTree((t) => void (t.links = t.links.filter((l) => l.id !== selLink.id))); setSel(null); }}>Delete line</button>
              </>
            )}
            <button className="icon-btn" onClick={() => setSel(null)} aria-label="Close">✕</button>
          </div>
        )}
      </div>
    </div>
  );
}

/** The empty spot nearest to (x, y), so new people never land on top of someone. */
function freeSpot(nodes: TreeNode[], x: number, y: number) {
  const gapX = NODE_W + 36;
  const gapY = NODE_H + 48;
  const clear = (px: number, py: number) => nodes.every((n) => Math.abs(n.x - px) >= NODE_W + 12 || Math.abs(n.y - py) >= NODE_H + 12);
  for (let ring = 0; ring < 12; ring++) {
    for (let dy = -ring; dy <= ring; dy++) {
      for (let dx = -ring; dx <= ring; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        const px = snap(Math.max(12, x + dx * gapX));
        const py = snap(Math.max(12, y + dy * gapY));
        if (clear(px, py)) return { x: px, y: py };
      }
    }
  }
  return { x: snap(x), y: snap(y) };
}

/** A family-tree elbow for 'down' lines (older above younger), otherwise a straight line between centres. */
function linkPath(a: { x: number; y: number }, b: { x: number; y: number }, shape: TreeLineType['shape']) {
  const ac = { x: a.x + NODE_W / 2, y: a.y + NODE_H / 2 };
  const bc = { x: b.x + NODE_W / 2, y: b.y + NODE_H / 2 };
  if (shape === 'down') {
    const [top, bottom] = a.y <= b.y ? [a, b] : [b, a];
    const sx = top.x + NODE_W / 2, sy = top.y + NODE_H;
    const ex = bottom.x + NODE_W / 2, ey = bottom.y;
    if (ey - sy > 24) {
      const my = sy + (ey - sy) / 2;
      return { d: `M${sx},${sy} V${my} H${ex} V${ey}`, mid: { x: (sx + ex) / 2, y: my - 10 } };
    }
  }
  return { d: `M${ac.x},${ac.y} L${bc.x},${bc.y}`, mid: { x: (ac.x + bc.x) / 2, y: (ac.y + bc.y) / 2 - 10 } };
}

function StyledPath({ d, lt, bg }: { d: string; lt: TreeLineType; bg: string }) {
  if (lt.style === 'double')
    return (
      <>
        <path d={d} stroke={lt.color} strokeWidth={7} fill="none" strokeLinejoin="round" />
        <path d={d} stroke={bg} strokeWidth={2.5} fill="none" strokeLinejoin="round" />
      </>
    );
  return <path d={d} stroke={lt.color} strokeWidth={2.6} fill="none" strokeDasharray={DASH[lt.style]} strokeLinecap="round" strokeLinejoin="round" />;
}

function LineSample({ lt, bg }: { lt: TreeLineType; bg: string }) {
  return (
    <svg width="40" height="14" aria-hidden>
      <StyledPath d="M3,7 L37,7" lt={lt} bg={bg} />
    </svg>
  );
}

// ---------------------------------------------------------------- line types

function LineTypesEditor({ story, onClose }: { story: Story; onClose: () => void }) {
  const { upd } = useStoryCtx();
  const bg = palette(story.theme).surface;
  const used = (id: string) => story.trees.reduce((n, t) => n + t.links.filter((l) => l.typeId === id).length, 0);
  return (
    <Modal title="Line types" onClose={onClose} wide>
      <p className="muted small">The kinds of lines you can draw in this story's trees. <b>Down</b> lines bend like a family tree from the upper person to the lower one; <b>straight</b> lines go directly between two people.</p>
      <div className="types-list">
        {story.treeLineTypes.map((lt, i) => (
          <div key={lt.id} className="linetype-row">
            <LineSample lt={lt} bg={bg} />
            <Field value={lt.label} placeholder="Name" onChange={(v) => upd((s) => void (s.treeLineTypes[i].label = v))} />
            <select className="input slim" value={lt.style} onChange={(e) => upd((s) => void (s.treeLineTypes[i].style = e.target.value as LineStyle))}>
              <option value="solid">Solid</option>
              <option value="dashed">Dashed</option>
              <option value="dotted">Dotted</option>
              <option value="double">Double</option>
            </select>
            <select className="input slim" value={lt.shape} onChange={(e) => upd((s) => void (s.treeLineTypes[i].shape = e.target.value as TreeLineType['shape']))}>
              <option value="down">Down (generations)</option>
              <option value="straight">Straight</option>
            </select>
            <ColorPick value={lt.color} onChange={(v) => upd((s) => void (s.treeLineTypes[i].color = v))} />
            <button
              className="icon-btn danger"
              disabled={story.treeLineTypes.length < 2}
              title="Delete"
              onClick={() => {
                const n = used(lt.id);
                if (n && !confirm(`${n} line(s) use “${lt.label}”. They'll switch to “${story.treeLineTypes.find((x) => x.id !== lt.id)!.label}”. Continue?`)) return;
                upd((s) => {
                  const fallback = s.treeLineTypes.find((x) => x.id !== lt.id)!.id;
                  s.trees.forEach((t) => t.links.forEach((l) => l.typeId === lt.id && (l.typeId = fallback)));
                  s.treeLineTypes.splice(i, 1);
                });
              }}
            >
              🗑
            </button>
          </div>
        ))}
      </div>
      <div className="row between" style={{ marginTop: 12 }}>
        <button className="btn small" onClick={() => upd((s) => void s.treeLineTypes.push({ id: uid(), label: 'New line', color: '#3a86ff', style: 'solid', shape: 'straight' }))}>+ Line type</button>
        <button className="btn primary" onClick={onClose}>Done</button>
      </div>
    </Modal>
  );
}

