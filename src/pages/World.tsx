import { useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useStoryCtx } from '../storyContext';
import { useStory, type StoryUpdater } from '../store';
import { useLibrary } from '../store';
import { trashItem } from '../trash';
import { Avatar, CharacterChips, DropZone, Empty, Field, ImagePick, Modal } from '../components/ui';
import { AdjustButton, FramedImg } from '../components/Framed';
import { QUESTION_BANK } from '../defaults';
import { move, uid } from '../util';
import type { Character, LoreEntry, Pin, Story, WorldImage } from '../types';

type Tab = 'wiki' | 'maps' | 'timeline' | 'glossary' | 'questions';
const TABS: [Tab, string][] = [
  ['wiki', '📜 Wiki'],
  ['maps', '🗺️ Maps & images'],
  ['timeline', '⏳ Timeline'],
  ['glossary', '🔤 Glossary'],
  ['questions', '❓ Questions'],
];

interface WorldProps {
  w: Story;
  wu: StoryUpdater;
  characters: Character[];
}

export default function World() {
  const { story, upd, universe, base } = useStoryCtx();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'wiki';
  const scope = universe && params.get('scope') === 'universe' ? 'universe' : 'story';
  const [uStory, uUpd] = useStory(universe?.id);
  const setParam = (k: string, v: string | null) => {
    const n = new URLSearchParams(params);
    if (v === null) n.delete(k);
    else n.set(k, v);
    setParams(n, { replace: true });
  };

  // which world we're looking at: this story's own, or its universe's shared one
  const props: WorldProps =
    scope === 'universe' && uStory ? { w: uStory, wu: uUpd, characters: uStory.characters } : { w: story, wu: upd, characters: story.characters };

  return (
    <div className="page">
      <div className="page-head">
        <h1>World</h1>
        {universe && (
          <div className="seg scope-seg" title="Places, lore and maps can belong to this story or be shared by the whole universe">
            <button className={scope === 'story' ? 'on' : ''} onClick={() => setParam('scope', null)}>This story</button>
            <button className={scope === 'universe' ? 'on' : ''} onClick={() => setParam('scope', 'universe')}>🌌 {universe.title || 'Universe'}</button>
          </div>
        )}
      </div>
      {scope === 'universe' && universe && (
        <p className="shared-note small">
          You're editing the shared world of <Link to={`/universe/${universe.id}`}>{universe.title}</Link>. Every story in it sees these pages.
        </p>
      )}
      <nav className="sub-tabs">
        {TABS.map(([k, label]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => {
              const n = new URLSearchParams(params);
              n.delete('entry');
              if (k === 'wiki') n.delete('tab');
              else n.set('tab', k);
              setParams(n, { replace: true });
            }}>
            {label}
          </button>
        ))}
      </nav>
      {tab === 'wiki' && <Wiki {...props} selected={params.get('entry')} onSelect={(id) => setParam('entry', id)} base={base} />}
      {tab === 'maps' && (
        <Maps
          {...props}
          onOpenEntry={(id) => {
            const n = new URLSearchParams(params);
            n.delete('tab');
            n.set('entry', id);
            setParams(n);
          }}
        />
      )}
      {tab === 'timeline' && <Timeline {...props} />}
      {tab === 'glossary' && <Glossary {...props} />}
      {tab === 'questions' && <Questions {...props} />}
    </div>
  );
}

// ---------------------------------------------------------------- wiki

