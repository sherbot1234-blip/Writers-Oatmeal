import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { pathFor, useStoryCtx } from '../storyContext';
import { useLibrary } from '../store';
import { deleteUniverseCharacter, shareCharacter, storiesUsing } from '../universe';
import { Avatar, ColorPick, Field, ImagePick, Lightbox } from '../components/ui';
import { SectionList } from '../components/Sections';
import { Links } from '../components/Links';
import { cloneSectionShape } from '../defaults';

export default function CharacterDetail() {
  const { story, upd, base, universe } = useStoryCtx();
  const { lib, update } = useLibrary();
  const { charId } = useParams();
  const nav = useNavigate();
  const [menu, setMenu] = useState(false);
  const [zoom, setZoom] = useState(false);
  const idx = story.characters.findIndex((c) => c.id === charId);
  const c = story.characters[idx];


  if (!c)
    return (
      <div className="page">
        <p>Character not found.</p>
        <Link className="btn" to={base + '/characters'}>← All characters</Link>
      </div>
    );

  const edit = (fn: (ch: typeof c) => void) => upd((s) => fn(s.characters[idx]));
  const prev = story.characters[idx - 1];
  const next = story.characters[idx + 1];
  const relsOut = story.relationships.filter((r) => r.from === c.id);
  const relsIn = story.relationships.filter((r) => r.to === c.id);
  const typeOf = (id: string) => story.relTypes.find((t) => t.id === id);
  const nameOf = (id: string) => story.characters.find((x) => x.id === id);
  const isShared = story.sharedCharacterIds.includes(c.id);
  const usedIn = story.kind === 'universe' ? storiesUsing(lib, c.id) : isShared ? storiesUsing(lib, c.id) : [];

  const addMissing = () => {
    const have = new Set(c.sections.map((s) => s.title.trim().toLowerCase()));
    const missing = story.characterTemplate.filter((t) => !have.has(t.title.trim().toLowerCase()));
    if (!missing.length) return alert('This character already has every section from the layout.');
    edit((ch) => void ch.sections.push(...missing.map(cloneSectionShape)));
  };

  return (
    <div className="page">
      <div className="crumbs">
        <Link to={base + '/characters'}>← All characters</Link>
        <span className="row gap">
          {prev && <Link to={`${base}/characters/${prev.id}`}>‹ {prev.name || 'Unnamed'}</Link>}
          {next && <Link to={`${base}/characters/${next.id}`}>{next.name || 'Unnamed'} ›</Link>}
        </span>
      </div>

      {isShared && universe && (
        <div className="shared-note">
          🌌 Shared from <Link to={pathFor(universe)}>{universe.title || 'the universe'}</Link>. Changes here also show in{' '}
          {usedIn.length > 1 ? `${usedIn.length - 1} other ${usedIn.length === 2 ? 'story' : 'stories'}` : 'the universe'}.
        </div>
      )}
      {story.kind === 'universe' && (
        <div className="shared-note">
          🌌 Shared character.{' '}
          {usedIn.length ? (
            <>Appears in: {usedIn.map((s, i) => <span key={s.id}>{i > 0 && ', '}<Link to={pathFor(s)}>{s.title || 'Untitled'}</Link></span>)}</>
          ) : (
            'Not in any story yet: open a story in this universe and use "Add from universe".'
          )}
        </div>
      )}

      <div className="char-hero card" style={{ borderColor: c.color }}>
        <div className="char-portrait" style={{ borderColor: c.color }}>
          {c.image ? <img src={c.image} alt="" onClick={() => setZoom(true)} /> : <Avatar c={c} size={140} />}
          <div className="char-portrait-actions">
            <ImagePick className="btn small" maxDim={1000} onPick={([src]) => edit((ch) => void (ch.image = src))}>
              {c.image ? 'Change' : 'Add picture'}
            </ImagePick>
            {c.image && <button className="btn small ghost" onClick={() => edit((ch) => void (ch.image = undefined))}>Remove</button>}
          </div>
        </div>
        <div className="char-hero-text">
          <Field className="h-title" value={c.name} placeholder="Character name" onChange={(v) => edit((ch) => void (ch.name = v))} />
          <Field className="h-tagline" value={c.role} placeholder="Role — protagonist, the mentor, comic relief…" onChange={(v) => edit((ch) => void (ch.role = v))} />
          <Links links={c.links ?? []} onChange={(l) => edit((ch) => void (ch.links = l))} />
          <div className="row gap wrap" style={{ marginTop: 8 }}>
            <span className="row gap small">Colour <ColorPick value={c.color} onChange={(v) => edit((ch) => void (ch.color = v))} /></span>
            <div className="menu-wrap">
              <button className="btn small ghost" onClick={() => setMenu(!menu)}>More ▾</button>
              {menu && (
                <div className="menu card" onMouseLeave={() => setMenu(false)}>
                  <button onClick={() => { addMissing(); setMenu(false); }}>Add missing layout sections</button>
                  <button
                    onClick={() => {
                      if (confirm("Make this character's sections the starting layout for new characters in this story?"))
                        upd((s) => void (s.characterTemplate = c.sections.map(cloneSectionShape)));
                      setMenu(false);
                    }}
                  >
                    Use this layout for new characters
                  </button>
                  {universe && !isShared && (
                    <button
                      onClick={() => {
                        if (confirm(`Move ${c.name || 'this character'} into “${universe.title}” so other stories in the universe can use them too?`))
                          update((d) => shareCharacter(d, story.id, c.id));
                        setMenu(false);
                      }}
                    >
                      🌌 Share with {universe.title || 'universe'}
                    </button>
                  )}
                  {isShared && (
                    <button
                      onClick={() => {
                        if (!confirm(`Remove ${c.name || 'this character'} from this story? They stay in the universe and in other stories.`)) return;
                        upd((s) => {
                          s.characters.splice(idx, 1);
                          s.relationships = s.relationships.filter((r) => r.from !== c.id && r.to !== c.id);
                        });
                        nav(base + '/characters');
                      }}
                    >
                      Remove from this story
                    </button>
                  )}
                  {story.kind === 'universe' && (
                    <button
                      className="danger"
                      onClick={() => {
                        const n = usedIn.length;
                        if (!confirm(`Delete ${c.name || 'this character'} everywhere?${n ? ` They'll disappear from ${n} ${n === 1 ? 'story' : 'stories'}.` : ''}`)) return;
                        update((d) => deleteUniverseCharacter(d, story.id, c.id));
                        nav(base + '/characters');
                      }}
                    >
                      Delete character everywhere
                    </button>
                  )}
                  {!isShared && story.kind !== 'universe' && <button
                    className="danger"
                    onClick={() => {
                      if (!confirm(`Delete ${c.name || 'this character'}? Their relationships will be deleted too.`)) return;
                      upd((s) => {
                        s.characters.splice(idx, 1);
                        s.relationships = s.relationships.filter((r) => r.from !== c.id && r.to !== c.id);
                      });
                      nav(base + '/characters');
                    }}
                  >
                    Delete character
                  </button>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <SectionList accent={c.color} sections={c.sections} edit={(fn) => edit((ch) => fn(ch.sections))} />

      <section className="card" style={{ marginTop: 16 }}>
        <div className="row between">
          <h2 className="sec-title">Relationships</h2>
          <Link className="btn small" to={`${base}/relationships?focus=${c.id}`}>Open in relationships →</Link>
        </div>
        {relsOut.length + relsIn.length === 0 ? (
          <p className="muted small">None yet.</p>
        ) : (
          <div className="rel-mini">
            {story.characters
              .filter((o) => o.id !== c.id && (relsOut.some((r) => r.to === o.id) || relsIn.some((r) => r.from === o.id)))
              .map((o) => {
                const out = relsOut.find((r) => r.to === o.id);
                const inn = relsIn.find((r) => r.from === o.id);
                const to = out && typeOf(out.typeId);
                const ti = inn && typeOf(inn.typeId);
                return (
                  <div key={o.id} className="rel-mini-row">
                    <Avatar c={nameOf(o.id)!} size={28} />
                    <b>{o.name || 'Unnamed'}</b>
                    <span className="small rel-mini-dirs">
                      <span>
                        <span className="muted">sees them as </span>
                        {to ? <span className="badge" style={{ background: to.color }}>{to.emoji} {to.label}</span> : <span className="muted">—</span>}
                      </span>
                      <span>
                        <span className="muted">they see {c.name || 'them'} as </span>
                        {ti ? <span className="badge" style={{ background: ti.color }}>{ti.emoji} {ti.label}</span> : <span className="muted">—</span>}
                      </span>
                    </span>
                  </div>
                );
              })}
          </div>
        )}
      </section>
      {zoom && c.image && <Lightbox src={c.image} caption={c.name} onClose={() => setZoom(false)} />}
    </div>
  );
}
