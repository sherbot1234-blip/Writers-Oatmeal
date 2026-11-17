import { useState } from 'react';
import { useStoryCtx } from '../storyContext';
import { Empty, Field, ImagePick, Lightbox, Modal } from '../components/ui';
import { QUESTION_BANK } from '../defaults';
import { uid } from '../util';

export default function World() {
  const [tab, setTab] = useState<'images' | 'questions'>('images');
  return (
    <div className="page">
      <div className="page-head">
        <h1>World</h1>
        <div className="seg">
          <button className={tab === 'images' ? 'on' : ''} onClick={() => setTab('images')}>🗺️ Maps & images</button>
          <button className={tab === 'questions' ? 'on' : ''} onClick={() => setTab('questions')}>❓ Questions</button>
        </div>
      </div>
      {tab === 'images' ? <Images /> : <Questions />}
    </div>
  );
}

function Images() {
  const { story, upd } = useStoryCtx();
  const [zoom, setZoom] = useState<number | null>(null);
  const add = (srcs: string[]) =>
    upd((s) => void s.worldImages.push(...srcs.map((src) => ({ id: uid(), src, title: '', caption: '' }))));

  return (
    <>
      <div className="row end" style={{ marginBottom: 12 }}>
        <ImagePick multiple maxDim={2400} className="btn primary" onPick={add}>+ Upload images</ImagePick>
      </div>
      {story.worldImages.length === 0 ? (
        <Empty icon="🗺️" title="No maps or images yet">
          <p className="muted">Upload maps, location art, moodboards, flags, family trees — anything that shows your world.</p>
        </Empty>
      ) : (
        <div className="gallery">
          {story.worldImages.map((img, i) => (
            <figure key={img.id} className="card gal-item">
              <img src={img.src} alt={img.title} onClick={() => setZoom(i)} />
              <figcaption>
                <Field className="gal-title" value={img.title} placeholder="Title" onChange={(v) => upd((s) => void (s.worldImages[i].title = v))} />
                <Field multiline className="small" value={img.caption} placeholder="Notes…" onChange={(v) => upd((s) => void (s.worldImages[i].caption = v))} />
                <div className="row end">
                  <ImagePick className="icon-btn" maxDim={2400} onPick={([src]) => upd((s) => void (s.worldImages[i].src = src))}>↻</ImagePick>
                  <button className="icon-btn danger" title="Delete" onClick={() => confirm('Delete this image?') && upd((s) => void s.worldImages.splice(i, 1))}>🗑</button>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      {zoom !== null && story.worldImages[zoom] && (
        <Lightbox src={story.worldImages[zoom].src} caption={story.worldImages[zoom].title} onClose={() => setZoom(null)} />
      )}
    </>
  );
}

function Questions() {
  const { story, upd } = useStoryCtx();
  const [bank, setBank] = useState(false);
  const categories = Array.from(new Set(story.questions.map((q) => q.category)));

  const addQ = (category: string) => upd((s) => void s.questions.push({ id: uid(), category, question: '', answer: '' }));

  const swap = (id: string, dir: -1 | 1) =>
    upd((s) => {
      const i = s.questions.findIndex((q) => q.id === id);
      const cat = s.questions[i].category;
      let j = i + dir;
      while (j >= 0 && j < s.questions.length && s.questions[j].category !== cat) j += dir;
      if (j < 0 || j >= s.questions.length) return;
      [s.questions[i], s.questions[j]] = [s.questions[j], s.questions[i]];
    });

  const answered = story.questions.filter((q) => q.answer.trim()).length;

  return (
    <>
      <div className="row between wrap gap" style={{ marginBottom: 12 }}>
        <span className="muted small">{answered} of {story.questions.length} answered</span>
        <div className="row gap">
          <button className="btn" onClick={() => setBank(true)}>Question bank</button>
          <button
            className="btn primary"
            onClick={() => {
              const name = prompt('Category name', 'New category');
              if (name?.trim()) addQ(name.trim());
            }}
          >
            + Category
          </button>
        </div>
      </div>

      {categories.length === 0 && (
        <Empty icon="❓" title="No questions yet">
          <p className="muted">Add your own categories and questions, or pick some from the question bank.</p>
        </Empty>
      )}

      {categories.map((cat) => {
        const qs = story.questions.filter((q) => q.category === cat);
        return (
          <section key={qs[0].id} className="card q-cat">
            <div className="row between">
              <Field
                className="sec-title"
                value={cat}
                onChange={(v) => upd((s) => s.questions.forEach((q) => q.category === cat && (q.category = v)))}
              />
              <button
                className="icon-btn danger"
                title="Delete category"
                onClick={() => confirm(`Delete “${cat}” and its ${qs.length} questions?`) && upd((s) => void (s.questions = s.questions.filter((q) => q.category !== cat)))}
              >
                🗑
              </button>
            </div>
            {qs.map((q) => {
              const i = story.questions.findIndex((x) => x.id === q.id);
              return (
                <div key={q.id} className="qa">
                  <div className="row gap">
                    <Field className="q" value={q.question} placeholder="Your question…" onChange={(v) => upd((s) => void (s.questions[i].question = v))} />
                    <span className="qa-tools">
                      <button className="icon-btn tiny" onClick={() => swap(q.id, -1)} title="Up">↑</button>
                      <button className="icon-btn tiny" onClick={() => swap(q.id, 1)} title="Down">↓</button>
                      <button className="icon-btn tiny danger" onClick={() => upd((s) => void s.questions.splice(i, 1))} title="Delete">×</button>
                    </span>
                  </div>
                  <Field multiline className="a" value={q.answer} placeholder="Answer…" onChange={(v) => upd((s) => void (s.questions[i].answer = v))} />
                </div>
              );
            })}
            <button className="btn small ghost" onClick={() => addQ(cat)}>+ Question</button>
          </section>
        );
      })}

      {bank && <QuestionBank onClose={() => setBank(false)} />}
    </>
  );
}

function QuestionBank({ onClose }: { onClose: () => void }) {
  const { story, upd } = useStoryCtx();
  const existing = new Set(story.questions.map((q) => q.question.trim().toLowerCase()));
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const toggle = (key: string) => {
    const n = new Set(picked);
    n.has(key) ? n.delete(key) : n.add(key);
    setPicked(n);
  };
  return (
    <Modal title="Question bank" onClose={onClose} wide>
      <p className="muted small">Pick questions to add. You can edit or delete them afterwards.</p>
      {Object.entries(QUESTION_BANK).map(([cat, qs]) => (
        <div key={cat} className="bank-cat">
          <h4>{cat}</h4>
          {qs.map((q) => {
            const key = cat + '\u0000' + q;
            const have = existing.has(q.toLowerCase());
            return (
              <label key={q} className={'bank-q' + (have ? ' muted' : '')}>
                <input type="checkbox" disabled={have} checked={have || picked.has(key)} onChange={() => toggle(key)} /> {q}
              </label>
            );
          })}
        </div>
      ))}
      <div className="row end gap" style={{ marginTop: 12 }}>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button
          className="btn primary"
          disabled={!picked.size}
          onClick={() => {
            upd((s) => {
              for (const key of picked) {
                const [category, question] = key.split('\u0000');
                // insert after the last question of the same category so groups stay together
                let at = -1;
                s.questions.forEach((x, i) => x.category === category && (at = i));
                const q = { id: uid(), category, question, answer: '' };
                if (at >= 0) s.questions.splice(at + 1, 0, q);
                else s.questions.push(q);
              }
            });
            onClose();
          }}
        >
          Add {picked.size || ''} question{picked.size === 1 ? '' : 's'}
        </button>
      </div>
    </Modal>
  );
}
