import { useState } from 'react';
import type { Section, SectionKind } from '../types';
import { makeSection, SECTION_KINDS } from '../defaults';
import { move, uid } from '../util';
import { Field, ImagePick, Lightbox, RadarChart, TagInput } from './ui';

type Edit = (fn: (sections: Section[]) => void) => void;

/**
 * Renders an editable list of sections. In templateMode only the structure
 * (titles, row labels, stat names) is editable — values are left for each character.
 */
export function SectionList({ sections, edit, accent, templateMode }: { sections: Section[]; edit: Edit; accent: string; templateMode?: boolean }) {
  return (
    <>
      <div className="section-grid">
        {sections.map((sec, i) => (
          <SectionCard
            key={sec.id}
            sec={sec}
            accent={accent}
            templateMode={templateMode}
            first={i === 0}
            last={i === sections.length - 1}
            edit={(fn) => edit((secs) => fn(secs[i]))}
            onMove={(d) => edit((secs) => move(secs, i, i + d))}
            onDelete={() => confirm(`Remove the "${sec.title || 'untitled'}" section?`) && edit((secs) => void secs.splice(i, 1))}
          />
        ))}
      </div>
      <AddSection onAdd={(k) => edit((secs) => void secs.push(makeSection(k)))} />
    </>
  );
}

export function AddSection({ onAdd }: { onAdd: (k: SectionKind) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="add-section">
      {open ? (
        <div className="kind-menu card">
          {SECTION_KINDS.map((k) => (
            <button
              key={k.kind}
              className="kind-opt"
              onClick={() => {
                onAdd(k.kind);
                setOpen(false);
              }}
            >
              <b>{k.label}</b>
              <span className="muted small">{k.hint}</span>
            </button>
          ))}
          <button className="btn small ghost" onClick={() => setOpen(false)}>Cancel</button>
        </div>
      ) : (
        <button className="btn dashed wide" onClick={() => setOpen(true)}>+ Add section</button>
      )}
    </div>
  );
}

