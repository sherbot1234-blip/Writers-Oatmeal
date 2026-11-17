import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStoryCtx } from '../storyContext';
import { Avatar, Empty, Modal } from '../components/ui';
import { SectionList } from '../components/Sections';
import { cloneSectionShape, defaultCharacterTemplate } from '../defaults';
import { move, SWATCHES, uid } from '../util';
import type { Story } from '../types';
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

  const add = () => {
    const c = newCharacterFor(story);
    upd((s) => void s.characters.push(c));
    nav(`${base}/characters/${c.id}`);
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>{story.kind === 'universe' ? 'Shared cast' : 'Characters'}</h1>
        <div className="row gap wrap">
          <button className="btn ghost" onClick={() => setTemplateOpen(true)}>Character card layout</button>
          {universe && (
            <button className="btn" onClick={() => setPicking(true)} disabled={!available.length} title={available.length ? '' : 'Every shared character is already in this story'}>
              🌌 Add from {universe.title || 'universe'}
            </button>
          )}
          <button className="btn primary" onClick={add}>+ New character</button>
        </div>
      </div>

      {story.kind === 'universe' && (
        <p className="muted small">
          Characters here can appear in any story in this universe. Edit them once and every story sees the change. In a story, use <b>🌌 Add from universe</b> to bring them in.
        </p>
      )}
      {story.characters.length === 0 ? (
        <Empty icon="👤" title="No characters yet">
          <p className="muted">
            New characters start with this story's card layout. Change it with <b>Character card layout</b>, or add and remove sections on any single character.
          </p>
        </Empty>
      ) : (
        <div className="char-grid">
          {story.characters.map((c, i) => {
            const facts = c.sections.find((s) => s.kind === 'facts')?.facts?.filter((f) => f.value).slice(0, 3) ?? [];
            return (
              <div key={c.id} className="char-card card" style={{ borderTopColor: c.color }}>
                <Link to={`${base}/characters/${c.id}`} className="char-card-link">
                  <div className="char-card-img" style={{ background: c.image ? `url(${c.image}) center/cover` : c.color + '33' }}>
                    {!c.image && <Avatar c={c} size={72} />}
                  </div>
                  <div className="char-card-body">
                    {sharedIds.has(c.id) && <span className="kind-badge shared-badge" title={`Shared from ${universe?.title}`}>🌌 shared</span>}
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
                  <button className="icon-btn tiny" title="Move earlier" onClick={() => upd((s) => move(s.characters, i, i - 1))}>←</button>
                  <button className="icon-btn tiny" title="Move later" onClick={() => upd((s) => move(s.characters, i, i + 1))}>→</button>
                </div>
              </div>
            );
          })}
          <button className="char-card add card" onClick={add}>+ New character</button>
        </div>
      )}

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
