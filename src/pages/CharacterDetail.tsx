import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { pathFor, useStoryCtx } from '../storyContext';
import { useLibrary } from '../store';
import { trashCharacter } from '../trash';
import { shareCharacter, storiesUsing } from '../universe';
import { Avatar, ColorPick, DropZone, Field, ImagePick, Lightbox } from '../components/ui';
import { AdjustButton, FramedImg } from '../components/Framed';
import { SectionList } from '../components/Sections';
import { Links } from '../components/Links';
import { AddSong, MiniSongs } from '../components/Music';
import { cloneSectionShape } from '../defaults';
import { partnersOf, relFor, stateAt, typesOf } from '../relations';
import { uid } from '../util';
import type { CharArc } from '../types';

export default function CharacterDetail() {
  const { story, upd, base, universe } = useStoryCtx();
  const { lib, update } = useLibrary();
  const { charId } = useParams();
  const nav = useNavigate();
  const [menu, setMenu] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [eraId, setEraId] = useState<string | null>(null);
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
  const partners = partnersOf(story, c.id);
  const last = story.moments.length - 1;
  const latest = (r: (typeof story.relationships)[number] | undefined) => typesOf(story, stateAt(r, story.moments, last)?.state);
  const nameOf = (id: string) => story.characters.find((x) => x.id === id);
  const isShared = story.sharedCharacterIds.includes(c.id);
  const usedIn = story.kind === 'universe' ? storiesUsing(lib, c.id) : isShared ? storiesUsing(lib, c.id) : [];

  const eras = c.eras ?? [];
  const era = eras.find((e) => e.id === eraId);
  const shownImage = era?.image ?? c.image;
  const arc: CharArc = story.characterArcs[c.id] ?? { start: '', change: '', end: '' };
  const setArc = (k: keyof CharArc, v: string) => upd((s) => void (s.characterArcs[c.id] = { ...(s.characterArcs[c.id] ?? { start: '', change: '', end: '' }), [k]: v }));
  const themeSongs = story.songs.filter((s) => s.characterIds.includes(c.id));
  const appearances = story.arcs.flatMap((a) => a.points.filter((p) => p.characterIds.includes(c.id)).map((p) => ({ arc: a, p })));

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
        <DropZone
          className="char-portrait"
          style={{ borderColor: c.color }}
          label={era ? `Drop a picture for “${era.name || 'this look'}”` : 'Drop a picture'}
          onPick={([src]) =>
            edit((ch) => {
              // dropping while a look is selected sets that look's picture
              const e = era && ch.eras?.find((x) => x.id === era.id);
              if (e) {
                e.image = src;
                e.frame = undefined;
              } else {
                ch.image = src;
                ch.imageFrame = undefined;
              }
            })
          }
        >
          {shownImage ? (
            <FramedImg src={shownImage} frame={era ? era.frame : c.imageFrame} className="fill zoomable" onClick={() => setZoom(true)} />
          ) : (
            <Avatar c={c} size={140} />
          )}
          {!era && (
            <div className="char-portrait-actions">
              <ImagePick className="btn small" maxDim={1000} onPick={([src]) => edit((ch) => { ch.image = src; ch.imageFrame = undefined; })}>
                {c.image ? 'Change' : 'Add picture'}
              </ImagePick>
              {c.image && <AdjustButton src={c.image} frame={c.imageFrame} aspect={1} round onSave={(f) => edit((ch) => void (ch.imageFrame = f))} />}
              {c.image && <button className="btn small ghost" onClick={() => edit((ch) => { ch.image = undefined; ch.imageFrame = undefined; })}>Remove</button>}
            </div>
          )}
        </DropZone>
        <div className="char-hero-text">
          <Field className="h-title" value={c.name} placeholder="Character name" onChange={(v) => edit((ch) => void (ch.name = v))} />
          <Field className="h-tagline" value={c.role} placeholder="Role — protagonist, the mentor, comic relief…" onChange={(v) => edit((ch) => void (ch.role = v))} />
          {eras.length > 0 && (
            <div className="era-switch" role="tablist" aria-label="Looks and eras">
              <button className={!era ? 'on' : ''} onClick={() => setEraId(null)}>Main</button>
              {eras.map((e) => (
                <button key={e.id} className={era?.id === e.id ? 'on' : ''} onClick={() => setEraId(e.id)}>{e.name || 'Untitled look'}</button>
              ))}
            </div>
          )}
          {era?.description && <p className="era-desc small">{era.description}</p>}
          {story.charCategories.length > 0 && (
            <div className="chip-row cat-chips">
              {story.charCategories.map((k) => {
                const on = (story.charCategoryMap[c.id] ?? []).includes(k.id);
                return (
                  <button
                    key={k.id}
                    className={'chip' + (on ? ' on' : '')}
                    style={on ? { borderColor: k.color, background: k.color + '33' } : undefined}
                    onClick={() =>
                      upd((s) => {
                        const cur = s.charCategoryMap[c.id] ?? [];
                        s.charCategoryMap[c.id] = on ? cur.filter((x) => x !== k.id) : [...cur, k.id];
                      })
                    }
                    title={on ? `Remove from ${k.name}` : `Add to ${k.name}`}
                  >
                    {k.icon} {k.name}
                  </button>
                );
              })}
            </div>
          )}
          <div className="row gap wrap">
            {(story.milanoteUrl || universe?.milanoteUrl) && (
              <a className="link-chip milanote-chip" href={story.milanoteUrl || universe!.milanoteUrl} target="_blank" rel="noreferrer">
                <span>📌 Story board</span>
              </a>
            )}
            <Links links={c.links ?? []} onChange={(l) => edit((ch) => void (ch.links = l))} />
          </div>
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
                        update((d) => trashCharacter(d, story.id, c.id));
                        nav(base + '/characters');
                      }}
                    >
                      Delete character everywhere
                    </button>
                  )}
                  {!isShared && story.kind !== 'universe' && <button
                    className="danger"
                    onClick={() => {
                      if (!confirm(`Delete ${c.name || 'this character'}? They (and their relationships) go to the bin for 30 days.`)) return;
                      update((d) => trashCharacter(d, story.id, c.id));
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

      <section className="card eras-block">
        <div className="row between wrap gap">
          <h2 className="sec-title">Looks & eras</h2>
          <button
            className="btn small"
            onClick={() => {
              const id = uid();
              edit((ch) => void (ch.eras ??= []).push({ id, name: '', description: '' }));
              setEraId(id);
            }}
          >
            + Add a look / era
          </button>
        </div>
        {eras.length === 0 ? (
          <p className="muted small">Different versions of {c.name || 'this character'}: younger, after the time-skip, in disguise, a signature outfit… Each gets its own picture.</p>
        ) : (
          <div className="era-grid">
            {eras.map((e, i) => (
              <div key={e.id} className={'era-card' + (era?.id === e.id ? ' on' : '')} onClick={() => setEraId(e.id)} style={{ ['--cc' as any]: c.color }}>
                <DropZone className="era-img" onPick={([src]) => edit((ch) => { ch.eras![i].image = src; ch.eras![i].frame = undefined; })}>
                  {e.image ? <FramedImg src={e.image} frame={e.frame} className="fill" /> : <span className="muted small">No picture<br />drag one here</span>}
                  <span className="era-pick row gap">
                    {e.image && <AdjustButton src={e.image} frame={e.frame} aspect={3 / 4} onSave={(f) => edit((ch) => void (ch.eras![i].frame = f))} label="✥" className="btn small" />}
                    <ImagePick className="btn small" maxDim={1000} onPick={([src]) => edit((ch) => { ch.eras![i].image = src; ch.eras![i].frame = undefined; })}>{e.image ? '↻' : '+ Picture'}</ImagePick>
                  </span>
                </DropZone>
                <Field multiline className="era-name" value={e.name} placeholder="e.g. Age 12 · After the war" onChange={(v) => edit((ch) => void (ch.eras![i].name = v))} />
                <Field multiline className="small" value={e.description} placeholder="What's different about them now?" onChange={(v) => edit((ch) => void (ch.eras![i].description = v))} />
                <div className="row end">
                  <button className="icon-btn tiny" title="Earlier" onClick={(ev) => { ev.stopPropagation(); edit((ch) => { const a = ch.eras!; if (i > 0) [a[i - 1], a[i]] = [a[i], a[i - 1]]; }); }}>←</button>
                  <button
                    className="icon-btn tiny danger"
                    title="Delete look"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      if (!confirm(`Delete the look “${e.name || 'untitled'}”?`)) return;
                      if (era?.id === e.id) setEraId(null);
                      edit((ch) => void ch.eras!.splice(i, 1));
                    }}
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <SectionList accent={c.color} sections={c.sections} edit={(fn) => edit((ch) => fn(ch.sections))} />

      <section className="card" style={{ marginTop: 16 }}>
        <h2 className="sec-title">🎵 Theme songs</h2>
        {themeSongs.length > 0 ? (
          <MiniSongs
            songs={themeSongs}
            unlinkLabel="Not their theme"
            onUnlink={(id) => upd((s) => { const x = s.songs.find((y) => y.id === id); if (x) x.characterIds = x.characterIds.filter((y) => y !== c.id); })}
          />
        ) : (
          <p className="muted small">Songs that sound like {c.name || 'this character'}. They also appear on the Songs page.</p>
        )}
        <AddSong
          songs={story.songs.filter((s) => !s.characterIds.includes(c.id))}
          onPick={(id) => upd((s) => void s.songs.find((x) => x.id === id)!.characterIds.push(c.id))}
          onCreate={(song) => upd((s) => void s.songs.push({ ...song, characterIds: [c.id] }))}
          label="+ Add a theme song"
        />
      </section>

      {story.kind === 'story' && (
        <section className="card char-arc" style={{ marginTop: 16, ['--cc' as any]: c.color }}>
          <h2 className="sec-title">Arc in this story</h2>
          <div className="arc-steps">
            <div className="arc-step">
              <span className="arc-step-label">Starts as</span>
              <Field multiline value={arc.start} placeholder="Who are they at the beginning? What do they believe?" onChange={(v) => setArc('start', v)} />
            </div>
            <span className="arc-arrow" aria-hidden>→</span>
            <div className="arc-step">
              <span className="arc-step-label">Turning point</span>
              <Field multiline value={arc.change} placeholder="What forces them to change?" onChange={(v) => setArc('change', v)} />
            </div>
            <span className="arc-arrow" aria-hidden>→</span>
            <div className="arc-step">
              <span className="arc-step-label">Ends as</span>
              <Field multiline value={arc.end} placeholder="Who are they by the end?" onChange={(v) => setArc('end', v)} />
            </div>
          </div>
          <h3 className="arc-sub small">Plot points with {c.name || 'this character'}</h3>
          {appearances.length === 0 ? (
            <p className="muted small">None yet. On the <Link to={base + '/plot'}>Plot</Link> page, tag {c.name || 'them'} in a plot point and it shows up here.</p>
          ) : (
            <ol className="appearances">
              {appearances.map(({ arc: a, p }) => (
                <li key={p.id} style={{ borderLeftColor: a.color }}>
                  <span className="muted small">{a.title}{p.chapter ? ` · ${p.chapter}` : ''}</span>
                  <b>{p.title || 'Untitled'}</b>
                  <span title={p.status}>{p.status === 'written' ? '✅' : p.status === 'planned' ? '📝' : '💭'}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      <section className="card" style={{ marginTop: 16 }}>
        <div className="row between">
          <h2 className="sec-title">Relationships {story.moments.length > 1 && <span className="muted small">(by “{story.moments[last].label}”)</span>}</h2>
          <Link className="btn small" to={`${base}/relationships?focus=${c.id}`}>Open in relationships →</Link>
        </div>
        {partners.length === 0 ? (
          <p className="muted small">None yet.</p>
        ) : (
          <div className="rel-mini">
            {story.characters
              .filter((o) => partners.includes(o.id))
              .map((o) => {
                const out = relFor(story, c.id, o.id);
                const inn = relFor(story, o.id, c.id);
                const to = latest(out);
                const ti = latest(inn);
                const badges = (ts: typeof to) =>
                  ts.length ? ts.map((t) => <span key={t.id} className="badge" style={{ background: t.color }}>{t.emoji} {t.label}</span>) : <span className="muted">—</span>;
                return (
                  <div key={o.id} className="rel-mini-row">
                    <Avatar c={nameOf(o.id)!} size={28} />
                    <b>{o.name || 'Unnamed'}</b>
                    <span className="small rel-mini-dirs">
                      {out?.mutual ? (
                        <span>
                          <span className="muted">⇄ </span>
                          {badges(to)}
                        </span>
                      ) : (
                        <>
                          <span>
                            <span className="muted">sees them as </span>
                            {badges(to)}
                          </span>
                          <span>
                            <span className="muted">they see {c.name || 'them'} as </span>
                            {badges(ti)}
                          </span>
                        </>
                      )}
                    </span>
                  </div>
                );
              })}
          </div>
        )}
      </section>
      {zoom && shownImage && <Lightbox src={shownImage} caption={era ? `${c.name} · ${era.name}` : c.name} onClose={() => setZoom(false)} />}
    </div>
  );
}