function SectionCard({
  sec,
  edit,
  accent,
  templateMode,
  first,
  last,
  onMove,
  onDelete,
}: {
  sec: Section;
  edit: (fn: (s: Section) => void) => void;
  accent: string;
  templateMode?: boolean;
  first: boolean;
  last: boolean;
  onMove: (d: number) => void;
  onDelete: () => void;
}) {
  const kindLabel = SECTION_KINDS.find((k) => k.kind === sec.kind)?.label;
  const [lightbox, setLightbox] = useState<string | null>(null);

  return (
    <section className={'card sec ' + (sec.width === 'full' ? 'full' : 'half')}>
      <div className="sec-head">
        <Field className="sec-title" value={sec.title} placeholder="Section title" onChange={(v) => edit((s) => void (s.title = v))} />
        <div className="sec-tools">
          <span className="kind-badge">{kindLabel}</span>
          <button className="icon-btn" title={sec.width === 'full' ? 'Make half width' : 'Make full width'} onClick={() => edit((s) => void (s.width = s.width === 'full' ? 'half' : 'full'))}>
            {sec.width === 'full' ? '⇥⇤' : '⇤⇥'}
          </button>
          <button className="icon-btn" disabled={first} title="Move earlier" onClick={() => onMove(-1)}>↑</button>
          <button className="icon-btn" disabled={last} title="Move later" onClick={() => onMove(1)}>↓</button>
          <button className="icon-btn danger" title="Remove section" onClick={onDelete}>🗑</button>
        </div>
      </div>

      {sec.kind === 'facts' && (
        <div className="facts">
          {(sec.facts ?? []).map((f, i) => (
            <div className="fact" key={f.id}>
              <Field className="fact-label" value={f.label} placeholder="Label" onChange={(v) => edit((s) => void (s.facts![i].label = v))} />
              {templateMode ? (
                <span className="muted small fact-value">…filled in per character</span>
              ) : (
                <Field multiline className="fact-value" value={f.value} placeholder="—" onChange={(v) => edit((s) => void (s.facts![i].value = v))} />
              )}
              <span className="fact-tools">
                <button className="icon-btn tiny" onClick={() => edit((s) => move(s.facts!, i, i - 1))} title="Up">↑</button>
                <button className="icon-btn tiny danger" onClick={() => edit((s) => void s.facts!.splice(i, 1))} title="Remove row">×</button>
              </span>
            </div>
          ))}
          <button className="btn small ghost" onClick={() => edit((s) => void (s.facts ??= []).push({ id: uid(), label: '', value: '' }))}>+ Row</button>
        </div>
      )}

      {sec.kind === 'stats' && (
        <div className="stats">
          {!templateMode && (sec.stats?.length ?? 0) > 0 && (
            <div className="stats-chart">
              {sec.statsView !== 'bars' && (sec.stats?.length ?? 0) >= 3 ? (
                <RadarChart stats={sec.stats!} color={accent} />
              ) : (
                <div className="bars">
                  {sec.stats!.map((st) => (
                    <div className="bar-row" key={st.id}>
                      <span className="bar-label">{st.label || '—'}</span>
                      <span className="bar-track">
                        <span className="bar-fill" style={{ width: st.value * 10 + '%', background: accent }} />
                      </span>
                      <span className="bar-val">{st.value}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="seg">
                <button className={sec.statsView !== 'bars' ? 'on' : ''} onClick={() => edit((s) => void (s.statsView = 'radar'))}>Radar</button>
                <button className={sec.statsView === 'bars' ? 'on' : ''} onClick={() => edit((s) => void (s.statsView = 'bars'))}>Bars</button>
              </div>
            </div>
          )}
          <div className="stat-edit">
            {(sec.stats ?? []).map((st, i) => (
              <div className="stat-line" key={st.id}>
                <Field value={st.label} placeholder="Trait" onChange={(v) => edit((s) => void (s.stats![i].label = v))} />
                {!templateMode && (
                  <>
                    <input type="range" min={0} max={10} value={st.value} onChange={(e) => edit((s) => void (s.stats![i].value = +e.target.value))} style={{ accentColor: accent }} />
                    <span className="bar-val">{st.value}</span>
                  </>
                )}
                <button className="icon-btn tiny danger" onClick={() => edit((s) => void s.stats!.splice(i, 1))} title="Remove">×</button>
              </div>
            ))}
            <button className="btn small ghost" onClick={() => edit((s) => void (s.stats ??= []).push({ id: uid(), label: '', value: 5 }))}>+ Trait</button>
          </div>
        </div>
      )}

      {sec.kind === 'text' &&
        (templateMode ? (
          <p className="muted small">Free text, filled in per character.</p>
        ) : (
          <Field multiline className="prose" value={sec.text ?? ''} placeholder="Write here…" onChange={(v) => edit((s) => void (s.text = v))} />
        ))}

      {sec.kind === 'tags' &&
        (templateMode ? (
          <p className="muted small">Tags, filled in per character.</p>
        ) : (
          <TagInput tags={sec.tags ?? []} onChange={(t) => edit((s) => void (s.tags = t))} />
        ))}

      {sec.kind === 'images' &&
        (templateMode ? (
          <p className="muted small">Image gallery, filled in per character.</p>
        ) : (
          <div className="mini-gallery">
            {(sec.images ?? []).map((src, i) => (
              <div className="mini-img" key={i}>
                <img src={src} alt="" onClick={() => setLightbox(src)} />
                <button className="icon-btn tiny danger" onClick={() => edit((s) => void s.images!.splice(i, 1))}>×</button>
              </div>
            ))}
            <ImagePick multiple className="mini-add" onPick={(srcs) => edit((s) => void (s.images ??= []).push(...srcs))}>
              + Image
            </ImagePick>
          </div>
        ))}
      {sec.kind === 'quotes' &&
        (templateMode ? (
          <p className="muted small">Signature quotes and voice notes, filled in per character.</p>
        ) : (
          <div className="quotes">
            <Field
              multiline
              className="small voice"
              value={sec.voice ?? ''}
              placeholder="How do they talk? Accent, pet words, formal or blunt, what they never say…"
              onChange={(v) => edit((s) => void (s.voice = v))}
            />
            {(sec.quotes ?? []).map((q, i) => (
              <figure key={q.id} className="quote" style={{ borderLeftColor: accent }}>
                <Field multiline className="quote-text" value={q.text} placeholder="“A line only they would say…”" onChange={(v) => edit((s) => void (s.quotes![i].text = v))} />
                <figcaption className="row gap">
                  <span aria-hidden>—</span>
                  <Field className="small muted-field" value={q.context} placeholder="to whom / when (optional)" onChange={(v) => edit((s) => void (s.quotes![i].context = v))} />
                  <button className="icon-btn tiny danger" title="Remove quote" onClick={() => edit((s) => void s.quotes!.splice(i, 1))}>×</button>
                </figcaption>
              </figure>
            ))}
            <button className="btn small ghost" onClick={() => edit((s) => void (s.quotes ??= []).push({ id: uid(), text: '', context: '' }))}>+ Quote</button>
          </div>
        ))}
      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </section>
  );
}
