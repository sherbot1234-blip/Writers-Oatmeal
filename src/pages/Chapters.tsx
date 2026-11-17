import { Link, useNavigate } from 'react-router-dom';
import { useStoryCtx } from '../storyContext';
import { downloadManuscript, moveChapter, useChapters } from '../chapters';
import { CHAPTER_STATUSES, makeChapter } from '../defaults';
import { Avatar, Empty } from '../components/ui';

export default function Chapters() {
  const { story, base } = useStoryCtx();
  const { chapters, update } = useChapters(story.id);
  const nav = useNavigate();
  const total = chapters.reduce((n, c) => n + c.words, 0);
  const points = story.arcs.flatMap((a) => a.points);

  const add = () => {
    const c = makeChapter(story.id, (chapters[chapters.length - 1]?.order ?? 0) + 1);
    update((d) => void d.chapters.push(c));
    nav(`${base}/chapters/${c.id}`);
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Chapters</h1>
          <p className="muted small" style={{ margin: 0 }}>
            {chapters.length} {chapters.length === 1 ? 'chapter' : 'chapters'} · {total.toLocaleString()} words
          </p>
        </div>
        <div className="row gap wrap">
          {chapters.length > 0 && (
            <button className="btn ghost" onClick={() => downloadManuscript(story, chapters)} title="One file with every chapter, opens in Word or Google Docs">
              ⬇ Manuscript
            </button>
          )}
          <button className="btn primary" onClick={add}>+ New chapter</button>
        </div>
      </div>

      {chapters.length === 0 ? (
        <Empty icon="✍️" title="No chapters yet">
          <p className="muted">Write your chapters here. While you write, a side panel shows your characters, plot points and world notes.</p>
          <button className="btn primary" onClick={add}>+ Write chapter 1</button>
        </Empty>
      ) : (
        <ol className="chapter-list">
          {chapters.map((c, i) => {
            const st = CHAPTER_STATUSES.find((s) => s.key === c.status)!;
            const pov = story.characters.find((x) => x.id === c.povId);
            const linked = points.filter((p) => p.chapterId === c.id).length;
            const open = c.comments.filter((x) => !x.resolved).length;
            return (
              <li key={c.id} className="chapter-row card">
                <span className="chapter-num">{i + 1}</span>
                <Link to={`${base}/chapters/${c.id}`} className="chapter-main">
                  <b>{c.title || `Chapter ${i + 1}`}</b>
                  {c.summary && <span className="muted small chapter-sum">{c.summary}</span>}
                  <span className="chapter-meta small muted">
                    <span className="status-dot" style={{ ['--sc' as any]: st.color }}>{st.label}</span>
                    {pov && (
                      <span className="row gap" title="Point of view">
                        <Avatar c={pov} size={18} /> {pov.name}
                      </span>
                    )}
                    <span>{c.words.toLocaleString()} words</span>
                    {linked > 0 && <span>🧵 {linked}</span>}
                    {open > 0 && <span>💬 {open}</span>}
                  </span>
                </Link>
                <span className="row">
                  <button className="icon-btn tiny" disabled={i === 0} title="Earlier" onClick={() => update((d) => moveChapter(d, story.id, c.id, -1))}>↑</button>
                  <button className="icon-btn tiny" disabled={i === chapters.length - 1} title="Later" onClick={() => update((d) => moveChapter(d, story.id, c.id, 1))}>↓</button>
                  <button
                    className="icon-btn tiny danger"
                    title="Delete chapter"
                    onClick={() => {
                      if (!confirm(`Delete “${c.title || `Chapter ${i + 1}`}”${c.words ? ` and its ${c.words.toLocaleString()} words` : ''}? This can't be undone.`)) return;
                      update((d) => {
                        d.chapters = d.chapters.filter((x) => x.id !== c.id);
                        const s = d.stories.find((x) => x.id === story.id);
                        s?.arcs.forEach((a) => a.points.forEach((p) => p.chapterId === c.id && (p.chapterId = undefined)));
                      });
                    }}
                  >
                    🗑
                  </button>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