function Wiki({ w, wu, characters, selected, onSelect }: WorldProps & { selected: string | null; onSelect: (id: string | null) => void; base: string }) {
  const [q, setQ] = useState('');
  const cats = [...w.loreCategories, ...new Set(w.lore.map((e) => e.category).filter((c) => !w.loreCategories.includes(c)))];
  const entry = w.lore.find((e) => e.id === selected);
  const match = (e: LoreEntry) => !q || [e.name, e.summary, e.body, e.category].some((x) => x.toLowerCase().includes(q.toLowerCase()));

  const create = (category: string) => {
    const e: LoreEntry = { id: uid(), category, name: '', summary: '', body: '', facts: [], characterIds: [], entryIds: [] };
    wu((s) => void s.lore.push(e));
    onSelect(e.id);
  };

  return (
    <div className={'wiki' + (entry ? ' has-entry' : '')}>
      <aside className="wiki-index card">
        <input className="input slim" placeholder="Search the wiki…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: '100%' }} />
        {cats.map((cat, ci) => {
          const items = w.lore.filter((e) => e.category === cat && match(e)).sort((a, b) => a.name.localeCompare(b.name));
          if (q && !items.length) return null;
          const known = ci < w.loreCategories.length;
          return (
            <div key={cat} className="wiki-cat">
              <div className="wiki-cat-head">
                {known ? (
                  <Field
                    value={cat}
                    onChange={(v) =>
                      wu((s) => {
                        s.loreCategories[ci] = v;
                        s.lore.forEach((e) => e.category === cat && (e.category = v));
                      })
                    }
                  />
                ) : (
                  <span>{cat}</span>
                )}
                <button className="icon-btn tiny" title={`New page in ${cat}`} onClick={() => create(cat)}>+</button>
                {known && !w.lore.some((e) => e.category === cat) && (
                  <button className="icon-btn tiny danger" title="Remove empty category" onClick={() => wu((s) => void s.loreCategories.splice(ci, 1))}>×</button>
                )}
              </div>
              {items.map((e) => (
                <button key={e.id} className={'wiki-link' + (e.id === selected ? ' on' : '')} onClick={() => onSelect(e.id)}>
                  {e.name || 'Untitled page'}
                </button>
              ))}
            </div>
          );
        })}
        <button
          className="btn small ghost"
          onClick={() => {
            const name = prompt('New category (e.g. Dragon species, Guilds, Crime scenes)');
            if (name?.trim() && !w.loreCategories.includes(name.trim())) wu((s) => void s.loreCategories.push(name.trim()));
          }}
        >
          + Category
        </button>
      </aside>

      <div className="wiki-main">
        {entry ? (
          <EntryPage w={w} wu={wu} characters={characters} entry={entry} cats={cats} onSelect={onSelect} />
        ) : w.lore.length ? (
          <WikiHome w={w} onSelect={onSelect} />
        ) : (
          <Empty icon="📜" title="Your world wiki is empty">
            <p className="muted">One page per place, faction, creature, item, spell… Each can have a picture, facts, the characters connected to it, and links to other pages.</p>
            <button className="btn primary" onClick={() => create(cats[0] ?? 'Places')}>+ First page</button>
          </Empty>
        )}
      </div>
    </div>
  );
}

function WikiHome({ w, onSelect }: { w: Story; onSelect: (id: string) => void }) {
  return (
    <div className="wiki-home">
      {w.lore.map((e) => (
        <button key={e.id} className="card wiki-tile" onClick={() => onSelect(e.id)}>
          {e.image ? <FramedImg src={e.image} frame={e.imageFrame} className="wiki-tile-img" /> : <span className="wiki-tile-noimg">📜</span>}
          <span className="kind-badge">{e.category}</span>
          <b>{e.name || 'Untitled page'}</b>
          {e.summary && <span className="muted small">{e.summary}</span>}
        </button>
      ))}
    </div>
  );
}

