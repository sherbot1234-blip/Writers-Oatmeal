import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStoryCtx } from '../storyContext';
import { useLibrary } from '../store';
import { ImagePick } from '../components/ui';
import { THEME_PRESETS } from '../defaults';
import { download, ensureFonts, FONT_OPTIONS, fontStack, move, slug, uid } from '../util';
import type { Theme } from '../types';
import { themeVars } from './Library';
import { deleteUniverse } from '../universe';

const COLOR_FIELDS: { key: keyof Theme; label: string }[] = [
  { key: 'bg', label: 'Background' },
  { key: 'surface', label: 'Cards' },
  { key: 'text', label: 'Text' },
  { key: 'muted', label: 'Soft text' },
  { key: 'accent', label: 'Accent' },
];

export default function Settings() {
  const { story, upd } = useStoryCtx();
  const { lib, update } = useLibrary();
  const isUniverse = story.kind === 'universe';
  const noun = isUniverse ? 'universe' : 'story';
  const nav = useNavigate();
  const t = story.theme;
  const setTheme = (patch: Partial<Theme>) => upd((s) => void Object.assign(s.theme, patch));

  useEffect(() => {
    ensureFonts([...FONT_OPTIONS, ...THEME_PRESETS.flatMap((p) => [p.theme.headingFont, p.theme.bodyFont])]);
  }, []);

  return (
    <div className="page">
      <div className="page-head">
        <h1>Customise</h1>
      </div>

      <section className="card">
        <h2 className="sec-title">Theme presets</h2>
        <p className="muted small">Start from a preset, then fine-tune below. Your background image is kept.</p>
        <div className="preset-grid">
          {THEME_PRESETS.map((p) => (
            <button key={p.name} className="preset" style={{ ...themeVars(p.theme), background: p.theme.bg, color: p.theme.text }} onClick={() => setTheme({ ...p.theme, bgImage: t.bgImage })}>
              <span style={{ fontFamily: fontStack(p.theme.headingFont), fontSize: 18 }}>{p.name}</span>
              <span className="preset-bar" style={{ background: p.theme.accent }} />
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="sec-title">Colours</h2>
        <div className="color-grid">
          {COLOR_FIELDS.map((f) => (
            <label key={f.key} className="color-field">
              <input type="color" value={t[f.key] as string} onChange={(e) => setTheme({ [f.key]: e.target.value })} />
              <span>
                {f.label}
                <input className="hex" value={t[f.key] as string} onChange={(e) => /^#[0-9a-f]{0,6}$/i.test(e.target.value) && setTheme({ [f.key]: e.target.value })} />
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="sec-title">Fonts & shape</h2>
        <div className="font-grid">
          <label>
            <span className="lbl">Headings</span>
            <select className="input" value={t.headingFont} style={{ fontFamily: fontStack(t.headingFont) }} onChange={(e) => setTheme({ headingFont: e.target.value })}>
              {FONT_OPTIONS.map((f) => (
                <option key={f} value={f} style={{ fontFamily: fontStack(f) }}>{f}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="lbl">Body text</span>
            <select className="input" value={t.bodyFont} style={{ fontFamily: fontStack(t.bodyFont) }} onChange={(e) => setTheme({ bodyFont: e.target.value })}>
              {FONT_OPTIONS.map((f) => (
                <option key={f} value={f} style={{ fontFamily: fontStack(f) }}>{f}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="lbl">Corner roundness: {t.radius}px</span>
            <input type="range" min={0} max={28} value={t.radius} onChange={(e) => setTheme({ radius: +e.target.value })} style={{ accentColor: t.accent, width: '100%' }} />
          </label>
        </div>
        <div className="font-preview card">
          <h3>The quick brown fox</h3>
          <p>jumps over the lazy dog — this is how your story pages will read.</p>
        </div>
      </section>

      <section className="card">
        <h2 className="sec-title">Background image</h2>
        <div className="row gap wrap">
          <ImagePick className="btn" maxDim={2400} onPick={([src]) => setTheme({ bgImage: src })}>{t.bgImage ? 'Change image' : 'Upload image'}</ImagePick>
          {t.bgImage && <button className="btn ghost" onClick={() => setTheme({ bgImage: undefined })}>Remove</button>}
        </div>
        {t.bgImage && (
          <label style={{ display: 'block', marginTop: 12 }}>
            <span className="lbl">Fade image into background colour: {t.bgOverlay}%</span>
            <input type="range" min={0} max={100} value={t.bgOverlay} onChange={(e) => setTheme({ bgOverlay: +e.target.value })} style={{ accentColor: t.accent, width: '100%' }} />
          </label>
        )}
      </section>

      <section className="card">
        <h2 className="sec-title">Pages</h2>
        <p className="muted small">Rename, hide or reorder the pages for this story.</p>
        {story.tabs.map((tab, i) => (
          <div key={tab.key} className="tab-row">
            <input className="input slim" value={tab.label} onChange={(e) => upd((s) => void (s.tabs[i].label = e.target.value))} />
            <label className="row gap small">
              <input type="checkbox" checked={!tab.hidden} onChange={(e) => upd((s) => void (s.tabs[i].hidden = !e.target.checked))} /> Show
            </label>
            <button className="icon-btn" onClick={() => upd((s) => move(s.tabs, i, i - 1))}>↑</button>
            <button className="icon-btn" onClick={() => upd((s) => move(s.tabs, i, i + 1))}>↓</button>
          </div>
        ))}
      </section>

      <section className="card">
        <h2 className="sec-title">{isUniverse ? 'Universe data' : 'Story data'}</h2>
        <div className="row gap wrap">
          <button
            className="btn"
            // exported stories are self-contained: shared characters come along as normal characters
            onClick={() => download(`${slug(story.title)}.json`, { ...story, universeId: undefined, sharedCharacterIds: [], chapters: lib.chapters.filter((c) => c.storyId === story.id) })}
          >
            Export this {noun}
          </button>
          {!isUniverse && (
            <button
              className="btn"
              onClick={() => {
                const own = lib.stories.find((s) => s.id === story.id)!;
                const copy = { ...structuredClone(own), id: uid(), title: story.title + ' (copy)', createdAt: Date.now(), updatedAt: Date.now() };
                // chapters come along too, and plot points keep pointing at the right (copied) chapter
                const chMap = new Map<string, string>();
                const chCopies = lib.chapters.filter((c) => c.storyId === story.id).map((c) => {
                  const id = uid();
                  chMap.set(c.id, id);
                  return { ...structuredClone(c), id, storyId: copy.id, createdAt: Date.now(), updatedAt: Date.now() };
                });
                copy.arcs.forEach((a) => a.points.forEach((p) => p.chapterId && (p.chapterId = chMap.get(p.chapterId))));
                update((d) => {
                  d.stories.unshift(copy);
                  d.chapters.push(...chCopies);
                });
                nav('/story/' + copy.id);
              }}
            >
              Duplicate story
            </button>
          )}
          <button
            className="btn danger"
            onClick={() => {
              const msg = isUniverse
                ? `Delete the universe “${story.title}”? Its stories are kept, and each keeps its own copy of the shared characters it uses.`
                : `Delete “${story.title}” and all its chapters forever? Export it first if you might want it back.`;
              if (!confirm(msg)) return;
              nav('/');
              update((d) => {
                if (isUniverse) deleteUniverse(d, story.id);
                else {
                  d.stories = d.stories.filter((s) => s.id !== story.id);
                  d.chapters = d.chapters.filter((c) => c.storyId !== story.id);
                }
              });
            }}
          >
            Delete {noun}
          </button>
        </div>
      </section>
    </div>
  );
}
