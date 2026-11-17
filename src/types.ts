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

export type SectionKind = 'facts' | 'text' | 'stats' | 'tags' | 'images' | 'quotes';

export interface Quote {
  id: string;
  text: string;
  /** who they said it to / when */
  context: string;
}

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
  quotes?: Quote[];
  /** speech patterns, accent, verbal tics (quotes sections) */
  voice?: string;
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
  /** Different looks / points in time: "Age 12", "After the time-skip", "Ball gown"… */
  eras?: Era[];
}

export interface Era {
  id: string;
  name: string;
  image?: string;
  description: string;
}

/** Where a character starts and ends in one story. */
export interface CharArc {
  start: string;
  change: string;
  end: string;
}

/** How a relationship type places people in the family tree. "A → B: Parent" means B is A's parent. */
export type FamilyRole = 'parent' | 'child' | 'sibling' | 'spouse' | 'adoptive-parent' | 'adoptive-child';

export interface RelType {
  id: string;
  label: string;
  emoji: string;
  color: string;
  family?: FamilyRole;
}

/** A point in the story's timeline that relationships can change at. */
export interface Moment {
  id: string;
  label: string;
}

/** An intensity meter shown on relationships (trust, affection…). */
export interface MeterDef {
  id: string;
  label: string;
  color: string;
}

/** How `from` sees `to` at one moment. Moments without a state inherit the previous one. */
export interface RelState {
  typeIds: string[];
  feeling: string;
  values: Record<string, number>;
}

/** Directional: how `from` sees / feels about `to`, possibly changing over the story. */
export interface Relationship {
  id: string;
  from: string;
  to: string;
  notes: string;
  states: Record<string, RelState>;
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

export type StoryStatus = 'idea' | 'planning' | 'drafting' | 'editing' | 'finished' | 'on-hold';

/**
 * A story — or a universe. Universes use the same shape so they get the same
 * pages (characters, world, songs…); their characters can be shared into any
 * story that belongs to the universe.
 */
export interface Story {
  id: string;
  kind: 'story' | 'universe';
  status: StoryStatus;
  /** The universe / series this story belongs to. */
  universeId?: string;
  /** Position within its universe (book 1, 2, 3…). */
  seriesOrder: number;
  /** Universe characters that appear in this story (edited in one place, shown everywhere). */
  sharedCharacterIds: string[];
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
  moments: Moment[];
  relMeters: MeterDef[];
  /** character id → their arc in this story */
  characterArcs: Record<string, CharArc>;
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
  universes: Story[];
  /** When siteTitle (and future library settings) last changed — used by sync. */
  metaUpdatedAt: number;
  /** Deleted story id → when it was deleted, so deletions sync to other devices. */
  tombstones: Record<string, number>;
}
