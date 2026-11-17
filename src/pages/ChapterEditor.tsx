import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Editor } from '@tiptap/react';
import { useStoryCtx } from '../storyContext';
import { useChapters } from '../chapters';
import { CHAPTER_STATUSES } from '../defaults';
import { removeCommentMark, RichEditor, scrollToComment } from '../components/Editor';
import { Avatar, Field, Lightbox } from '../components/ui';
import { uid } from '../util';
import { AddSong, MiniSongs, Player } from '../components/Music';
import type { Chapter, ChapterStatus, Character, Story } from '../types';

type Panel = 'notes' | 'cast' | 'plot' | 'world' | 'music';

export default function ChapterEditor() {
  const { story, upd, base } = useStoryCtx();
  const { chapterId } = useParams();
  const { chapters, edit } = useChapters(story.id);
  const idx = chapters.findIndex((c) => c.id === chapterId);
  const ch = chapters[idx];
  const [panel, setPanel] = useState<Panel | null>(() => (window.innerWidth > 900 ? 'notes' : null));
  const [focus, setFocus] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [draft, setDraft] = useState<{ from: number; to: number; quote: string } | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.classList.toggle('focus-mode', focus);
    return () => document.body.classList.remove('focus-mode');
  }, [focus]);

  const onChange = useCallback((html: string, words: number) => chapterId && edit(chapterId, (c) => void Object.assign(c, { html, words })), [chapterId, edit]);
  const onReady = useCallback((e: Editor) => setEditor(e), []);

  if (!ch)
    return (
      <div className="page">
        <p>Chapter not found.</p>
        <Link className="btn" to={base + '/chapters'}>← All chapters</Link>
      </div>
    );

  const prev = chapters[idx - 1];
  const next = chapters[idx + 1];
  const set = (fn: (c: Chapter) => void) => edit(ch.id, fn as any);

  const startComment = () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    if (from === to) return alert('Select some text first, then add a note to it.');
    setDraft({ from, to, quote: editor.state.doc.textBetween(from, to, ' ').slice(0, 160) });
    setPanel('notes');
  };

  const saveComment = (text: string) => {
    if (!editor || !draft || !text.trim()) return;
    const id = uid();
    editor.chain().setTextSelection({ from: draft.from, to: draft.to }).setMark('comment', { id }).run();
    set((c) => void c.comments.push({ id, text: text.trim(), quote: draft.quote, resolved: false, createdAt: Date.now() }));
    setDraft(null);
    setActive(id);
  };

  const resolvedCss = ch.comments
    .filter((c) => c.resolved)
    .map((c) => `.rich-body [data-comment="${c.id}"]{background:none;border-bottom:none}`)
    .join('');

  return (
    <div className={'write' + (panel ? ' with-panel' : '') + (focus ? ' focused' : '')}>
      <style>{resolvedCss + (active ? `.rich-body [data-comment="${active}"]{background:color-mix(in srgb, var(--accent) 45%, transparent)}` : '')}</style>
      <div className="write-top">
        <Link to={base + '/chapters'} className="muted small">← Chapters</Link>
        <span className="row gap small">
          {prev && <Link to={`${base}/chapters/${prev.id}`} title={prev.title}>‹ Ch. {idx}</Link>}
          <b>Chapter {idx + 1}</b>
          {next && <Link to={`${base}/chapters/${next.id}`} title={next.title}>Ch. {idx + 2} ›</Link>}
        </span>
        <span className="row gap wrap write-tools">
          <select className="input slim" value={ch.status} onChange={(e) => set((c) => void (c.status = e.target.value as ChapterStatus))} aria-label="Chapter status">
            {CHAPTER_STATUSES.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
          <select className="input slim" value={ch.povId ?? ''} onChange={(e) => set((c) => void (c.povId = e.target.value || undefined))} aria-label="Point of view">
            <option value="">POV: —</option>
            {story.characters.map((c) => (
              <option key={c.id} value={c.id}>POV: {c.name || 'Unnamed'}</option>
            ))}
          </select>
          <span className="muted small">{ch.words.toLocaleString()} words</span>
          <button className="btn small" onClick={startComment} title="Select text, then click to leave a note on it">💬 Note</button>
          <button className={'btn small' + (focus ? ' primary' : '')} onClick={() => setFocus(!focus)} title="Hide everything but the page">
            {focus ? 'Exit focus' : '🌙 Focus'}
          </button>
          {!focus && (
            <button className="btn small ghost" onClick={() => setPanel(panel ? null : 'notes')}>{panel ? 'Hide panel ›' : '‹ Panel'}</button>
          )}
        </span>
      </div>

      <div className="write-grid">
        <div className="paper" ref={bodyRef}>
          <Field className="chapter-title" value={ch.title} placeholder={`Chapter ${idx + 1} title`} onChange={(v) => set((c) => void (c.title = v))} />
          <RichEditor
            key={ch.id}
            html={ch.html}
            onChange={onChange}
            onReady={onReady}
            onCommentClick={(id) => {
              setActive(id);
              setPanel('notes');
            }}
          />
        </div>

        {panel && !focus && (
          <aside className="side card">
            <div className="side-tabs">
              {(
                [
                  ['notes', '💬', 'Notes'],
                  ['cast', '👤', 'Cast'],
                  ['plot', '🧵', 'Plot'],
                  ['world', '🗺️', 'World'],
                  ['music', '🎵', 'Music'],
                ] as const
              ).map(([k, icon, label]) => (
                <button key={k} className={panel === k ? 'on' : ''} onClick={() => setPanel(k)}>
                  {icon} {label}
                </button>
              ))}
            </div>
            <div className="side-body">
              {panel === 'notes' && (
                <NotesPanel
                  ch={ch}
                  set={set}
                  draft={draft}
                  onCancelDraft={() => setDraft(null)}
                  onSaveDraft={saveComment}
                  active={active}
                  onPick={(id) => {
                    setActive(id);
                    scrollToComment(bodyRef.current, id);
                  }}
                  onDelete={(id) => {
                    if (editor) removeCommentMark(editor, id);
                    set((c) => void (c.comments = c.comments.filter((x) => x.id !== id)));
                  }}
                />
              )}
              {panel === 'cast' && <CastPanel story={story} povId={ch.povId} />}
              {panel === 'plot' && <PlotPanel story={story} chapterId={ch.id} upd={upd} base={base} />}
              {panel === 'world' && <WorldPanel story={story} />}
              {panel === 'music' && <MusicPanel story={story} chapterId={ch.id} upd={upd} povId={ch.povId} />}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

function NotesPanel({
  ch,
  set,
  draft,
  onCancelDraft,
  onSaveDraft,
  active,
  onPick,
  onDelete,
}: {
  ch: Chapter;
  set: (fn: (c: Chapter) => void) => void;
  draft: { quote: string } | null;
  onCancelDraft: () => void;
  onSaveDraft: (t: string) => void;
  active: string | null;
  onPick: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [text, setText] = useState('');
  const [showResolved, setShowResolved] = useState(false);
  const list = ch.comments.filter((c) => showResolved || !c.resolved);
  return (
    <>
      <label className="lbl" style={{ marginTop: 0 }}>Chapter summary</label>
      <Field multiline className="input small" value={ch.summary} placeholder="What happens in this chapter? (shows on the chapter list)" onChange={(v) => set((c) => void (c.summary = v))} />

      <label className="lbl">Notes on the text</label>
      {draft && (
        <div className="comment draft">
          <q>{draft.quote}</q>
          <textarea className="input" autoFocus rows={3} placeholder="Your note…" value={text} onChange={(e) => setText(e.target.value)} />
          <div className="row gap end">
            <button className="btn small ghost" onClick={() => { setText(''); onCancelDraft(); }}>Cancel</button>
            <button className="btn small primary" disabled={!text.trim()} onClick={() => { onSaveDraft(text); setText(''); }}>Save note</button>
          </div>
        </div>
      )}
      {!draft && !list.length && <p className="muted small">Select some text and press <b>💬 Note</b> to leave yourself a note on it, e.g. “check timeline” or “make this funnier”.</p>}
      {list.map((c) => (
        <div key={c.id} className={'comment' + (c.id === active ? ' on' : '') + (c.resolved ? ' resolved' : '')} onClick={() => onPick(c.id)}>
          {c.quote && <q>{c.quote}</q>}
          <p>{c.text}</p>
          <div className="row gap end small">
            <button
              className="btn small ghost"
              onClick={(e) => {
                e.stopPropagation();
                set((ch2) => {
                  const x = ch2.comments.find((y) => y.id === c.id);
                  if (x) x.resolved = !x.resolved;
                });
              }}
            >
              {c.resolved ? 'Reopen' : '✓ Done'}
            </button>
            <button className="icon-btn tiny danger" title="Delete note" onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}>🗑</button>
          </div>
        </div>
      ))}
      {ch.comments.some((c) => c.resolved) && (
        <button className="btn small ghost" onClick={() => setShowResolved(!showResolved)}>
          {showResolved ? 'Hide done notes' : `Show done notes (${ch.comments.filter((c) => c.resolved).length})`}
        </button>
      )}
    </>
  );
}

function CastPanel({ story, povId }: { story: Story; povId?: string }) {
  const [open, setOpen] = useState<string | null>(povId ?? null);
  const [q, setQ] = useState('');
  const list = [...story.characters]
    .sort((a, b) => (a.id === povId ? -1 : b.id === povId ? 1 : 0))
    .filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      {story.characters.length > 6 && <input className="input slim" style={{ width: '100%', marginBottom: 8 }} placeholder="Find a character…" value={q} onChange={(e) => setQ(e.target.value)} />}
      {!story.characters.length && <p className="muted small">No characters yet.</p>}
      {list.map((c) => (
        <div key={c.id} className="cast-item">
          <button className="cast-head" onClick={() => setOpen(open === c.id ? null : c.id)}>
            <Avatar c={c} size={32} />
            <span>
              <b>{c.name || 'Unnamed'}</b> {c.id === povId && <span className="kind-badge">POV</span>}
              {c.role && <span className="muted small"> · {c.role}</span>}
            </span>
          </button>
          {open === c.id && <CastDetail c={c} />}
        </div>
      ))}
    </>
  );
}

/** The bits of a character card you need mid-scene: facts, traits, how they talk. */
function CastDetail({ c }: { c: Character }) {
  const facts = c.sections.flatMap((s) => (s.kind === 'facts' ? (s.facts ?? []).filter((f) => f.value) : []));
  const tags = c.sections.flatMap((s) => (s.kind === 'tags' ? s.tags ?? [] : []));
  const quotes = c.sections.flatMap((s) => (s.kind === 'quotes' ? (s.quotes ?? []).filter((q) => q.text) : []));
  const voice = c.sections.map((s) => (s.kind === 'quotes' ? s.voice : '')).filter(Boolean).join(' ');
  return (
    <div className="cast-detail small">
      {c.image && <img src={c.image} alt="" />}
      {facts.map((f) => (
        <div key={f.id}><span className="muted">{f.label}:</span> {f.value}</div>
      ))}
      {tags.length > 0 && <div className="tags" style={{ marginTop: 4 }}>{tags.map((t) => <span key={t} className="tag">{t}</span>)}</div>}
      {voice && <p className="voice-note">🗣 {voice}</p>}
      {quotes.map((q) => <q key={q.id} className="cast-quote">{q.text}</q>)}
      {!facts.length && !tags.length && !voice && !quotes.length && <p className="muted">Nothing filled in on their card yet.</p>}
    </div>
  );
}

function PlotPanel({ story, chapterId, upd, base }: { story: Story; chapterId: string; upd: ReturnType<typeof useStoryCtx>['upd']; base: string }) {
  const here = story.arcs.flatMap((a, ai) => a.points.map((p, pi) => ({ a, p, ai, pi }))).filter((x) => x.p.chapterId === chapterId);
  const free = story.arcs.flatMap((a) => a.points.filter((p) => p.chapterId !== chapterId).map((p) => ({ a, p })));
  const setChapter = (pointId: string, value: string | undefined) =>
    upd((s) => s.arcs.forEach((a) => a.points.forEach((p) => p.id === pointId && (p.chapterId = value))));
  return (
    <>
      <p className="muted small" style={{ marginTop: 0 }}>Plot points that happen in this chapter.</p>
      {here.map(({ a, p }) => (
        <div key={p.id} className="plot-link" style={{ borderLeftColor: a.color }}>
          <span className="muted small">{a.title}</span>
          <b>{p.title || 'Untitled'}</b>
          {p.description && <span className="small">{p.description}</span>}
          <div className="row gap end">
            <select
              className="input slim"
              value={p.status}
              onChange={(e) => upd((s) => s.arcs.forEach((x) => x.points.forEach((y) => y.id === p.id && (y.status = e.target.value as typeof p.status))))}
            >
              <option value="idea">💭 Idea</option>
              <option value="planned">📝 Planned</option>
              <option value="written">✅ Written</option>
            </select>
            <button className="icon-btn tiny" title="Unlink from this chapter" onClick={() => setChapter(p.id, undefined)}>×</button>
          </div>
        </div>
      ))}
      {free.length > 0 && (
        <select className="input slim" style={{ width: '100%' }} value="" onChange={(e) => e.target.value && setChapter(e.target.value, chapterId)}>
          <option value="">+ Link a plot point…</option>
          {story.arcs.map((a) => (
            <optgroup key={a.id} label={a.title || 'Arc'}>
              {a.points.filter((p) => p.chapterId !== chapterId).map((p) => (
                <option key={p.id} value={p.id}>{p.title || 'Untitled'}{p.chapterId ? ' (in another chapter)' : ''}</option>
              ))}
            </optgroup>
          ))}
        </select>
      )}
      {story.arcs.length > 0 && (
        <button
          className="btn small ghost"
          style={{ marginTop: 8 }}
          onClick={() => {
            const title = prompt('What happens?');
            if (!title?.trim()) return;
            upd((s) => void s.arcs[0].points.push({ id: uid(), title: title.trim(), description: '', chapter: '', status: 'written', characterIds: [], chapterId }));
          }}
        >
          + New plot point here
        </button>
      )}
      <p className="small"><Link to={base + '/plot'}>Open the plot board →</Link></p>
    </>
  );
}

function WorldPanel({ story }: { story: Story }) {
  const [zoom, setZoom] = useState<number | null>(null);
  const [q, setQ] = useState('');
  const answered = story.questions.filter((x) => x.answer.trim() && (!q || (x.question + x.answer).toLowerCase().includes(q.toLowerCase())));
  return (
    <>
      {story.worldImages.length > 0 && (
        <div className="side-gallery">
          {story.worldImages.map((img, i) => (
            <img key={img.id} src={img.src} alt={img.title} title={img.title} onClick={() => setZoom(i)} />
          ))}
        </div>
      )}
      <input className="input slim" style={{ width: '100%', margin: '8px 0' }} placeholder="Search world notes…" value={q} onChange={(e) => setQ(e.target.value)} />
      {answered.map((x) => (
        <div key={x.id} className="world-note small">
          <b>{x.question}</b>
          <p>{x.answer}</p>
        </div>
      ))}
      {!answered.length && <p className="muted small">Answers from the World page show up here.</p>}
      {zoom !== null && <Lightbox src={story.worldImages[zoom].src} caption={story.worldImages[zoom].title} onClose={() => setZoom(null)} />}
    </>
  );
}

/** The chapter's soundtrack: songs linked to it, to its scenes, and the POV character's themes. */
function MusicPanel({ story, chapterId, upd, povId }: { story: Story; chapterId: string; upd: ReturnType<typeof useStoryCtx>['upd']; povId?: string }) {
  const scenes = new Set(story.arcs.flatMap((a) => a.points.filter((p) => p.chapterId === chapterId).map((p) => p.id)));
  const here = story.songs.filter((s) => s.chapterIds.includes(chapterId) || s.pointIds.some((p) => scenes.has(p)));
  const pov = story.characters.find((c) => c.id === povId);
  const povSongs = pov ? story.songs.filter((s) => s.characterIds.includes(pov.id) && !here.includes(s)) : [];
  return (
    <>
      <p className="muted small" style={{ marginTop: 0 }}>Songs for this chapter. Press ▶ to listen while you write.</p>
      {here.length ? (
        <MiniSongs
          songs={here}
          unlinkLabel="Remove from this chapter"
          onUnlink={(id) => upd((s) => { const x = s.songs.find((y) => y.id === id); if (x) x.chapterIds = x.chapterIds.filter((y) => y !== chapterId); })}
        />
      ) : (
        <p className="muted small">No songs linked yet.</p>
      )}
      <AddSong
        songs={story.songs.filter((s) => !here.includes(s))}
        onPick={(id) => upd((s) => void s.songs.find((x) => x.id === id)!.chapterIds.push(chapterId))}
        onCreate={(song) => upd((s) => void s.songs.push({ ...song, chapterIds: [chapterId] }))}
      />
      {povSongs.length > 0 && (
        <>
          <label className="lbl">{pov!.name}&rsquo;s theme songs</label>
          <MiniSongs songs={povSongs} />
        </>
      )}
      {story.playlistUrl && (
        <>
          <label className="lbl">Story playlist</label>
          <Player url={story.playlistUrl} />
        </>
      )}
    </>
  );
}
