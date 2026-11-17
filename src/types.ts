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

export type TabKey = 'overview' | 'songs' | 'characters' | 'relationships' | 'plot' | 'chapters' | 'world';

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
  /** chapters this song belongs to (soundtrack for writing / scenes) */
  chapterIds: string[];
  /** plot points / scenes this song is for */
  pointIds: string[];
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
  /** The chapter where this happens. */
  chapterId?: string;
}

/** A beat in a story-structure template (Save the Cat, Hero's Journey…). */
export interface Beat {
  id: string;
  name: string;
  guide: string;
  /** roughly how far through the story, 0–100 */
  pct: number;
  notes: string;
  pointIds: string[];
}

export interface Structure {
  templateId: string;
  name: string;
  beats: Beat[];
}

export type ChapterStatus = 'idea' | 'outline' | 'draft' | 'revised' | 'final';

export interface ChapterComment {
  id: string;
  text: string;
  /** the passage it was left on */
  quote: string;
  resolved: boolean;
  createdAt: number;
}

/** Chapters are stored apart from their story so typing only syncs the chapter. */
export interface Chapter {
  id: string;
  storyId: string;
  title: string;
  order: number;
  status: ChapterStatus;
  povId?: string;
  summary: string;
  html: string;
  words: number;
  comments: ChapterComment[];
  createdAt: number;
  updatedAt: number;
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
  /** clickable markers on a map, positioned in % of the image */
  pins?: Pin[];
}

export interface Pin {
  id: string;
  x: number;
  y: number;
  label: string;
  note: string;
  /** wiki page this pin points to */
  entryId?: string;
}

/** A wiki page: a place, faction, creature, item, magic system… */
export interface LoreEntry {
  id: string;
  category: string;
  name: string;
  image?: string;
  summary: string;
  body: string;
  facts: Fact[];
  characterIds: string[];
  /** other wiki pages this one is connected to */
  entryIds: string[];
}

export interface WorldEvent {
  id: string;
  /** free text: "Year 312", "Before the Fall", "Season 2, week 4" */
  when: string;
  /** optional number used to sort events */
  year?: number;
  title: string;
  description: string;
  characterIds: string[];
}

export interface GlossaryTerm {
  id: string;
  term: string;
  pronunciation: string;
  category: string;
  definition: string;
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
  structure?: Structure;
  worldImages: WorldImage[];
  questions: Question[];
  lore: LoreEntry[];
  loreCategories: string[];
  events: WorldEvent[];
  glossary: GlossaryTerm[];
  createdAt: number;
  updatedAt: number;
}

export interface Library {
  version: 1;
  siteTitle: string;
  stories: Story[];
  universes: Story[];
  chapters: Chapter[];
  /** When siteTitle (and future library settings) last changed — used by sync. */
  metaUpdatedAt: number;
  /** Deleted story id → when it was deleted, so deletions sync to other devices. */
  tombstones: Record<string, number>;
}
