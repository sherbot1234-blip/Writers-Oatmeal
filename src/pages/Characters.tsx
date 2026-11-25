import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStoryCtx } from '../storyContext';
import { Avatar, ColorPick, DropZone, Empty, Field, Modal } from '../components/ui';
import { FramedImg } from '../components/Framed';
import { SectionList } from '../components/Sections';
import { cloneSectionShape, defaultCharacterTemplate } from '../defaults';
import { move, SWATCHES, uid } from '../util';
import type { Character, Story } from '../types';
import { catsOf, groupCharacters } from '../categories';
import { useLibrary } from '../store';
import { includeShared } from '../universe';

export function newCharacterFor(story: Story) {
  return {
    id: uid(),
    name: '',
    role: '',
    color: SWATCHES[story.characters.length % SWATCHES.length],
    sections: story.characterTemplate.map(cloneSectionShape),
  };
}

export default function Characters() {
  const { story, upd, base, universe } = useStoryCtx();
  const { update } = useLibrary();
  const nav = useNavigate();
  const [templateOpen, setTemplateOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const sharedIds = new Set(story.sharedCharacterIds);
  const available = universe ? universe.characters.filter((c) => !sharedIds.has(c.id)) : [];

  const [tab, setTab] = useState<string>('all');
  const [catsOpen, setCatsOpen] = useState(false);
  const [tagging, setTagging] = useState<string | null>(null);
  const cats = story.charCategories;
  const groups = groupCharacters(story, story.characters);
  const hasLoose = groups.some((g) => !g.cat);

  const add = (catId?: string) => {
    const c = newCharacterFor(story);
    upd((s) => {
      s.characters.push(c);
      if (catId) s.charCategoryMap[c.id] = [catId];
    });
    nav(`${base}/characters/${c.id}`);
  };

  /** Swap a character with its neighbour in the list you're looking at. */
  const nudge = (list: Character[], c: Character, dir: -1 | 1) => {
    const j = list.indexOf(c) + dir;
    if (j < 0 || j >= list.length) return;
    const other = list[j].id;
    upd((s) => {
      const a = s.characters.findIndex((x) => x.id === c.id);
      const b = s.characters.findIndex((x) => x.id === other);
      if (a >= 0 && b >= 0) [s.characters[a], s.characters[b]] = [s.characters[b], s.characters[a]];
    });
  };

  const toggleCat = (charId: string, catId: string) =>
    upd((s) => {
      const cur = s.charCategoryMap[charId] ?? [];
      s.charCategoryMap[charId] = cur.includes(catId) ? cur.filter((x) => x !== catId) : [...cur, catId];
    });

  const grid = (list: Character[], catId?: string) => (
    <div className="char-grid">
      {list.map((c) => {
        const facts = c.sections.find((x) => x.kind === 'facts')?.facts?.filter((f) => f.value).slice(0, 3) ?? [];
        const myCats = catsOf(story, c.id);
        return (
          <DropZone
            key={c.id}
            className="char-card card"
            style={{ borderTopColor: c.color }}
            label={`Drop a picture of ${c.name || 'them'}`}
            onPick={([src]) => upd((s) => { const x = s.characters.find((y) => y.id === c.id); if (x) { x.image = src; x.imageFrame = undefined; } })}
          >
            <Link to={`${base}/characters/${c.id}`} className="char-card-link">
              <div className="char-card-img" style={{ background: c.color + '33' }}>
                {c.image ? <FramedImg src={c.image} frame={c.imageFrame} className="fill" /> : <Avatar c={c} size={72} />}
              </div>
              <div className="char-card-body">
                {(sharedIds.has(c.id) || myCats.length > 0) && (
                  <div className="char-card-cats">
                    {sharedIds.has(c.id) && <span className="kind-badge shared-badge" title={`Shared from ${universe?.title}`}>🌌 shared</span>}
                    {myCats.map((k) => (
                      <span key={k.id} className="cat-badge" style={{ ['--cc' as any]: k.color }}>{k.icon} {k.name}</span>
                    ))}
                  </div>
                )}
                <h3>{c.name || 'Unnamed'}</h3>
                {c.role && <p className="muted small">{c.role}</p>}
                {facts.map((f) => (
                  <p key={f.id} className="small">
                    <span className="muted">{f.label}:</span> {f.value}
                  </p>
                ))}
              </div>
            </Link>
            <div className="char-card-tools">
              {cats.length > 0 && <button className="icon-btn tiny" title="Categories" onClick={() => setTagging(tagging === c.id ? null : c.id)}>🏷</button>}
              <button className="icon-btn tiny" title="Move earlier" onClick={() => nudge(list, c, -1)}>←</button>
              <button className="icon-btn tiny" title="Move later" onClick={() => nudge(list, c, 1)}>→</button>
            </div>
            {tagging === c.id && (
              <div className="tag-pop card" onMouseLeave={() => setTagging(null)}>
                {cats.map((k) => (
                  <label key={k.id} className="row gap small">
                    <input type="checkbox" checked={(story.charCategoryMap[c.id] ?? []).includes(k.id)} onChange={() => toggleCat(c.id, k.id)} /> {k.icon} {k.name}
                  </label>
                ))}
              </div>
            )}
          </DropZone>
        );
      })}
      <button className="char-card add card" onClick={() => add(catId)}>+ New character</button>
    </div>
  );

  const shownGroups = tab === 'all' ? groups : tab === 'none' ? groups.filter((g) => !g.cat) : groups.filter((g) => g.cat?.id === tab);

  return (
    <div className="page">
      <div className="page-head">
        <h1>{story.kind === 'universe' ? 'Shared cast' : 'Characters'}</h1>
        <div className="row gap wrap">
          <button className="btn ghost" onClick={() => setCatsOpen(true)}>🏷 Categories</button>
          <button className="btn ghost" onClick={() => setTemplateOpen(true)}>Card layout</button>
          {universe && (
            <button className="btn" onClick={() => setPicking(true)} disabled={!available.length} title={available.length ? '' : 'Every shared character is already in this story'}>
              🌌 Add from {universe.title || 'universe'}
            </button>
          )}
          <button className="btn primary" onClick={() => add(cats.some((k) => k.id === tab) ? tab : undefined)}>+ New character</button>
        </div>
      </div>

      {story.kind === 'universe' && (
        <p className="muted small">
          Characters here can appear in any story in this universe. Edit them once and every story sees the change. In a story, use <b>🌌 Add from universe</b> to bring them in.
        </p>
      )}

      {cats.length > 0 && (
        <nav className="sub-tabs">
          <button className={tab === 'all' ? 'on' : ''} onClick={() => setTab('all')}>All ({story.characters.length})</button>
          {cats.map((k) => (
            <button key={k.id} className={tab === k.id ? 'on' : ''} onClick={() => setTab(k.id)} style={tab === k.id ? undefined : { borderColor: k.color }}>
              {k.icon} {k.name} ({groups.find((g) => g.cat?.id === k.id)?.chars.length ?? 0})
            </button>
          ))}
          {hasLoose && <button className={tab === 'none' ? 'on' : ''} onClick={() => setTab('none')}>No category</button>}
        </nav>
      )}

      {story.characters.length === 0 ? (
        <Empty icon="👤" title="No characters yet">
          <p className="muted">
            New characters start with this story's card layout. Use <b>🏷 Categories</b> to sort them into groups, like Humans, Dragons, or The Ancients.
          </p>
        </Empty>
      ) : cats.length === 0 ? (
        grid(story.characters)
      ) : shownGroups.length === 0 ? (
        <>
          <p className="muted">Nobody in this category yet. Open a character and tick it, or use 🏷 on their card.</p>
          {grid([], cats.some((k) => k.id === tab) ? tab : undefined)}
        </>
      ) : (
        shownGroups.map((g, gi) => (
          <section key={g.cat?.id ?? 'none' + gi} className="char-group">
            <h2 className="char-group-title" style={g.cat ? { ['--cc' as any]: g.cat.color } : undefined}>
              <span>{g.cat ? `${g.cat.icon} ${g.cat.name}` : 'No category'}</span>
              <span className="muted small">{g.chars.length}</span>
            </h2>
            {grid(g.chars, g.cat?.id)}
          </section>
        ))
      )}

      {catsOpen && <CategoriesEditor story={story} onClose={() => setCatsOpen(false)} />}

      {picking && universe && (
        <Modal title={`Add characters from ${universe.title || 'the universe'}`} onClose={() => setPicking(false)}>
          <p className="muted small">They stay linked: edits made here or in any other story show up everywhere.</p>
          <div className="pick-list">
            {available.map((c) => (
              <button
                key={c.id}
                className="pick-item"
                onClick={() => {
                  update((d) => includeShared(d, story.id, [c.id]));
                  if (available.length === 1) setPicking(false);
                }}
              >
                <Avatar c={c} size={36} />
                <span>
                  <b>{c.name || 'Unnamed'}</b>
                  {c.role && <span className="muted small"> · {c.role}</span>}
                </span>
                <span className="muted">+ Add</span>
              </button>
            ))}
          </div>
          <div className="row end" style={{ marginTop: 12 }}>
            <button className="btn primary" onClick={() => setPicking(false)}>Done</button>
          </div>
        </Modal>
      )}

      {templateOpen && (
        <Modal title="Character card layout" onClose={() => setTemplateOpen(false)} wide>
          <p className="muted small">
            This is the starting layout for <b>new</b> characters in <i>{story.title || 'this story'}</i>. Add, remove, rename and reorder sections and rows. Existing characters keep their own layout — open one and use{' '}
            <b>Add missing layout sections</b> to bring it up to date.
          </p>
          <SectionList templateMode accent={story.theme.accent} sections={story.characterTemplate} edit={(fn) => upd((s) => fn(s.characterTemplate))} />
          <div className="row gap end" style={{ marginTop: 12 }}>
            <button className="btn ghost small" onClick={() => confirm('Reset the layout to the default sections?') && upd((s) => void (s.characterTemplate = defaultCharacterTemplate()))}>
              Reset to default
            </button>
            <button className="btn primary" onClick={() => setTemplateOpen(false)}>Done</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

const CAT_ICONS = ['🧍', '🐉', '⏳', '👑', '🗡️', '🧙', '🐺', '🕵️', '🎮', '👻', '🌿', '⭐'];

function CategoriesEditor({ story, onClose }: { story: Story; onClose: () => void }) {
  const { upd } = useStoryCtx();
  const count = (id: string) => Object.values(story.charCategoryMap).filter((ids) => ids.includes(id)).length;
  return (
    <Modal title="Character categories" onClose={onClose}>
      <p className="muted small">Groups for this story's characters, e.g. Humans, Dragons, The Ancients (800 years ago). A character can be in more than one.</p>
      <div className="types-list">
        {story.charCategories.map((k, i) => (
          <div key={k.id} className="cat-row">
            <input className="emoji-input" value={k.icon} onChange={(e) => upd((s) => void (s.charCategories[i].icon = e.target.value))} aria-label="Icon" />
            <Field value={k.name} placeholder="Category name" onChange={(v) => upd((s) => void (s.charCategories[i].name = v))} />
            <ColorPick value={k.color} onChange={(v) => upd((s) => void (s.charCategories[i].color = v))} />
            <span className="muted small">{count(k.id)}</span>
            <button className="icon-btn" title="Move up" onClick={() => upd((s) => move(s.charCategories, i, i - 1))}>↑</button>
            <button
              className="icon-btn danger"
              title="Delete category"
              onClick={() => {
                if (count(k.id) && !confirm(`Delete “${k.name}”? The characters stay; they just leave this group.`)) return;
                upd((s) => {
                  s.charCategories.splice(i, 1);
                  for (const id of Object.keys(s.charCategoryMap)) s.charCategoryMap[id] = s.charCategoryMap[id].filter((x) => x !== k.id);
                });
              }}
            >
              🗑
            </button>
          </div>
        ))}
      </div>
      <div className="row between wrap gap" style={{ marginTop: 12 }}>
        <button
          className="btn small"
          onClick={() =>
            upd((s) => void s.charCategories.push({ id: uid(), name: 'New group', icon: CAT_ICONS[s.charCategories.length % CAT_ICONS.length], color: SWATCHES[(s.charCategories.length * 3) % SWATCHES.length] }))
          }
        >
          + Category
        </button>
        <button className="btn primary" onClick={onClose}>Done</button>
      </div>
    </Modal>
  );
}
