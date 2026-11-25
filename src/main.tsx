import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { LibraryProvider } from './store';
import { CloudProvider } from './sync/Cloud';
import LibraryPage from './pages/Library';
import StoryLayout from './pages/StoryLayout';
import Overview from './pages/Overview';
import Songs from './pages/Songs';
import Characters from './pages/Characters';
import CharacterDetail from './pages/CharacterDetail';
import Relationships from './pages/Relationships';
import Plot from './pages/Plot';
import World from './pages/World';
import Chapters from './pages/Chapters';
import FamilyTrees from './pages/FamilyTrees';
import CustomPageView from './pages/CustomPageView';
// the editor is big, so it only loads when you open a chapter
const ChapterEditor = lazy(() => import('./pages/ChapterEditor'));
const editorPage = (
  <Suspense fallback={<p className="muted">Opening chapter…</p>}>
    <ChapterEditor />
  </Suspense>
);
import Settings from './pages/Settings';
import './styles.css';
import { completeLoginIfReturning } from './spotify';

// A picture dropped just outside a drop area would make the browser open it and leave the site.
window.addEventListener('dragover', (e) => {
  if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
});
window.addEventListener('drop', (e) => {
  if (e.dataTransfer?.types.includes('Files') && !e.defaultPrevented) e.preventDefault();
});

// finish a Spotify sign-in first if we've just come back from it, then start the app
completeLoginIfReturning().finally(() =>
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LibraryProvider>
      <CloudProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<LibraryPage />} />
          <Route path="/story/:storyId" element={<StoryLayout />}>
            <Route index element={<Overview />} />
            <Route path="songs" element={<Songs />} />
            <Route path="characters" element={<Characters />} />
            <Route path="characters/:charId" element={<CharacterDetail />} />
            <Route path="relationships" element={<Relationships />} />
            <Route path="trees" element={<FamilyTrees />} />
            <Route path="plot" element={<Plot />} />
            <Route path="world" element={<World />} />
            <Route path="chapters" element={<Chapters />} />
            <Route path="chapters/:chapterId" element={editorPage} />
            <Route path="settings" element={<Settings />} />
            <Route path="p/:pageId" element={<CustomPageView />} />
          </Route>
          <Route path="/universe/:storyId" element={<StoryLayout />}>
            <Route index element={<Overview />} />
            <Route path="songs" element={<Songs />} />
            <Route path="characters" element={<Characters />} />
            <Route path="characters/:charId" element={<CharacterDetail />} />
            <Route path="relationships" element={<Relationships />} />
            <Route path="trees" element={<FamilyTrees />} />
            <Route path="plot" element={<Plot />} />
            <Route path="world" element={<World />} />
            <Route path="chapters" element={<Chapters />} />
            <Route path="chapters/:chapterId" element={editorPage} />
            <Route path="settings" element={<Settings />} />
            <Route path="p/:pageId" element={<CustomPageView />} />
          </Route>
          <Route path="*" element={<LibraryPage />} />
        </Routes>
      </HashRouter>
      </CloudProvider>
    </LibraryProvider>
  </React.StrictMode>,
  ),
);
