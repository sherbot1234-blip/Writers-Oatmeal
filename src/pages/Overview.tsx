import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { pathFor, useStoryCtx } from '../storyContext';
import { Avatar, Field, ImagePick, TagInput } from '../components/ui';
import { Links } from '../components/Links';
import { useLibrary } from '../store';
import { makeStory, makeUniverse, STATUSES, statusInfo } from '../defaults';
import { move } from '../util';
import { setStoryUniverse, storiesIn } from '../universe';
import type { Story, StoryStatus } from '../types';
import { groupCharacters } from '../categories';

export function StatusPicker({ value, onChange }: { value: StoryStatus; onChange: (s: StoryStatus) => void }) {
  const info = statusInfo(value);
  return (
    <label className="status-pick" style={{ ['--sc' as any]: info.color }}>
      <span aria-hidden>{info.icon}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as StoryStatus)} aria-label="Story status">
        {STATUSES.map((s) => (
          <option key={s.key} value={s.key}>{s.label}</option>
        ))}
      </select>
    </label>
  );
}

function UniversePicker({ story }: { story: Story }) {
  const { lib, update } = useLibrary();
  return (
    <label className="universe-pick">
      <span aria-hidden>🌌</span>
      <select
        value={story.universeId ?? ''}
        aria-label="Universe"
        onChange={(e) => {
          let target = e.target.value || undefined;
          if (target === '__new') {
            const name = prompt('Name of the new universe / series', story.title ? `${story.title} universe` : 'New universe');
            if (!name?.trim()) return;
            const u = makeUniverse(name.trim(), story.theme);
            update((d) => void d.universes.push(u));
            target = u.id;
          }
          if (story.universeId && story.sharedCharacterIds.length && !confirm('This story uses shared characters from its current universe. They will become copies that belong only to this story. Continue?')) return;
          update((d) => setStoryUniverse(d, story.id, target));
        }}
      >
        <option value="">No universe (standalone)</option>
        {lib.universes.map((u) => (
          <option key={u.id} value={u.id}>{u.title || 'Untitled universe'}</option>
        ))}
        <option value="__new">+ New universe…</option>
      </select>
    </label>
  );
}

