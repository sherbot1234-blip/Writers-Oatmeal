import { useState } from 'react';
import { parseMedia, uid } from '../util';
import type { Song } from '../types';

/** Spotify / YouTube player for any supported link. */
export function Player({ url, tall }: { url: string; tall?: boolean }) {
  const m = parseMedia(url);
  if (!m) return null;
  if (m.service === 'youtube')
    return (
      <iframe className="spotify yt" src={m.embed} loading="lazy" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen title="YouTube player" />
    );
  return (
    <iframe
      className="spotify"
      src={m.embed}
      height={tall || !m.compact ? 380 : 80}
      loading="lazy"
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      title="Spotify player"
    />
  );
}

export const newSong = (patch: Partial<Song> = {}): Song => ({
  id: uid(),
  title: '',
  artist: '',
  url: '',
  note: '',
  characterIds: [],
  chapterIds: [],
  pointIds: [],
  ...patch,
});

/** A compact list of songs with play buttons, used on character pages and while writing. */
export function MiniSongs({ songs, onUnlink, unlinkLabel = 'Remove' }: { songs: Song[]; onUnlink?: (id: string) => void; unlinkLabel?: string }) {
  const [playing, setPlaying] = useState<string | null>(null);
  return (
    <div className="mini-songs">
      {songs.map((s) => {
        const playable = !!parseMedia(s.url);
        return (
          <div key={s.id} className="mini-song">
            <div className="mini-song-row">
              {playable ? (
                <button className="play-btn" onClick={() => setPlaying(playing === s.id ? null : s.id)} aria-label={playing === s.id ? 'Hide player' : 'Play'}>
                  {playing === s.id ? '■' : '▶'}
                </button>
              ) : (
                <span className="play-btn off">♪</span>
              )}
              <span className="mini-song-text">
                <b>{s.title || 'Untitled song'}</b>
                {s.artist && <span className="muted small"> · {s.artist}</span>}
                {s.note && <span className="muted small mini-song-note">{s.note}</span>}
              </span>
              {onUnlink && (
                <button className="icon-btn tiny" title={unlinkLabel} onClick={() => onUnlink(s.id)}>×</button>
              )}
            </div>
            {playing === s.id && <Player url={s.url} />}
          </div>
        );
      })}
    </div>
  );
}

/** Pick an existing song or paste a new link. */
export function AddSong({ songs, onPick, onCreate, label = '+ Add a song' }: { songs: Song[]; onPick: (id: string) => void; onCreate: (s: Song) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  if (!open) return <button className="btn small dashed" onClick={() => setOpen(true)}>{label}</button>;
  return (
    <div className="add-song">
      {songs.length > 0 && (
        <select className="input slim" value="" onChange={(e) => { if (e.target.value) { onPick(e.target.value); setOpen(false); } }}>
          <option value="">Choose from this story's songs…</option>
          {songs.map((s) => (
            <option key={s.id} value={s.id}>{s.title || 'Untitled'}{s.artist ? ` · ${s.artist}` : ''}</option>
          ))}
        </select>
      )}
      <span className="muted small">{songs.length > 0 ? 'or add a new one:' : 'Add a new song:'}</span>
      <input className="input slim" placeholder="Spotify or YouTube link" value={url} onChange={(e) => setUrl(e.target.value)} />
      <div className="row gap">
        <input className="input slim" style={{ flex: 1, minWidth: 0 }} placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className="input slim" style={{ flex: 1, minWidth: 0 }} placeholder="Artist" value={artist} onChange={(e) => setArtist(e.target.value)} />
      </div>
      <div className="row gap end">
        <button className="btn small ghost" onClick={() => setOpen(false)}>Cancel</button>
        <button
          className="btn small primary"
          disabled={!url.trim() && !title.trim()}
          onClick={() => {
            onCreate(newSong({ url: url.trim(), title: title.trim(), artist: artist.trim() }));
            setUrl('');
            setTitle('');
            setArtist('');
            setOpen(false);
          }}
        >
          Add
        </button>
      </div>
    </div>
  );
}
