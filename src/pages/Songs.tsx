import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStoryCtx } from '../storyContext';
import { useChapters } from '../chapters';
import { Avatar, CharacterChips, Empty, Field, Modal } from '../components/ui';
import { MiniSongs, newSong, Player } from '../components/Music';
import { move, parseMedia } from '../util';
import * as sp from '../spotify';
import { trashItem } from '../trash';
import { useLibrary } from '../store';
import type { Chapter, Song, Story } from '../types';

export default function Songs() {
  const { update } = useLibrary();
  const { story, upd, base } = useStoryCtx();
  const { chapters } = useChapters(story.id);
  const [editing, setEditing] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [playlistDraft, setPlaylistDraft] = useState('');
  const [view, setView] = useState<'list' | 'chapters'>('list');
  const [importing, setImporting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // coming back from Spotify's sign-in page: reopen the import window
  useEffect(() => {
    const err = sp.takeLoginError();
    if (err) setLoginError(err);
    if (sessionStorage.getItem('wo-spotify-reopen')) {
      sessionStorage.removeItem('wo-spotify-reopen');
      setImporting(true);
    }
  }, []);

  const addSong = () => {
    const s = newSong();
    upd((st) => void st.songs.push(s));
    setEditing(s.id);
  };
  const points = story.arcs.flatMap((a) => a.points.map((p) => ({ a, p })));

  return (
    <div className="page">
      <div className="page-head">
        <h1>Soundtrack</h1>
        <div className="row gap wrap">
          <div className="seg">
            <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>All songs</button>
            <button className={view === 'chapters' ? 'on' : ''} onClick={() => setView('chapters')}>By chapter</button>
          </div>
          <button className="btn spotify-btn" onClick={() => setImporting(true)}>
            <SpotifyLogo /> Import playlist
          </button>
          <button className="btn primary" onClick={addSong}>+ Add song</button>
        </div>
      </div>
      {loginError && (
        <p className="save-err small">
          {loginError} <button className="btn small ghost" onClick={() => setLoginError(null)}>OK</button>
        </p>
      )}

      <section className="card">
        <h2 className="sec-title">Story playlist</h2>
        {story.playlistUrl && parseMedia(story.playlistUrl) ? (
          <>
            <Player url={story.playlistUrl} tall />
            <button className="btn small ghost" onClick={() => upd((s) => void (s.playlistUrl = ''))}>Remove playlist</button>
          </>
        ) : (
          <>
            <p className="muted small">Paste a Spotify playlist/album link (••• → Share → Copy link) or a YouTube playlist link to play it here, or use <b>Import playlist</b>.</p>
            <div className="row gap">
              <input className="input" placeholder="Spotify or YouTube playlist link" value={playlistDraft} onChange={(e) => setPlaylistDraft(e.target.value)} />
              <button
                className="btn"
                onClick={() => {
                  if (!parseMedia(playlistDraft)) return alert("That doesn't look like a Spotify or YouTube link.");
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

      {view === 'chapters' ? (
        <ByChapter story={story} chapters={chapters} base={base} />
      ) : story.songs.length === 0 ? (
        <Empty icon="🎵" title="No songs yet">
          <p className="muted">Add songs that fit a scene, a character, or the whole mood, or import a whole Spotify playlist.</p>
        </Empty>
      ) : (
        <ol className="song-list">
          {story.songs.map((song, i) => {
            const chars = story.characters.filter((c) => song.characterIds.includes(c.id));
            const chs = chapters.filter((c) => song.chapterIds.includes(c.id));
            const pts = points.filter(({ p }) => song.pointIds.includes(p.id));
            const playable = !!parseMedia(song.url);
            const isEditing = editing === song.id;
            const set = (fn: (s: Song) => void) => upd((st) => fn(st.songs[i] as Song));
            return (
              <li key={song.id} className="card song">
                <div className="song-main">
                  <span className="song-num">{i + 1}</span>
                  <div className="song-info">
                    {isEditing ? (
                      <div className="song-edit">
                        <input className="input" autoFocus placeholder="Song title" value={song.title} onChange={(e) => set((s) => void (s.title = e.target.value))} />
                        <input className="input" placeholder="Artist" value={song.artist} onChange={(e) => set((s) => void (s.artist = e.target.value))} />
                        <input className="input" placeholder="Spotify or YouTube link" value={song.url} onChange={(e) => set((s) => void (s.url = e.target.value))} />
                        <label className="lbl">Theme song for…</label>
                        <CharacterChips characters={story.characters} selected={song.characterIds} onChange={(ids) => set((s) => void (s.characterIds = ids))} />
                        {chapters.length > 0 && (
                          <>
                            <label className="lbl">Plays during chapters</label>
                            <div className="chip-row">
                              {chapters.map((c, ci) => {
                                const on = song.chapterIds.includes(c.id);
                                return (
                                  <button key={c.id} className={'chip' + (on ? ' on' : '')} onClick={() => set((s) => void (s.chapterIds = on ? s.chapterIds.filter((x) => x !== c.id) : [...s.chapterIds, c.id]))}>
                                    Ch. {ci + 1}{c.title ? `: ${c.title}` : ''}
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        )}
                        {points.length > 0 && (
                          <>
                            <label className="lbl">Scenes / plot points</label>
                            <div className="chip-row">
                              {pts.map(({ a, p }) => (
                                <span key={p.id} className="chip on" style={{ borderColor: a.color }}>
                                  {p.title || 'Untitled'}
                                  <button className="icon-btn tiny" aria-label="Unlink" onClick={() => set((s) => void (s.pointIds = s.pointIds.filter((x) => x !== p.id)))}>×</button>
                                </span>
                              ))}
                              <select className="input slim" value="" onChange={(e) => e.target.value && set((s) => void s.pointIds.push(e.target.value))}>
                                <option value="">+ scene</option>
                                {story.arcs.map((a) => (
                                  <optgroup key={a.id} label={a.title}>
                                    {a.points.filter((p) => !song.pointIds.includes(p.id)).map((p) => (
                                      <option key={p.id} value={p.id}>{p.title || 'Untitled'}</option>
                                    ))}
                                  </optgroup>
                                ))}
                              </select>
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="song-title">{song.title || <span className="muted">Untitled song</span>}</div>
                        <div className="muted small">{song.artist}</div>
                      </>
                    )}
                    <Field multiline className="small" value={song.note} placeholder="Which scene or feeling is this for?" onChange={(v) => set((s) => void (s.note = v))} />
                    {!isEditing && (chars.length > 0 || chs.length > 0 || pts.length > 0) && (
                      <div className="chip-row">
                        {chars.map((c) => (
                          <span className="chip on" key={c.id} style={{ borderColor: c.color }}>
                            <Avatar c={c} size={18} /> {c.name}
                          </span>
                        ))}
                        {chs.map((c) => (
                          <Link key={c.id} className="chip" to={`${base}/chapters/${c.id}`}>✍️ Ch. {chapters.indexOf(c) + 1}</Link>
                        ))}
                        {pts.map(({ a, p }) => (
                          <span key={p.id} className="chip" style={{ borderColor: a.color }}>🧵 {p.title || 'Untitled'}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="song-actions">
                    {playable && (
                      <button className="btn small" onClick={() => setPlaying(playing === song.id ? null : song.id)}>{playing === song.id ? 'Hide' : '▶ Play'}</button>
                    )}
                    {!playable && song.url && (
                      <a className="btn small" href={song.url} target="_blank" rel="noreferrer">Open ↗</a>
                    )}
                    <button className="btn small ghost" onClick={() => setEditing(isEditing ? null : song.id)}>{isEditing ? 'Done' : 'Edit'}</button>
                    <div className="row">
                      <button className="icon-btn" title="Move up" onClick={() => upd((s) => move(s.songs, i, i - 1))}>↑</button>
                      <button className="icon-btn" title="Move down" onClick={() => upd((s) => move(s.songs, i, i + 1))}>↓</button>
                      <button className="icon-btn danger" title="Delete" onClick={() => confirm('Delete this song? It goes to the bin for 30 days.') && update((d) => trashItem(d, story.id, 'songs', song.id))}>🗑</button>
                    </div>
                  </div>
                </div>
                {playing === song.id && playable && <Player url={song.url} />}
              </li>
            );
          })}
        </ol>
      )}

      {importing && <SpotifyImport story={story} onClose={() => setImporting(false)} />}
    </div>
  );
}

function ByChapter({ story, chapters, base }: { story: Story; chapters: Chapter[]; base: string }) {
  const { upd } = useStoryCtx();
  if (!chapters.length)
    return (
      <Empty icon="✍️" title="No chapters yet">
        <p className="muted">Once you have chapters, you can give each one its own soundtrack.</p>
        <Link className="btn" to={base + '/chapters'}>Go to chapters</Link>
      </Empty>
    );
  const pointChapter = new Map(story.arcs.flatMap((a) => a.points.map((p) => [p.id, p.chapterId] as const)));
  const forChapter = (id: string) => story.songs.filter((s) => s.chapterIds.includes(id) || s.pointIds.some((pid) => pointChapter.get(pid) === id));
  const unplaced = story.songs.filter((s) => !s.chapterIds.length && !s.pointIds.some((pid) => pointChapter.get(pid)));
  return (
    <div className="by-chapter">
      {chapters.map((c, i) => {
        const songs = forChapter(c.id);
        return (
          <section key={c.id} className="card">
            <div className="row between wrap gap">
              <h2 className="sec-title"><Link to={`${base}/chapters/${c.id}`}>Ch. {i + 1}{c.title ? `: ${c.title}` : ''}</Link></h2>
              <select
                className="input slim"
                value=""
                onChange={(e) => e.target.value && upd((s) => void s.songs.find((x) => x.id === e.target.value)!.chapterIds.push(c.id))}
              >
                <option value="">+ add a song</option>
                {story.songs.filter((s) => !songs.includes(s)).map((s) => (
                  <option key={s.id} value={s.id}>{s.title || 'Untitled'}{s.artist ? ` · ${s.artist}` : ''}</option>
                ))}
              </select>
            </div>
            {songs.length ? (
              <MiniSongs
                songs={songs}
                unlinkLabel="Remove from this chapter"
                onUnlink={(id) => upd((s) => { const x = s.songs.find((y) => y.id === id)!; x.chapterIds = x.chapterIds.filter((y) => y !== c.id); })}
              />
            ) : (
              <p className="muted small">No songs for this chapter.</p>
            )}
          </section>
        );
      })}
      {unplaced.length > 0 && (
        <section className="card">
          <h2 className="sec-title muted">Not linked to a chapter</h2>
          <MiniSongs songs={unplaced} />
        </section>
      )}
    </div>
  );
}

function SpotifyLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="12" fill="#1DB954" />
      <path d="M6.5 9.3c3.6-1.1 8-.8 11.2 1.1M7.2 12.4c3-.9 6.4-.6 9.1 1M7.9 15.3c2.4-.7 5-.5 7.1.8" stroke="#000" strokeWidth="1.6" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function SpotifyImport({ story, onClose }: { story: Story; onClose: () => void }) {
  const { upd } = useStoryCtx();
  const { saveNow } = useLibrary();
  const [clientId, setClientId] = useState(sp.getClientId());
  const [draftId, setDraftId] = useState('');
  const [connected, setConnected] = useState(sp.isConnected());
  const [lists, setLists] = useState<sp.SpPlaylist[] | null>(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [chosen, setChosen] = useState<sp.SpPlaylist | null>(null);
  const [addSongs, setAddSongs] = useState(true);
  const [asPlayer, setAsPlayer] = useState(!story.playlistUrl);
  const [tagChar, setTagChar] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!connected || lists) return;
    sp.myPlaylists()
      .then(setLists)
      .catch((e) => {
        setError(e.message);
        setConnected(sp.isConnected());
      });
  }, [connected, lists]);

  const runImport = async () => {
    if (!chosen) return;
    setBusy(true);
    setError('');
    try {
      const tracks = addSongs ? await sp.playlistTracks(chosen.id) : [];
      const have = new Set(story.songs.map((s) => s.url));
      const fresh = tracks.filter((t) => !t.url || !have.has(t.url));
      upd((s) => {
        if (asPlayer) s.playlistUrl = chosen.url;
        for (const t of fresh) s.songs.push(newSong({ title: t.title, artist: t.artist, url: t.url, characterIds: tagChar ? [tagChar] : [] }));
      });
      alert(addSongs ? `Added ${fresh.length} song${fresh.length === 1 ? '' : 's'}${tracks.length > fresh.length ? ` (${tracks.length - fresh.length} were already here)` : ''}.` : 'Playlist added.');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const filtered = (lists ?? []).filter((l) => !q || l.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <Modal title={<span className="row gap"><SpotifyLogo /> Import from Spotify</span>} onClose={onClose} wide>
      {!clientId ? (
        <div className="sp-setup">
          <p className="small">
            A one-time setup (about 3 minutes) so this site is allowed to read your playlists. Spotify requires every app to register, even personal ones.
          </p>
          <ol className="small">
            <li>
              Open the <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer">Spotify Developer Dashboard ↗</a>, log in, and click <b>Create app</b>.
            </li>
            <li>Name it anything (e.g. “Writer's Oatmeal”), and add a short description.</li>
            <li>
              Under <b>Redirect URIs</b>, paste this exact address and click <b>Add</b>:
              <div className="row gap copy-row">
                <code>{sp.redirectUri()}</code>
                <button className="btn small" onClick={() => { navigator.clipboard?.writeText(sp.redirectUri()); setCopied(true); }}>{copied ? 'Copied ✓' : 'Copy'}</button>
              </div>
            </li>
            <li>Tick <b>Web API</b>, agree to the terms, and click <b>Save</b>.</li>
            <li>Open the app's <b>Settings</b>, copy the <b>Client ID</b> and paste it here:</li>
          </ol>
          <div className="row gap">
            <input className="input" placeholder="Client ID (32 letters and numbers)" value={draftId} onChange={(e) => setDraftId(e.target.value)} />
            <button
              className="btn primary"
              disabled={!/^[0-9a-f]{32}$/i.test(draftId.trim())}
              onClick={() => {
                sp.setClientId(draftId);
                setClientId(sp.getClientId());
              }}
            >
              Save
            </button>
          </div>
          <p className="muted small">The Client ID isn't secret. Never paste the <i>Client secret</i> anywhere.</p>
        </div>
      ) : !connected ? (
        <div className="sp-connect">
          <p>Sign in with Spotify to see your playlists. You'll come straight back here.</p>
          {error && <p className="save-err small">{error}</p>}
          <div className="row gap wrap">
            <button
              className="btn spotify-btn primary-sp"
              onClick={async () => {
                try {
                  sessionStorage.setItem('wo-spotify-reopen', '1');
                  await saveNow(); // we're about to leave the page for Spotify's sign-in
                  await sp.startLogin();
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                }
              }}
            >
              <SpotifyLogo /> Connect Spotify
            </button>
            {!sp.clientIdFromBuild() && (
              <button className="btn small ghost" onClick={() => { sp.setClientId(''); setClientId(''); }}>Change Client ID</button>
            )}
          </div>
          <p className="muted small">If Spotify says “INVALID_CLIENT: Invalid redirect URI”, add <code>{sp.redirectUri()}</code> to your app's Redirect URIs.</p>
        </div>
      ) : chosen ? (
        <div className="sp-chosen">
          <div className="row gap">
            {chosen.image && <img src={chosen.image} alt="" className="sp-cover" />}
            <div>
              <b>{chosen.name}</b>
              <div className="muted small">{chosen.total} songs{chosen.owner ? ` · by ${chosen.owner}` : ''}</div>
            </div>
          </div>
          <label className="row gap small"><input type="checkbox" checked={addSongs} onChange={(e) => setAddSongs(e.target.checked)} /> Add its songs to this story's song list</label>
          <label className="row gap small"><input type="checkbox" checked={asPlayer} onChange={(e) => setAsPlayer(e.target.checked)} /> Show it as the story playlist player{story.playlistUrl ? ' (replaces the current one)' : ''}</label>
          {addSongs && story.characters.length > 0 && (
            <label className="row gap small">
              Tag every song as a theme for
              <select className="input slim" value={tagChar} onChange={(e) => setTagChar(e.target.value)}>
                <option value="">nobody</option>
                {story.characters.map((c) => <option key={c.id} value={c.id}>{c.name || 'Unnamed'}</option>)}
              </select>
            </label>
          )}
          {error && <p className="save-err small">{error}</p>}
          <div className="row gap end">
            <button className="btn ghost" onClick={() => setChosen(null)}>← Back</button>
            <button className="btn primary" disabled={busy || (!addSongs && !asPlayer)} onClick={runImport}>{busy ? 'Importing…' : 'Import'}</button>
          </div>
        </div>
      ) : (
        <>
          <div className="row gap between">
            <input className="input slim" style={{ flex: 1 }} placeholder="Search your playlists…" value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="btn small ghost" onClick={() => { sp.disconnect(); setConnected(false); setLists(null); }}>Disconnect</button>
          </div>
          {error && <p className="save-err small">{error}</p>}
          {!lists && !error && <p className="muted">Loading your playlists…</p>}
          {lists && !filtered.length && <p className="muted small">No playlists found.</p>}
          <div className="sp-grid">
            {filtered.map((l) => (
              <button key={l.id} className="sp-pl" onClick={() => setChosen(l)}>
                {l.image ? <img src={l.image} alt="" /> : <span className="sp-noimg">♪</span>}
                <b>{l.name}</b>
                <span className="muted small">{l.total} songs</span>
              </button>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}
