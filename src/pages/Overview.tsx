import { Link } from 'react-router-dom';
import { useStoryCtx } from '../storyContext';
import { Avatar, Field, ImagePick, TagInput } from '../components/ui';
import { Links } from '../components/Links';

export default function Overview() {
  const { story, upd } = useStoryCtx();
  const pointCount = story.arcs.reduce((n, a) => n + a.points.length, 0);
  const written = story.arcs.reduce((n, a) => n + a.points.filter((p) => p.status === 'written').length, 0);
  const base = `/story/${story.id}`;

  return (
    <div className="overview">
      <div className="hero card">
        <div className="hero-cover" style={story.cover ? { backgroundImage: `url(${story.cover})` } : undefined}>
          {!story.cover && <span className="muted">No cover yet</span>}
          <div className="hero-cover-actions">
            <ImagePick className="btn small" onPick={([src]) => upd((s) => void (s.cover = src))}>
              {story.cover ? 'Change cover' : 'Add cover'}
            </ImagePick>
            {story.cover && (
              <button className="btn small ghost" onClick={() => upd((s) => void (s.cover = undefined))}>Remove</button>
            )}
          </div>
        </div>
        <div className="hero-text">
          <Field className="h-title" value={story.title} placeholder="Story title" onChange={(v) => upd((s) => void (s.title = v))} />
          <Field className="h-tagline" value={story.tagline} placeholder="A one-line hook…" onChange={(v) => upd((s) => void (s.tagline = v))} />
          <TagInput tags={story.genres} onChange={(g) => upd((s) => void (s.genres = g))} placeholder="+ genre / tag" />
          <div className="stat-row">
            <Link to={base + '/characters'} className="stat"><b>{story.characters.length}</b> characters</Link>
            <Link to={base + '/relationships'} className="stat"><b>{story.relationships.length}</b> relationships</Link>
            <Link to={base + '/plot'} className="stat"><b>{written}/{pointCount}</b> plot points written</Link>
            <Link to={base + '/songs'} className="stat"><b>{story.songs.length}</b> songs</Link>
          </div>
        </div>
      </div>

      <section className="card">
        <h2 className="sec-title">Boards & links</h2>
        <Links links={story.links} onChange={(l) => upd((s) => void (s.links = l))} />
      </section>

      <section className="card">
        <h2 className="sec-title">Synopsis</h2>
        <Field multiline className="prose" value={story.synopsis} placeholder="What is this story about? Write as much or as little as you like…" onChange={(v) => upd((s) => void (s.synopsis = v))} />
      </section>

      {story.characters.length > 0 && (
        <section className="card">
          <h2 className="sec-title">Cast</h2>
          <div className="cast-row">
            {story.characters.map((c) => (
              <Link key={c.id} to={`${base}/characters/${c.id}`} className="cast">
                <Avatar c={c} size={64} />
                <span>{c.name || 'Unnamed'}</span>
                {c.role && <span className="muted small">{c.role}</span>}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
