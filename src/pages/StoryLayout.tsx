import { useEffect } from 'react';
import { Link, NavLink, Outlet, useParams } from 'react-router-dom';
import { useLibrary, useStory } from '../store';
import { ensureFonts } from '../util';
import { palette, SaveBadge, themeVars } from './Library';
import type { TabKey } from '../types';
import { pathFor, type StoryCtx } from '../storyContext';
import { CloudButton } from '../sync/Cloud';

const TAB_ICONS: Record<TabKey, string> = {
  overview: '📖',
  characters: '👤',
  relationships: '💞',
  trees: '🌳',
  plot: '🧵',
  chapters: '✍️',
  world: '🗺️',
  songs: '🎵',
};

export default function StoryLayout() {
  const { storyId } = useParams();
  const [story, upd, universe] = useStory(storyId);
  const { saveState } = useLibrary();

  useEffect(() => {
    if (!story) return;
    ensureFonts([story.theme.headingFont, story.theme.bodyFont]);
    document.body.style.background = palette(story.theme).bg;
    document.title = story.title || 'Untitled Story';
  }, [story?.theme, story?.title]);

  if (!story)
    return (
      <div className="library">
        <h2>Story not found</h2>
        <Link to="/" className="btn">← Back to library</Link>
      </div>
    );

  const t = story.theme;
  const p = palette(t);
  const base = pathFor(story);
  const ctx: StoryCtx = { story, upd, universe, base };
  return (
    <div
      className="story-root"
      data-card={t.card}
      data-texture={t.texture}
      data-heading={t.headingCase}
      data-ornament={t.ornament ? 'on' : 'off'}
      style={{ ...themeVars(t), background: p.bg, color: p.text }}
    >
      {t.bgImage && (
        <div className="story-bg" style={{ backgroundImage: `url(${t.bgImage})` }}>
          <div style={{ background: p.bg, opacity: t.bgOverlay / 100 }} />
        </div>
      )}
      {t.texture !== 'none' && <div className="story-texture" aria-hidden />}
      {t.banner && <div className="story-banner" style={{ backgroundImage: `url(${t.banner})` }} aria-hidden />}
      <header className="story-head">
        <Link to="/" className="back" title="All stories">← Library</Link>
        {universe && (
          <Link to={pathFor(universe)} className="crumb-universe" title="Universe">🌌 {universe.title || 'Universe'} ›</Link>
        )}
        <Link to={base} className="story-name">
          {story.kind === 'universe' && <span title="Universe">🌌 </span>}
          {story.title || 'Untitled'}
        </Link>
        <span className="muted small save"><SaveBadge state={saveState} /></span>
        {(story.milanoteUrl || universe?.milanoteUrl) && (
          <a className="mood-btn" href={story.milanoteUrl || universe!.milanoteUrl} target="_blank" rel="noreferrer" title="Open the Milanote board">
            📌 <span className="mood-label">Board</span>
          </a>
        )}
        {t.alt && (
          <button
            className="mood-btn"
            onClick={() => upd((s) => void (s.theme.mood = s.theme.mood === 'alt' ? 'main' : 'alt'))}
            title="Switch the story's mood"
          >
            {t.mood === 'alt' ? '🌙' : '☀️'} <span className="mood-label">{t.mood === 'alt' ? t.altName : t.mainName}</span>
          </button>
        )}
        <CloudButton />
      </header>
      <nav className="tabs">
        {story.tabs
          .filter((tab) => !tab.hidden)
          .map((tab) => (
            <NavLink key={tab.key} to={tab.key === 'overview' ? base : `${base}/${tab.key}`} end={tab.key === 'overview'} className="tab">
              <span aria-hidden>{TAB_ICONS[tab.key]}</span> {tab.label}
            </NavLink>
          ))}
        {story.customPages
          .filter((pg) => !pg.hidden)
          .map((pg) => (
            <NavLink key={pg.id} to={`${base}/p/${pg.id}`} className="tab">
              <span aria-hidden>{pg.icon}</span> {pg.title || 'Untitled page'}
            </NavLink>
          ))}
        <NavLink to={`${base}/settings`} className="tab tab-settings">
          🎨 <span className="tab-settings-label">Customise</span>
        </NavLink>
      </nav>
      <main className="story-main">
        <Outlet context={ctx} />
      </main>
    </div>
  );
}
