import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { pathFor, useStoryCtx } from '../storyContext';
import { useLibrary } from '../store';
import { ImagePick } from '../components/ui';
import { THEME_PRESETS } from '../defaults';
import { download, ensureFonts, FONT_OPTIONS, fontStack, move, slug, uid } from '../util';
import type { Palette, Theme } from '../types';
import { CARD_STYLES, makePage, ORNAMENTS, PAGE_TEMPLATES, STYLE_PACKS, TEXTURES } from '../packs';
import { palette, themeVars } from './Library';
import { deleteUniverse } from '../universe';

const COLOR_FIELDS: { key: keyof Palette; label: string }[] = [
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
  const pal = palette(t);
  /** Colour edits go to whichever mood is showing. */
  const setColor = (k: keyof Palette, v: string) =>
    upd((s) => {
      if (s.theme.mood === 'alt' && s.theme.alt) s.theme.alt[k] = v;
      else s.theme[k] = v;
    });

  useEffect(() => {
    ensureFonts([...FONT_OPTIONS, ...THEME_PRESETS.flatMap((p) => [p.theme.headingFont, p.theme.bodyFont]), ...STYLE_PACKS.flatMap((p) => [p.theme.headingFont, p.theme.bodyFont])]);
  }, []);

  return (
    <div className="page">
      <div className="page-head">
        <h1>Customise</h1>
      </div>

      <section className="card">
        <h2 className="sec-title">Style packs</h2>
        <p className="muted small">A whole look in one click: colours, fonts, card shapes, textures and ornaments. Fine-tune any part below. Your background and banner images are kept.</p>
        <div className="pack-grid">
          {STYLE_PACKS.map((pk) => (
            <button
              key={pk.id}
              className={'pack-opt' + (t.pack === pk.id ? ' on' : '')}
              onClick={() => setTheme({ ...pk.theme, alt: pk.theme.alt, mood: 'main', bgImage: t.bgImage, banner: t.banner, bgOverlay: t.bgOverlay })}
            >
              <PackPreview theme={pk.theme} />
              <b>{pk.name}</b>
              <span className="muted small">{pk.blurb}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="sec-title">Look & feel</h2>
        <label className="lbl">Cards</label>
        <div className="choice-row">
          {CARD_STYLES.map((c) => (
            <button key={c.key} className={'choice' + (t.card === c.key ? ' on' : '')} onClick={() => setTheme({ card: c.key })}>
              <span className="card-sample" data-card={c.key}><span className="card">Aa</span></span>
              {c.label}
            </button>
          ))}
        </div>
        <label className="lbl">Background texture</label>
        <div className="choice-row">
          {TEXTURES.map((x) => (
            <button key={x.key} className={'choice' + (t.texture === x.key ? ' on' : '')} onClick={() => setTheme({ texture: x.key })}>
              <span className="texture-sample" data-texture={x.key}><span className="story-texture" /></span>
              {x.label}
            </button>
          ))}
        </div>
        <label className="lbl">Headings</label>
        <div className="seg">
          {(['normal', 'upper', 'small-caps'] as const).map((h) => (
            <button key={h} className={t.headingCase === h ? 'on' : ''} onClick={() => setTheme({ headingCase: h })}>
              {h === 'normal' ? 'Normal' : h === 'upper' ? 'CAPITALS' : 'Small Caps'}
            </button>
          ))}
        </div>
        <label className="lbl">Ornament under page titles</label>
        <div className="chip-row">
          {ORNAMENTS.map((o) => (
            <button key={o || 'none'} className={'chip' + (t.ornament === o ? ' on' : '')} onClick={() => setTheme({ ornament: o })}>{o || 'None'}</button>
          ))}
          <input className="input slim" style={{ width: 140 }} placeholder="or type your own" value={ORNAMENTS.includes(t.ornament) ? '' : t.ornament} onChange={(e) => setTheme({ ornament: e.target.value })} />
        </div>
        <label className="lbl">Banner across the top of every page</label>
        <div className="row gap wrap">
          <ImagePick className="btn small" maxDim={2400} onPick={([src]) => setTheme({ banner: src })}>{t.banner ? 'Change banner' : 'Upload banner'}</ImagePick>
          {t.banner && <button className="btn small ghost" onClick={() => setTheme({ banner: undefined })}>Remove</button>}
        </div>
      </section>

      <section className="card">
        <h2 className="sec-title">Colours{t.alt ? ` · ${t.mood === 'alt' ? t.altName : t.mainName} mood` : ''}</h2>
        {t.alt ? (
          <div className="mood-setup">
            <div className="seg">
              <button className={t.mood !== 'alt' ? 'on' : ''} onClick={() => setTheme({ mood: 'main' })}>☀️ {t.mainName}</button>
              <button className={t.mood === 'alt' ? 'on' : ''} onClick={() => setTheme({ mood: 'alt' })}>🌙 {t.altName}</button>
            </div>
            <input className="input slim" value={t.mainName} onChange={(e) => setTheme({ mainName: e.target.value })} aria-label="First mood name" />
            <input className="input slim" value={t.altName} onChange={(e) => setTheme({ altName: e.target.value })} aria-label="Second mood name" />
            <button className="btn small ghost" onClick={() => confirm('Remove the second mood?') && setTheme({ alt: undefined, mood: 'main' })}>Remove second mood</button>
            <p className="muted small" style={{ width: '100%', margin: 0 }}>The colours below belong to the mood that's showing. Flip moods any time with the button at the top of the page.</p>
          </div>
        ) : (
          <p className="small">
            <button className="btn small" onClick={() => setTheme({ alt: { ...pal }, mood: 'alt', mainName: 'Light', altName: 'Dark' })}>+ Add a second mood</button>{' '}
            <span className="muted">For stories that swing between tones, e.g. whimsical ↔ dark, day ↔ night.</span>
          </p>
        )}
        <div className="color-grid">
          {COLOR_FIELDS.map((f) => (
            <label key={f.key} className="color-field">
              <input type="color" value={pal[f.key]} onChange={(e) => setColor(f.key, e.target.value)} />
              <span>
                {f.label}
                <input className="hex" value={pal[f.key]} onChange={(e) => /^#[0-9a-f]{0,6}$/i.test(e.target.value) && setColor(f.key, e.target.value)} />
              </span>
            </label>
          ))}
        </div>
        <label className="lbl">Colour presets</label>
        <div className="preset-grid">
          {THEME_PRESETS.map((p) => (
            <button
              key={p.name}
              className="preset"
              style={{ ...themeVars(p.theme), background: p.theme.bg, color: p.theme.text }}
              onClick={() => {
                const { bg, surface, text, muted, accent } = p.theme;
                if (t.mood === 'alt' && t.alt) setTheme({ alt: { bg, surface, text, muted, accent } });
                else setTheme({ bg, surface, text, muted, accent, headingFont: p.theme.headingFont, bodyFont: p.theme.bodyFont });
              }}
            >
              <span style={{ fontFamily: fontStack(p.theme.headingFont), fontSize: 18 }}>{p.name}</span>
              <span className="preset-bar" style={{ background: p.theme.accent }} />
            </button>
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

        <h3 className="sub-head" id="pages">Your own pages</h3>
        <p className="muted small">Build extra pages out of the same sections as character cards: charts, facts, text, tags, images, quotes.</p>
        {story.customPages.map((pg, i) => (
          <div key={pg.id} className="tab-row custom-row">
            <input className="emoji-input" value={pg.icon} onChange={(e) => upd((s) => void (s.customPages[i].icon = e.target.value))} aria-label="Icon" />
            <input className="input slim" value={pg.title} onChange={(e) => upd((s) => void (s.customPages[i].title = e.target.value))} />
            <label className="row gap small">
              <input type="checkbox" checked={!pg.hidden} onChange={(e) => upd((s) => void (s.customPages[i].hidden = !e.target.checked))} /> Show
            </label>
            <button className="icon-btn" onClick={() => upd((s) => move(s.customPages, i, i - 1))}>↑</button>
            <button
              className="icon-btn danger"
              title="Delete page"
              onClick={() => confirm(`Delete the page “${pg.title}” and everything on it?`) && upd((s) => void s.customPages.splice(i, 1))}
            >
              🗑
            </button>
          </div>
        ))}
        <div className="template-grid">
          {PAGE_TEMPLATES.map((tp) => (
            <button
              key={tp.id}
              className="template-opt"
              onClick={() => {
                const pg = makePage(tp.id);
                upd((s) => void s.customPages.push(pg));
                nav(`${pathFor(story)}/p/${pg.id}`);
              }}
            >
              <span className="template-icon">{tp.icon}</span>
              <b>+ {tp.name}</b>
              <span className="muted small">{tp.blurb}</span>
            </button>
          ))}
        </div>
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

/** A tiny live sample of a style pack: its colours, fonts, card shape and texture. */
export function PackPreview({ theme }: { theme: Theme }) {
  const p = theme;
  return (
    <span className="pack-preview story-root" data-card={theme.card} data-texture={theme.texture} data-heading={theme.headingCase} style={{ ...themeVars({ ...theme, mood: 'main' }), background: p.bg, color: p.text }}>
      {theme.texture !== 'none' && <span className="story-texture" />}
      <span className="card">
        <span className="pp-title" style={{ fontFamily: fontStack(theme.headingFont) }}>Chapter One</span>
        <span className="pp-body" style={{ fontFamily: fontStack(theme.bodyFont) }}>Once upon a time…</span>
        <span className="pp-bar" style={{ background: p.accent }} />
      </span>
      {theme.alt && <span className="pp-mood" style={{ background: theme.alt.bg, borderColor: theme.alt.accent }} title="Has a second mood" />}
    </span>
  );
}
