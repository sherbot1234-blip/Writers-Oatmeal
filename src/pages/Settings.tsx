import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStoryCtx } from '../storyContext';
import { useLibrary } from '../store';
import { ImagePick } from '../components/ui';
import { THEME_PRESETS } from '../defaults';
import { download, ensureFonts, FONT_OPTIONS, fontStack, move, slug, uid } from '../util';
import type { Theme } from '../types';
import { themeVars } from './Library';

const COLOR_FIELDS: { key: keyof Theme; label: string }[] = [
  { key: 'bg', label: 'Background' },
  { key: 'surface', label: 'Cards' },
  { key: 'text', label: 'Text' },
  { key: 'muted', label: 'Soft text' },
  { key: 'accent', label: 'Accent' },
];

export default function Settings() {
  const { story, upd } = useStoryCtx();
  const { update } = useLibrary();
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
        <h2 className="sec-title">Story data</h2>
        <div className="row gap wrap">
          <button className="btn" onClick={() => download(`${slug(story.title)}.json`, story)}>Export this story</button>
          <button
            className="btn"
            onClick={() => {
              const copy = { ...structuredClone(story), id: uid(), title: story.title + ' (copy)', createdAt: Date.now(), updatedAt: Date.now() };
              update((d) => void d.stories.unshift(copy));
              nav('/story/' + copy.id);
            }}
          >
            Duplicate story
          </button>
          <button
            className="btn danger"
            onClick={() => {
              if (!confirm(`Delete “${story.title}” forever? Export it first if you might want it back.`)) return;
              nav('/');
              update((d) => void (d.stories = d.stories.filter((s) => s.id !== story.id)));
            }}
          >
            Delete story
          </button>
        </div>
      </section>
    </div>
  );
}