function EntryPage({ w, wu, characters, entry, cats, onSelect }: WorldProps & { entry: LoreEntry; cats: string[]; onSelect: (id: string | null) => void }) {
  const { update } = useLibrary();
  const i = w.lore.findIndex((e) => e.id === entry.id);
  const set = (fn: (e: LoreEntry) => void) => wu((s) => fn(s.lore[i]));
  const linked = entry.entryIds.map((id) => w.lore.find((e) => e.id === id)).filter((e): e is LoreEntry => !!e);
  const backlinks = w.lore.filter((e) => e.entryIds.includes(entry.id) && !entry.entryIds.includes(e.id));
  const onMaps = w.worldImages.flatMap((img) => (img.pins ?? []).filter((p) => p.entryId === entry.id).map((p) => ({ img, p })));

  return (
    <article className="card entry">
      <button className="btn small ghost wiki-back" onClick={() => onSelect(null)}>← All pages</button>
      <div className="entry-top">
        <DropZone className="entry-img" maxDim={1600} onPick={([src]) => set((e) => { e.image = src; e.imageFrame = undefined; })}>
          {entry.image ? <FramedImg src={entry.image} frame={entry.imageFrame} className="fill" /> : <span className="muted small">No picture<br />drag one here</span>}
          <span className="entry-img-btn row gap">
            {entry.image && <AdjustButton src={entry.image} frame={entry.imageFrame} aspect={4 / 3} label="✥" onSave={(f) => set((e) => void (e.imageFrame = f))} />}
            <ImagePick className="btn small" maxDim={1600} onPick={([src]) => set((e) => { e.image = src; e.imageFrame = undefined; })}>{entry.image ? '↻' : '+ Picture'}</ImagePick>
          </span>
        </DropZone>
        <div className="entry-head">
          <select className="input slim" value={entry.category} onChange={(e) => set((x) => void (x.category = e.target.value))}>
            {cats.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <Field className="h-title" value={entry.name} placeholder="Page name" onChange={(v) => set((e) => void (e.name = v))} />
          <Field multiline className="h-tagline" value={entry.summary} placeholder="One-line summary" onChange={(v) => set((e) => void (e.summary = v))} />
        </div>
      </div>

      <div className="facts">
        {entry.facts.map((f, fi) => (
          <div className="fact" key={f.id}>
            <Field className="fact-label" value={f.label} placeholder="Label" onChange={(v) => set((e) => void (e.facts[fi].label = v))} />
            <Field multiline className="fact-value" value={f.value} placeholder="—" onChange={(v) => set((e) => void (e.facts[fi].value = v))} />
            <span className="fact-tools">
              <button className="icon-btn tiny danger" onClick={() => set((e) => void e.facts.splice(fi, 1))} title="Remove row">×</button>
            </span>
          </div>
        ))}
        <button className="btn small ghost" onClick={() => set((e) => void e.facts.push({ id: uid(), label: '', value: '' }))}>+ Fact (ruler, population, danger level…)</button>
      </div>

      <Field multiline className="prose entry-body" value={entry.body} placeholder="Everything about it: history, rules, secrets…" onChange={(v) => set((e) => void (e.body = v))} />

      <label className="lbl">Characters connected to it</label>
      <CharacterChips characters={characters} selected={entry.characterIds} onChange={(ids) => set((e) => void (e.characterIds = ids))} />

      <label className="lbl">Related pages</label>
      <div className="chip-row">
        {linked.map((e) => (
          <span key={e.id} className="chip on">
            <button className="link-btn" onClick={() => onSelect(e.id)}>{e.name || 'Untitled'}</button>
            <button className="icon-btn tiny" aria-label="Unlink" onClick={() => set((x) => void (x.entryIds = x.entryIds.filter((y) => y !== e.id)))}>×</button>
          </span>
        ))}
        <select className="input slim" value="" onChange={(ev) => ev.target.value && set((x) => void x.entryIds.push(ev.target.value))}>
          <option value="">+ link a page</option>
          {w.lore.filter((e) => e.id !== entry.id && !entry.entryIds.includes(e.id)).map((e) => (
            <option key={e.id} value={e.id}>{e.name || 'Untitled'} ({e.category})</option>
          ))}
        </select>
      </div>
      {backlinks.length > 0 && (
        <p className="small muted">
          Mentioned by:{' '}
          {backlinks.map((e, k) => (
            <span key={e.id}>{k > 0 && ', '}<button className="link-btn" onClick={() => onSelect(e.id)}>{e.name || 'Untitled'}</button></span>
          ))}
        </p>
      )}
      {onMaps.length > 0 && (
        <p className="small muted">📍 On maps: {onMaps.map(({ img, p }) => `${img.title || 'Untitled map'} (${p.label || 'pin'})`).join(', ')}</p>
      )}
      <div className="row end">
        <button
          className="btn small ghost danger"
          onClick={() => {
            if (!confirm(`Delete the page “${entry.name || 'Untitled'}”? It goes to the bin for 30 days.`)) return;
            update((d) => trashItem(d, w.id, 'lore', entry.id, entry.name));
            wu((s) => {
              s.lore.forEach((e) => (e.entryIds = e.entryIds.filter((x) => x !== entry.id)));
              s.worldImages.forEach((img) => img.pins?.forEach((p) => p.entryId === entry.id && (p.entryId = undefined)));
            });
            onSelect(null);
          }}
        >
          Delete page
        </button>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------- maps

function Maps({ w, wu, onOpenEntry }: WorldProps & { onOpenEntry: (id: string) => void }) {
  const { update } = useLibrary();
  const [open, setOpen] = useState<string | null>(null);
  const add = (srcs: string[]) => wu((s) => void s.worldImages.push(...srcs.map((src) => ({ id: uid(), src, title: '', caption: '', pins: [] }))));
  const img = w.worldImages.find((x) => x.id === open);

  return (
    <>
      <div className="row between wrap gap" style={{ marginBottom: 12 }}>
        <span className="muted small">Drag pictures anywhere here to add them. Click a map to open it and drop 📍 pins that link to wiki pages.</span>
        <ImagePick multiple maxDim={2400} className="btn primary" onPick={add}>+ Upload images</ImagePick>
      </div>
      <DropZone multiple maxDim={2400} onPick={add} className="maps-drop" label="Drop maps & pictures here">
      {w.worldImages.length === 0 ? (
        <Empty icon="🗺️" title="No maps or images yet">
          <p className="muted">Drag in maps, location art, moodboards, flags, family crests, anything that shows your world, or use <b>+ Upload images</b>.</p>
        </Empty>
      ) : (
        <div className="gallery">
          {w.worldImages.map((im, i) => (
            <figure key={im.id} className="card gal-item">
              <div className="gal-img" onClick={() => setOpen(im.id)}>
                <FramedImg src={im.src} frame={im.frame} alt={im.title} className="gal-thumb" />
                {(im.pins?.length ?? 0) > 0 && <span className="pin-count">📍 {im.pins!.length}</span>}
              </div>
              <figcaption>
                <Field className="gal-title" value={im.title} placeholder="Title" onChange={(v) => wu((s) => void (s.worldImages[i].title = v))} />
                <Field multiline className="small" value={im.caption} placeholder="Notes…" onChange={(v) => wu((s) => void (s.worldImages[i].caption = v))} />
                <div className="row end">
                  <button className="icon-btn" title="Move earlier" onClick={() => wu((s) => move(s.worldImages, i, i - 1))}>←</button>
                  <AdjustButton src={im.src} frame={im.frame} aspect={4 / 3} label="✥" className="icon-btn" onSave={(f) => wu((s) => void (s.worldImages[i].frame = f))} />
                  <ImagePick className="icon-btn" maxDim={2400} onPick={([src]) => wu((s) => { s.worldImages[i].src = src; s.worldImages[i].frame = undefined; })}>↻</ImagePick>
                  <button className="icon-btn danger" title="Delete" onClick={() => confirm('Delete this picture and its pins? It goes to the bin for 30 days.') && update((d) => trashItem(d, w.id, 'worldImages', im.id, im.title || 'Picture'))}>🗑</button>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      </DropZone>
      {img && <MapViewer w={w} wu={wu} img={img} onClose={() => setOpen(null)} onOpenEntry={(id) => { setOpen(null); onOpenEntry(id); }} />}
    </>
  );
}

function MapViewer({ w, wu, img, onClose, onOpenEntry }: { w: Story; wu: StoryUpdater; img: WorldImage; onClose: () => void; onOpenEntry: (id: string) => void }) {
  const [adding, setAdding] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const pins = img.pins ?? [];
  const pin = pins.find((p) => p.id === sel);
  const setPin = (id: string, fn: (p: Pin) => void) =>
    wu((s) => {
      const p = s.worldImages.find((x) => x.id === img.id)?.pins?.find((x) => x.id === id);
      if (p) fn(p);
    });
  const entryName = (id?: string) => w.lore.find((e) => e.id === id)?.name;

  return (
    <div className="map-viewer" role="dialog" aria-modal="true">
      <div className="map-bar">
        <b>{img.title || 'Map'}</b>
        <span className="row gap">
          <button className={'btn small' + (adding ? ' primary' : '')} onClick={() => { setAdding(!adding); setSel(null); }}>
            {adding ? 'Click the map to place a pin…' : '📍 Add pin'}
          </button>
          <button className="btn small" onClick={onClose}>Close ✕</button>
        </span>
      </div>
      <div className="map-scroll" onClick={() => !adding && setSel(null)}>
        <div
          className={'map-box' + (adding ? ' adding' : '')}
          ref={boxRef}
          onClick={(e) => {
            if (!adding) return;
            e.stopPropagation();
            const r = boxRef.current!.getBoundingClientRect();
            const p: Pin = { id: uid(), x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100, label: '', note: '' };
            wu((s) => void (s.worldImages.find((x) => x.id === img.id)!.pins ??= []).push(p));
            setAdding(false);
            setSel(p.id);
            setEditing(true);
          }}
        >
          <img src={img.src} alt={img.title} draggable={false} />
          {pins.map((p) => (
            <button
              key={p.id}
              className={'pin' + (p.id === sel ? ' on' : '')}
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
              onClick={(e) => {
                e.stopPropagation();
                setSel(p.id);
                setEditing(false);
              }}
            >
              <span className="pin-dot">📍</span>
              {(p.label || entryName(p.entryId)) && <span className="pin-label">{p.label || entryName(p.entryId)}</span>}
            </button>
          ))}
          {pin && (
            <div className={'pin-pop card' + (pin.x > 65 ? ' left' : '')} style={{ left: `${pin.x}%`, top: `${pin.y}%` }} onClick={(e) => e.stopPropagation()}>
              {editing ? (
                <>
                  <input className="input slim" autoFocus placeholder="Label (e.g. Ashfall Keep)" value={pin.label} onChange={(e) => setPin(pin.id, (p) => void (p.label = e.target.value))} />
                  <select className="input slim" value={pin.entryId ?? ''} onChange={(e) => setPin(pin.id, (p) => void (p.entryId = e.target.value || undefined))}>
                    <option value="">Link to a wiki page…</option>
                    {w.lore.map((e) => (
                      <option key={e.id} value={e.id}>{e.name || 'Untitled'} ({e.category})</option>
                    ))}
                  </select>
                  <textarea className="input" rows={2} placeholder="Note" value={pin.note} onChange={(e) => setPin(pin.id, (p) => void (p.note = e.target.value))} />
                  <div className="row between">
                    <button className="btn small ghost danger" onClick={() => { wu((s) => { const m = s.worldImages.find((x) => x.id === img.id)!; m.pins = (m.pins ?? []).filter((x) => x.id !== pin.id); }); setSel(null); }}>Delete</button>
                    <button className="btn small primary" onClick={() => setEditing(false)}>Done</button>
                  </div>
                </>
              ) : (
                <>
                  <b>{pin.label || entryName(pin.entryId) || 'Pin'}</b>
                  {pin.note && <p className="small">{pin.note}</p>}
                  <div className="row gap end">
                    {pin.entryId && <button className="btn small primary" onClick={() => onOpenEntry(pin.entryId!)}>Open page →</button>}
                    <button className="btn small ghost" onClick={() => setEditing(true)}>Edit</button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- timeline

function Timeline({ w, wu, characters }: WorldProps) {
  const { update } = useLibrary();
  const [editing, setEditing] = useState<string | null>(null);
  const frozen = useRef<string[] | null>(null);
  // events with a number sort by it; the rest keep the order you made them.
  // While you're editing one, the order holds still so nothing jumps under your cursor.
  const sorted = useMemo(() => {
    const items = w.events.map((e, i) => ({ e, i }));
    if (editing && frozen.current) {
      const pos = (id: string) => {
        const k = frozen.current!.indexOf(id);
        return k < 0 ? Infinity : k;
      };
      return items.sort((a, b) => pos(a.e.id) - pos(b.e.id) || a.i - b.i);
    }
    const out = items.sort((a, b) => (a.e.year ?? Infinity) - (b.e.year ?? Infinity) || a.i - b.i);
    frozen.current = out.map((x) => x.e.id);
    return out;
  }, [w.events, editing]);
  const add = () => {
    const id = uid();
    wu((s) => void s.events.push({ id, when: '', title: '', description: '', characterIds: [] }));
    setEditing(id);
  };
  return (
    <>
      <div className="row between wrap gap" style={{ marginBottom: 12 }}>
        <span className="muted small">The history of your world: wars, discoveries, births, the day everything changed.</span>
        <button className="btn primary" onClick={add}>+ Event</button>
      </div>
      {!w.events.length ? (
        <Empty icon="⏳" title="No events yet">
          <p className="muted">Give events a date like “Year 312” plus an optional number so they sort in order.</p>
        </Empty>
      ) : (
        <ol className="history">
          {sorted.map(({ e, i }) => {
            const chars = characters.filter((c) => e.characterIds.includes(c.id));
            const set = (fn: (x: typeof e) => void) => wu((s) => fn(s.events[i]));
            const isEd = editing === e.id;
            return (
              <li key={e.id} className="history-item">
                <span className="history-dot" />
                <div className="card history-card">
                  <div className="row gap wrap">
                    <Field className="history-when" value={e.when} placeholder="When? e.g. Year 312, Age of Ash" onChange={(v) => set((x) => void (x.when = v))} />
                    {isEd && (
                      <label className="small muted row gap">
                        sort #
                        <input
                          className="input slim"
                          type="number"
                          style={{ width: 90 }}
                          value={e.year ?? ''}
                          onChange={(ev) => set((x) => void (x.year = ev.target.value === '' ? undefined : +ev.target.value))}
                        />
                      </label>
                    )}
                  </div>
                  <Field className="history-title" value={e.title} placeholder="What happened?" onChange={(v) => set((x) => void (x.title = v))} />
                  <Field multiline className="small" value={e.description} placeholder="Details…" onChange={(v) => set((x) => void (x.description = v))} />
                  {isEd ? (
                    <CharacterChips characters={characters} selected={e.characterIds} onChange={(ids) => set((x) => void (x.characterIds = ids))} />
                  ) : (
                    chars.length > 0 && <span className="row gap">{chars.map((c) => <Avatar key={c.id} c={c} size={22} />)}</span>
                  )}
                  <div className="row end gap">
                    <button className="btn small ghost" onClick={() => setEditing(isEd ? null : e.id)}>{isEd ? 'Done' : 'Edit'}</button>
                    <button className="icon-btn tiny danger" title="Delete event" onClick={() => confirm('Delete this event?') && update((d) => trashItem(d, w.id, 'events', e.id))}>🗑</button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}

// ---------------------------------------------------------------- glossary

function Glossary({ w, wu }: WorldProps) {
  const { update } = useLibrary();
  const [q, setQ] = useState('');
  const [fresh, setFresh] = useState<string | null>(null);
  const list = w.glossary
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => !q || [t.term, t.definition, t.category].some((x) => x.toLowerCase().includes(q.toLowerCase())))
    // a just-added (still blank) term stays at the top until you type it
    .sort((a, b) => (a.t.id === fresh ? -1 : b.t.id === fresh ? 1 : a.t.term.localeCompare(b.t.term, undefined, { sensitivity: 'base' })));
  let lastLetter = '';
  return (
    <>
      <div className="row between wrap gap" style={{ marginBottom: 12 }}>
        <input className="input slim" style={{ maxWidth: 300 }} placeholder="Search terms…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button
          className="btn primary"
          onClick={() => {
            const id = uid();
            wu((s) => void s.glossary.push({ id, term: '', pronunciation: '', category: '', definition: '' }));
            setFresh(id);
            setQ('');
          }}
        >
          + Term
        </button>
      </div>
      {!w.glossary.length ? (
        <Empty icon="🔤" title="No terms yet">
          <p className="muted">Invented words, names, slang, titles, spells, with how to say them.</p>
        </Empty>
      ) : (
        <div className="glossary card">
          {list.map(({ t, i }) => {
            const letter = t.id === fresh ? '' : (t.term[0] ?? '#').toUpperCase();
            const head = letter && letter !== lastLetter;
            lastLetter = letter || lastLetter;
            return (
              <div key={t.id}>
                {head && <div className="gloss-letter">{letter}</div>}
                <div className="gloss-row">
                  <div className="gloss-term">
                    <Field className="gloss-word" value={t.term} placeholder="Term" onChange={(v) => wu((s) => void (s.glossary[i].term = v))} />
                    <Field className="small muted-field" value={t.pronunciation} placeholder="/how-to-say-it/" onChange={(v) => wu((s) => void (s.glossary[i].pronunciation = v))} />
                    <Field className="small muted-field" value={t.category} placeholder="category" onChange={(v) => wu((s) => void (s.glossary[i].category = v))} />
                  </div>
                  <Field multiline className="gloss-def" value={t.definition} placeholder="Meaning…" onChange={(v) => wu((s) => void (s.glossary[i].definition = v))} />
                  <button className="icon-btn tiny danger" title="Delete term" onClick={() => update((d) => trashItem(d, w.id, 'glossary', t.id))}>×</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------- questions

function Questions({ w, wu }: WorldProps) {
  const [bank, setBank] = useState(false);
  const categories = Array.from(new Set(w.questions.map((q) => q.category)));
  const addQ = (category: string) => wu((s) => void s.questions.push({ id: uid(), category, question: '', answer: '' }));
  const swap = (id: string, dir: -1 | 1) =>
    wu((s) => {
      const i = s.questions.findIndex((q) => q.id === id);
      const cat = s.questions[i].category;
      let j = i + dir;
      while (j >= 0 && j < s.questions.length && s.questions[j].category !== cat) j += dir;
      if (j < 0 || j >= s.questions.length) return;
      [s.questions[i], s.questions[j]] = [s.questions[j], s.questions[i]];
    });
  const answered = w.questions.filter((q) => q.answer.trim()).length;

  return (
    <>
      <div className="row between wrap gap" style={{ marginBottom: 12 }}>
        <span className="muted small">{answered} of {w.questions.length} answered</span>
        <div className="row gap">
          <button className="btn" onClick={() => setBank(true)}>Question bank</button>
          <button
            className="btn primary"
            onClick={() => {
              const name = prompt('Category name', 'New category');
              if (name?.trim()) addQ(name.trim());
            }}
          >
            + Category
          </button>
        </div>
      </div>
      {categories.length === 0 && (
        <Empty icon="❓" title="No questions yet">
          <p className="muted">Add your own categories and questions, or pick some from the question bank.</p>
        </Empty>
      )}
      {categories.map((cat) => {
        const qs = w.questions.filter((q) => q.category === cat);
        return (
          <section key={qs[0].id} className="card q-cat">
            <div className="row between">
              <Field className="sec-title" value={cat} onChange={(v) => wu((s) => s.questions.forEach((q) => q.category === cat && (q.category = v)))} />
              <button
                className="icon-btn danger"
                title="Delete category"
                onClick={() => confirm(`Delete “${cat}” and its ${qs.length} questions?`) && wu((s) => void (s.questions = s.questions.filter((q) => q.category !== cat)))}
              >
                🗑
              </button>
            </div>
            {qs.map((q) => {
              const i = w.questions.findIndex((x) => x.id === q.id);
              return (
                <div key={q.id} className="qa">
                  <div className="row gap">
                    <Field className="q" value={q.question} placeholder="Your question…" onChange={(v) => wu((s) => void (s.questions[i].question = v))} />
                    <span className="qa-tools">
                      <button className="icon-btn tiny" onClick={() => swap(q.id, -1)} title="Up">↑</button>
                      <button className="icon-btn tiny" onClick={() => swap(q.id, 1)} title="Down">↓</button>
                      <button className="icon-btn tiny danger" onClick={() => wu((s) => void s.questions.splice(i, 1))} title="Delete">×</button>
                    </span>
                  </div>
                  <Field multiline className="a" value={q.answer} placeholder="Answer…" onChange={(v) => wu((s) => void (s.questions[i].answer = v))} />
                </div>
              );
            })}
            <button className="btn small ghost" onClick={() => addQ(cat)}>+ Question</button>
          </section>
        );
      })}
      {bank && <QuestionBank w={w} wu={wu} onClose={() => setBank(false)} />}
    </>
  );
}

function QuestionBank({ w, wu, onClose }: { w: Story; wu: StoryUpdater; onClose: () => void }) {
  const existing = new Set(w.questions.map((q) => q.question.trim().toLowerCase()));
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const toggle = (key: string) => {
    const n = new Set(picked);
    n.has(key) ? n.delete(key) : n.add(key);
    setPicked(n);
  };
  return (
    <Modal title="Question bank" onClose={onClose} wide>
      <p className="muted small">Pick questions to add. You can edit or delete them afterwards.</p>
      {Object.entries(QUESTION_BANK).map(([cat, qs]) => (
        <div key={cat} className="bank-cat">
          <h4>{cat}</h4>
          {qs.map((q) => {
            const key = cat + '\u0000' + q;
            const have = existing.has(q.toLowerCase());
            return (
              <label key={q} className={'bank-q' + (have ? ' muted' : '')}>
                <input type="checkbox" disabled={have} checked={have || picked.has(key)} onChange={() => toggle(key)} /> {q}
              </label>
            );
          })}
        </div>
      ))}
      <div className="row end gap" style={{ marginTop: 12 }}>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button
          className="btn primary"
          disabled={!picked.size}
          onClick={() => {
            wu((s) => {
              for (const key of picked) {
                const [category, question] = key.split('\u0000');
                let at = -1;
                s.questions.forEach((x, i) => x.category === category && (at = i));
                const q = { id: uid(), category, question, answer: '' };
                if (at >= 0) s.questions.splice(at + 1, 0, q);
                else s.questions.push(q);
              }
            });
            onClose();
          }}
        >
          Add {picked.size || ''} question{picked.size === 1 ? '' : 's'}
        </button>
      </div>
    </Modal>
  );
}