/** The story's main Milanote board: paste it once, then it's a button everywhere. */
function MilanoteField({ story }: { story: Story }) {
  const { upd } = useStoryCtx();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(story.milanoteUrl);
  const save = () => {
    const v = draft.trim();
    upd((s) => void (s.milanoteUrl = v && !/^[a-z]+:\/\//i.test(v) ? 'https://' + v : v));
    setEditing(false);
  };
  if (story.milanoteUrl && !editing)
    return (
      <div className="milanote-row">
        <a className="btn milanote-btn" href={story.milanoteUrl} target="_blank" rel="noreferrer">📌 Open Milanote board</a>
        <button className="btn small ghost" onClick={() => { setDraft(story.milanoteUrl); setEditing(true); }}>Change</button>
      </div>
    );
  return (
    <div className="milanote-row">
      <span aria-hidden>📌</span>
      <input
        className="input slim"
        style={{ flex: 1, minWidth: 0 }}
        placeholder="Paste this story's Milanote board link (Share → Copy link)"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && save()}
      />
      <button className="btn small primary" disabled={!draft.trim() && !story.milanoteUrl} onClick={save}>{draft.trim() ? 'Save' : 'Remove'}</button>
      {editing && <button className="btn small ghost" onClick={() => setEditing(false)}>Cancel</button>}
    </div>
  );
}

export default function Overview() {
  const { story, upd, base } = useStoryCtx();
  if (story.kind === 'universe') return <UniverseOverview />;
  const pointCount = story.arcs.reduce((n, a) => n + a.points.length, 0);
  const written = story.arcs.reduce((n, a) => n + a.points.filter((p) => p.status === 'written').length, 0);

  return (
    <div className="overview">
      <div className="hero card">
        <Cover story={story} upd={upd} />
        <div className="hero-text">
          <Field className="h-title" value={story.title} placeholder="Story title" onChange={(v) => upd((s) => void (s.title = v))} />
          <Field className="h-tagline" value={story.tagline} placeholder="A one-line hook…" onChange={(v) => upd((s) => void (s.tagline = v))} />
          <div className="row gap wrap">
            <StatusPicker value={story.status} onChange={(v) => upd((s) => void (s.status = v))} />
            <UniversePicker story={story} />
          </div>
          <TagInput tags={story.genres} onChange={(g) => upd((s) => void (s.genres = g))} placeholder="+ genre / tag" />
          <MilanoteField story={story} />
          <div className="stat-row">
            <Link to={base + '/characters'} className="stat"><b>{story.characters.length}</b> characters</Link>
            <Link to={base + '/relationships'} className="stat"><b>{story.relationships.length}</b> relationships</Link>
            <Link to={base + '/plot'} className="stat"><b>{written}/{pointCount}</b> plot points written</Link>
            <Link to={base + '/songs'} className="stat"><b>{story.songs.length}</b> songs</Link>
          </div>
        </div>
      </div>

      <section className="card">
        <h2 className="sec-title">Other links</h2>
        <Links links={story.links} onChange={(l) => upd((s) => void (s.links = l))} addLabel="+ Add a link" hint="Pinterest, Google Docs, Spotify, extra Milanote boards…" />
      </section>

      <section className="card">
        <h2 className="sec-title">Synopsis</h2>
        <Field multiline className="prose" value={story.synopsis} placeholder="What is this story about? Write as much or as little as you like…" onChange={(v) => upd((s) => void (s.synopsis = v))} />
      </section>

      {story.characters.length > 0 && <Cast story={story} base={base} />}
    </div>
  );
}

function Cover({ story, upd }: { story: Story; upd: ReturnType<typeof useStoryCtx>['upd'] }) {
  return (
    <div className="hero-cover" style={story.cover ? { backgroundImage: `url(${story.cover})` } : undefined}>
      {!story.cover && <span className="muted">No cover yet</span>}
      <div className="hero-cover-actions">
        <ImagePick className="btn small" onPick={([src]) => upd((s) => void (s.cover = src))}>
          {story.cover ? 'Change cover' : 'Add cover'}
        </ImagePick>
        {story.cover && <button className="btn small ghost" onClick={() => upd((s) => void (s.cover = undefined))}>Remove</button>}
      </div>
    </div>
  );
}

function Cast({ story, base, title = 'Cast' }: { story: Story; base: string; title?: string }) {
  return (
    <section className="card">
      <h2 className="sec-title">{title}</h2>
      {groupCharacters(story, story.characters).map((g, gi) => (
        <div key={g.cat?.id ?? 'none' + gi} className="cast-group">
          {story.charCategories.length > 0 && <h3 className="cast-group-title" style={g.cat ? { color: g.cat.color } : undefined}>{g.cat ? `${g.cat.icon} ${g.cat.name}` : 'Others'}</h3>}
          <div className="cast-row">
            {g.chars.map((c) => (
              <Link key={c.id} to={`${base}/characters/${c.id}`} className="cast">
                <Avatar c={c} size={64} />
                <span>{c.name || 'Unnamed'}</span>
                {c.role && <span className="muted small">{c.role}</span>}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function UniverseOverview() {
  const { story: u, upd, base } = useStoryCtx();
  const { lib, update } = useLibrary();
  const nav = useNavigate();
  const books = storiesIn(lib, u.id);
  const others = lib.stories.filter((s) => s.universeId !== u.id);

  const reorder = (i: number, j: number) =>
    update((d) => {
      const ordered = d.stories.filter((s) => s.universeId === u.id).sort((a, b) => a.seriesOrder - b.seriesOrder);
      move(ordered, i, j);
      ordered.forEach((s, k) => (s.seriesOrder = k + 1));
    });

  return (
    <div className="overview">
      <div className="hero card">
        <Cover story={u} upd={upd} />
        <div className="hero-text">
          <span className="kind-badge" style={{ alignSelf: 'flex-start' }}>🌌 Universe / series</span>
          <Field className="h-title" value={u.title} placeholder="Universe name" onChange={(v) => upd((s) => void (s.title = v))} />
          <Field className="h-tagline" value={u.tagline} placeholder="What ties these stories together?" onChange={(v) => upd((s) => void (s.tagline = v))} />
          <TagInput tags={u.genres} onChange={(g) => upd((s) => void (s.genres = g))} placeholder="+ genre / tag" />
          <MilanoteField story={u} />
          <div className="stat-row">
            <span className="stat"><b>{books.length}</b> {books.length === 1 ? 'story' : 'stories'}</span>
            <Link to={base + '/characters'} className="stat"><b>{u.characters.length}</b> shared characters</Link>
            <Link to={base + '/world'} className="stat"><b>{u.worldImages.length}</b> maps & images</Link>
          </div>
        </div>
      </div>

      <section className="card">
        <div className="row between wrap gap">
          <h2 className="sec-title">Stories in this universe</h2>
          <div className="row gap wrap">
            {others.length > 0 && (
              <select className="input slim" value="" onChange={(e) => e.target.value && update((d) => setStoryUniverse(d, e.target.value, u.id))}>
                <option value="">+ Add an existing story…</option>
                {others.map((s) => (
                  <option key={s.id} value={s.id}>{s.title || 'Untitled'}</option>
                ))}
              </select>
            )}
            <button
              className="btn small primary"
              onClick={() => {
                const s = makeStory('Untitled Story', u.theme);
                update((d) => {
                  d.stories.unshift(s);
                  setStoryUniverse(d, s.id, u.id);
                });
                nav(pathFor(s));
              }}
            >
              + New story here
            </button>
          </div>
        </div>
        {books.length === 0 ? (
          <p className="muted small">No stories yet. Add one, or open a story and pick this universe on its overview page.</p>
        ) : (
          <ol className="series-list">
            {books.map((s, i) => {
              const st = statusInfo(s.status);
              return (
                <li key={s.id} className="series-item" style={{ borderLeftColor: s.theme.accent }}>
                  <span className="series-num">{i + 1}</span>
                  <Link to={pathFor(s)} className="series-title">
                    <b>{s.title || 'Untitled'}</b>
                    {s.tagline && <span className="muted small">{s.tagline}</span>}
                  </Link>
                  <span className="status-dot" style={{ ['--sc' as any]: st.color }}>{st.icon} {st.label}</span>
                  <span className="muted small">{s.sharedCharacterIds.length} shared</span>
                  <span className="row">
                    <button className="icon-btn tiny" disabled={i === 0} onClick={() => reorder(i, i - 1)} title="Earlier in series">↑</button>
                    <button className="icon-btn tiny" disabled={i === books.length - 1} onClick={() => reorder(i, i + 1)} title="Later in series">↓</button>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="card">
        <h2 className="sec-title">Other links</h2>
        <Links links={u.links} onChange={(l) => upd((s) => void (s.links = l))} addLabel="+ Add a link" hint="Pinterest, Google Docs, Spotify, extra Milanote boards…" />
      </section>

      <section className="card">
        <h2 className="sec-title">About this universe</h2>
        <Field multiline className="prose" value={u.synopsis} placeholder="The rules, the history, what all these stories have in common…" onChange={(v) => upd((s) => void (s.synopsis = v))} />
      </section>

      {u.characters.length > 0 && <Cast story={u} base={base} title="Shared cast" />}
    </div>
  );
}
