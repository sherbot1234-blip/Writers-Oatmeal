/**
 * How a picture sits in its frame. It never changes the picture itself.
 * x / y: which point of the picture is centred (0–1); zoom ≥ 1;
 * fit: fill the frame (cropping edges) or show the whole picture.
 */
export interface Frame {
  x: number;
  y: number;
  zoom: number;
  fit: 'cover' | 'contain';
}

export type CardStyle = 'soft' | 'flat' | 'outlined' | 'paper' | 'pixel' | 'folder' | 'glass' | 'comic';
export type Texture = 'none' | 'paper' | 'noise' | 'lined' | 'grid' | 'scanlines' | 'dots' | 'stars';
export type HeadingCase = 'normal' | 'upper' | 'small-caps';

export interface Palette {
  bg: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
}

export interface Theme {
  /** the style pack this look started from */
  pack?: string;
  card: CardStyle;
  texture: Texture;
  /** little decoration under page titles, e.g. ❦ or ▸▸▸ */
  ornament: string;
  headingCase: HeadingCase;
  /** wide image across the top of every page */
  banner?: string;
  bannerFrame?: Frame;
  /** an optional second colour scheme the story can flip to (e.g. whimsical ↔ dark) */
  alt?: Palette;
  mood: 'main' | 'alt';
  mainName: string;
  altName: string;
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

/** A page you design yourself out of sections (Magic system, Case board, Levels…). */
export interface CustomPage {
  id: string;
  title: string;
  icon: string;
  hidden: boolean;
  sections: Section[];
}

export type TabKey = 'overview' | 'songs' | 'characters' | 'relationships' | 'trees' | 'plot' | 'chapters' | 'world';

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
  /** framing for each picture in `images`, same order */
  imageFrames?: (Frame | null)[];
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
  imageFrame?: Frame;
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
  frame?: Frame;
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
  /** One record covers both people (A ↔ B). When false, it's only how `from` sees `to`. */
  mutual?: boolean;
}

/** A group of characters within a story: Humans, Dragons, The Ancients… */
export interface CharCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export type LineStyle = 'solid' | 'dashed' | 'dotted' | 'double';

/** A kind of line in a hand-made family tree. */
export interface TreeLineType {
  id: string;
  label: string;
  color: string;
  style: LineStyle;
  /** 'down' lines run from an older generation to a younger one with a family-tree elbow */
  shape: 'down' | 'straight';
}

export interface TreeNode {
  id: string;
  /** a character from the story… */
  charId?: string;
  /** …or just a name */
  name?: string;
  note: string;
  x: number;
  y: number;
}

export interface TreeLink {
  id: string;
  from: string;
  to: string;
  typeId: string;
  label: string;
}

export interface FamilyTree {
  id: string;
  name: string;
  nodes: TreeNode[];
  links: TreeLink[];
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
  frame?: Frame;
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
  imageFrame?: Frame;
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
  coverFrame?: Frame;
  theme: Theme;
  tabs: TabConfig[];
  customPages: CustomPage[];
  playlistUrl: string;
  links: LinkItem[];
  songs: Song[];
  characters: Character[];
  characterTemplate: Section[];
  relTypes: RelType[];
  relationships: Relationship[];
  charCategories: CharCategory[];
  /** characters who get their own relationship chart, in order */
  relPovs: string[];
  /** POV character id → where people sit on their chart */
  relCharts: Record<string, ChartSpot[]>;
  /** character id → category ids (kept on the story so shared universe characters can be grouped differently per book) */
  charCategoryMap: Record<string, string[]>;
  trees: FamilyTree[];
  treeLineTypes: TreeLineType[];
  /** the story's main Milanote board */
  milanoteUrl: string;
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
  /** Recently deleted things, kept 30 days so they can be restored. */
  trash: TrashItem[];
  /** when this copy was written to the browser's storage (to spot newer saves from other tabs) */
  savedAt?: number;
  /** When siteTitle (and future library settings) last changed — used by sync. */
  metaUpdatedAt: number;
  /** Deleted story id → when it was deleted, so deletions sync to other devices. */
  tombstones: Record<string, number>;
}

export type TrashKind = 'story' | 'universe' | 'character' | 'chapter' | 'item' | 'version';

/** Something deleted (or an older version replaced during sync), kept for 30 days. */
export interface TrashItem {
  id: string;
  kind: TrashKind;
  /** its name, e.g. "Ava" */
  title: string;
  /** what sort of thing it is, e.g. "Character", "Plot point" */
  what: string;
  storyId?: string;
  storyTitle?: string;
  deletedAt: number;
  updatedAt: number;
  /** everything needed to put it back */
  payload: any;
}

/** Where a person sits on one POV character's relationship chart. */
export interface ChartSpot {
  charId: string;
  x: number;
  y: number;
}
