import { useEffect } from 'react';
import { Link, NavLink, Outlet, useParams } from 'react-router-dom';
import { useLibrary, useStory } from '../store';
import { ensureFonts } from '../util';
import { SaveBadge, themeVars } from './Library';
import type { TabKey } from '../types';
import type { StoryCtx } from '../storyContext';
import { CloudButton } from '../sync/Cloud';

const TAB_ICONS: Record<TabKey, string> = {
  overview: '📖',
  characters: '👤',
  relationships: '💞',
  plot: '🧵',
  world: '🗺️',
  songs: '🎵',
};

export default function StoryLayout() {
  const { storyId } = useParams();
  const [story, upd] = useStory(storyId);
  const { saveState } = useLibrary();

  useEffect(() => {
    if (!story) return;
    ensureFonts([story.theme.headingFont, story.theme.bodyFont]);
    document.body.style.background = story.theme.bg;
    document.title = story.title || 'Untitled Story';
  }, [story?.theme.headingFont, story?.theme.bodyFont, story?.theme.bg, story?.title]);

  if (!story)
    return (
      <div className="library">
        <h2>Story not found</h2>
        <Link to="/" className="btn">← Back to library</Link>
      </div>
    );

  const t = story.theme;
  const ctx: StoryCtx = { story, upd };
  return (
    <div className="story-root" style={{ ...themeVars(t), background: t.bg, color: t.text }}>
      {t.bgImage && (
        <div className="story-bg" style={{ backgroundImage: `url(${t.bgImage})` }}>
          <div style={{ background: t.bg, opacity: t.bgOverlay / 100 }} />
        </div>
      )}
      <header className="story-head">
        <Link to="/" className="back" title="All stories">← Library</Link>
        <Link to={`/story/${story.id}`} className="story-name">{story.title || 'Untitled'}</Link>
        <span className="muted small save"><SaveBadge state={saveState} /></span>
        <CloudButton />
      </header>
      <nav className="tabs">
        {story.tabs
          .filter((tab) => !tab.hidden)
          .map((tab) => (
            <NavLink key={tab.key} to={tab.key === 'overview' ? `/story/${story.id}` : `/story/${story.id}/${tab.key}`} end={tab.key === 'overview'} className="tab">
              <span aria-hidden>{TAB_ICONS[tab.key]}</span> {tab.label}
            </NavLink>
          ))}
        <NavLink to={`/story/${story.id}/settings`} className="tab tab-settings">
          🎨 <span className="tab-settings-label">Customise</span>
        </NavLink>
      </nav>
      <main className="story-main">
        <Outlet context={ctx} />
      </main>
    </div>
  );
}
