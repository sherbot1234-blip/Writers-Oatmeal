import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { LibraryProvider } from './store';
import LibraryPage from './pages/Library';
import StoryLayout from './pages/StoryLayout';
import Overview from './pages/Overview';
import Songs from './pages/Songs';
import Characters from './pages/Characters';
import CharacterDetail from './pages/CharacterDetail';
import Relationships from './pages/Relationships';
import Plot from './pages/Plot';
import World from './pages/World';
import Settings from './pages/Settings';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LibraryProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<LibraryPage />} />
          <Route path="/story/:storyId" element={<StoryLayout />}>
            <Route index element={<Overview />} />
            <Route path="songs" element={<Songs />} />
            <Route path="characters" element={<Characters />} />
            <Route path="characters/:charId" element={<CharacterDetail />} />
            <Route path="relationships" element={<Relationships />} />
            <Route path="plot" element={<Plot />} />
            <Route path="world" element={<World />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<LibraryPage />} />
        </Routes>
      </HashRouter>
    </LibraryProvider>
  </React.StrictMode>,
);
