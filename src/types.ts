export interface Theme {
  bg: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  headingFont: string;
  bodyFont: string;
  radius: number;
  bgImage?: string;
  /** 0–100: how strongly the background colour covers the background image */
  bgOverlay: number;
}

export type TabKey = 'overview' | 'songs' | 'characters' | 'relationships' | 'plot' | 'world';

export interface TabConfig {
  key: TabKey;
  label: string;
  hidden: boolean;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  url: string;
  note: string;
  characterIds: string[];
}

export type SectionKind = 'facts' | 'text' | 'stats' | 'tags' | 'images';

export interface Fact {
  id: string;
  label: string;
  value: string;
}

export interface Stat {
  id: string;
  label: string;
  value: number; // 0–10
}

export interface Section {
  id: string;
  title: string;
  kind: SectionKind;
  width: 'half' | 'full';
  text?: string;
  facts?: Fact[];
  stats?: Stat[];
  statsView?: 'radar' | 'bars';
  tags?: string[];
  images?: string[];
}

export interface LinkItem {
  id: string;
  label: string;
  url: string;
}

export interface Character {
  id: string;
  name: string;
  role: string;
  image?: string;
  color: string;
  sections: Section[];
  links?: LinkItem[];
}

export interface RelType {
  id: string;
  label: string;
  emoji: string;
  color: string;
}

/** Directional: how `from` sees / feels about `to`. */
export interface Relationship {
  id: string;
  from: string;
  to: string;
  typeId: string;
  feeling: string;
  notes: string;
}

export type PlotStatus = 'idea' | 'planned' | 'written';

export interface PlotPoint {
  id: string;
  title: string;
  description: string;
  chapter: string;
  status: PlotStatus;
  characterIds: string[];
}

export interface Arc {
  id: string;
  title: string;
  description: string;
  color: string;
  points: PlotPoint[];
}

export interface WorldImage {
  id: string;
  title: string;
  caption: string;
  src: string;
}

export interface Question {
  id: string;
  category: string;
  question: string;
  answer: string;
}

export interface Story {
  id: string;
  title: string;
  tagline: string;
  synopsis: string;
  genres: string[];
  cover?: string;
  theme: Theme;
  tabs: TabConfig[];
  playlistUrl: string;
  links: LinkItem[];
  songs: Song[];
  characters: Character[];
  characterTemplate: Section[];
  relTypes: RelType[];
  relationships: Relationship[];
  arcs: Arc[];
  worldImages: WorldImage[];
  questions: Question[];
  createdAt: number;
  updatedAt: number;
}

export interface Library {
  version: 1;
  siteTitle: string;
  stories: Story[];
  /** When siteTitle (and future library settings) last changed — used by sync. */
  metaUpdatedAt: number;
  /** Deleted story id → when it was deleted, so deletions sync to other devices. */
  tombstones: Record<string, number>;
}
