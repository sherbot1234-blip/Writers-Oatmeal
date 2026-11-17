import { useState } from 'react';
import { useStoryCtx } from '../storyContext';
import { Avatar, CharacterChips, Empty, Field } from '../components/ui';
import { move, parseSpotify, uid } from '../util';

function SpotifyEmbed({ url, tall }: { url: string; tall?: boolean }) {
  const ref = parseSpotify(url);
  if (!ref) return null;
  const big = tall || ref.type !== 'track' && ref.type !== 'episode';
  return (
    <iframe
      className="spotify"
      src={ref.embed}
      height={big ? 380 : 80}
      loading="lazy"
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      title="Spotify player"
    />
  );
}

export default function Songs() {
  const { story, upd } = useStoryCtx();
  const [editing, setEditing] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [playlistDraft, setPlaylistDraft] = useState('');

  const addSong = () => {
    const id = uid();
    upd((s) => void s.songs.push({ id, title: '', artist: '', url: '', note: '', characterIds: [] }));
    setEditing(id);
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>Soundtrack</h1>
        <button className="btn primary" onClick={addSong}>+ Add song</button>
      </div>

      <section className="card">
        <h2 className="sec-title">Story playlist</h2>
        {story.playlistUrl && parseSpotify(story.playlistUrl) ? (
          <>
            <SpotifyEmbed url={story.playlistUrl} tall />
            <button className="btn small ghost" onClick={() => upd((s) => void (s.playlistUrl = ''))}>Remove playlist</button>
          </>
        ) : (
          <>
            <p className="muted small">Paste a Spotify playlist or album link to embed it here. (In Spotify: ••• → Share → Copy link.)</p>
            <div className="row gap">
              <input className="input" placeholder="https://open.spotify.com/playlist/…" value={playlistDraft} onChange={(e) => setPlaylistDraft(e.target.value)} />
              <button
                className="btn"
                onClick={() => {
                  if (!parseSpotify(playlistDraft)) return alert("That doesn't look like a Spotify link.");
                  upd((s) => void (s.playlistUrl = playlistDraft.trim()));
                  setPlaylistDraft('');
                }}
              >
                Embed
              </button>
            </div>
          </>
        )}
      </section>

      {story.songs.length === 0 ? (
        <Empty icon="🎵" title="No songs yet">
          <p className="muted">Add songs that fit a scene, a character, or the whole mood.</p>
        </Empty>
      ) : (
        <ol className="song-list">
          {story.songs.map((song, i) => {
            const chars = story.characters.filter((c) => song.characterIds.includes(c.id));
            const sp = parseSpotify(song.url);
            const isEditing = editing === song.id;
            return (
              <li key={song.id} className="card song">
                <div className="song-main">
                  <span className="song-num">{i + 1}</span>
                  <div className="song-info">
                    {isEditing ? (
                      <div className="song-edit">
                        <input className="input" autoFocus placeholder="Song title" value={song.title} onChange={(e) => upd((s) => void (s.songs[i].title = e.target.value))} />
                        <input className="input" placeholder="Artist" value={song.artist} onChange={(e) => upd((s) => void (s.songs[i].artist = e.target.value))} />
                        <input className="input" placeholder="Spotify (or any) link" value={song.url} onChange={(e) => upd((s) => void (s.songs[i].url = e.target.value))} />
                        <label className="lbl">Who is this song about?</label>
                        <CharacterChips characters={story.characters} selected={song.characterIds} onChange={(ids) => upd((s) => void (s.songs[i].characterIds = ids))} />
                      </div>
                    ) : (
                      <>
                        <div className="song-title">{song.title || <span className="muted">Untitled song</span>}</div>
                        <div className="muted small">{song.artist}</div>
                      </>
                    )}
                    <Field multiline className="small" value={song.note} placeholder="Which scene or feeling is this for?" onChange={(v) => upd((s) => void (s.songs[i].note = v))} />
                    {!isEditing && chars.length > 0 && (
                      <div className="chip-row">
                        {chars.map((c) => (
                          <span className="chip on" key={c.id} style={{ borderColor: c.color }}>
                            <Avatar c={c} size={18} /> {c.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="song-actions">
                    {sp && (
                      <button className="btn small" onClick={() => setPlaying(playing === song.id ? null : song.id)}>
                        {playing === song.id ? 'Hide' : '▶ Play'}
                      </button>
                    )}
                    {!sp && song.url && (
                      <a className="btn small" href={song.url} target="_blank" rel="noreferrer">Open ↗</a>
                    )}
                    <button className="btn small ghost" onClick={() => setEditing(isEditing ? null : song.id)}>{isEditing ? 'Done' : 'Edit'}</button>
                    <div className="row">
                      <button className="icon-btn" title="Move up" onClick={() => upd((s) => move(s.songs, i, i - 1))}>↑</button>
                      <button className="icon-btn" title="Move down" onClick={() => upd((s) => move(s.songs, i, i + 1))}>↓</button>
                      <button className="icon-btn danger" title="Delete" onClick={() => confirm('Delete this song?') && upd((s) => void s.songs.splice(i, 1))}>🗑</button>
                    </div>
                  </div>
                </div>
                {playing === song.id && sp && <SpotifyEmbed url={song.url} />}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
