import type { Arc, Chapter, ChapterStatus, FamilyRole, Structure, Library, MeterDef, Moment, StoryStatus, Question, RelType, Section, SectionKind, Story, TabConfig, Theme } from './types';
import { uid } from './util';

export const THEME_PRESETS: { name: string; theme: Theme }[] = [
  { name: 'Parchment', theme: { bg: '#f4ecd8', surface: '#fbf6e9', text: '#3b2f22', muted: '#8a7558', accent: '#8b3a1a', headingFont: 'IM Fell English', bodyFont: 'EB Garamond', radius: 6, bgOverlay: 85 } },
  { name: 'Midnight', theme: { bg: '#0f1222', surface: '#181c33', text: '#e6e8f5', muted: '#8c91b5', accent: '#8fa8ff', headingFont: 'Cinzel', bodyFont: 'Inter', radius: 12, bgOverlay: 80 } },
  { name: 'Neon City', theme: { bg: '#0b0b10', surface: '#15151f', text: '#f0f0ff', muted: '#8a8aa8', accent: '#ff2e88', headingFont: 'Orbitron', bodyFont: 'Space Grotesk', radius: 2, bgOverlay: 80 } },
  { name: 'Enchanted Forest', theme: { bg: '#1b2a1f', surface: '#233628', text: '#e7efe0', muted: '#9db39a', accent: '#c9a74a', headingFont: 'Uncial Antiqua', bodyFont: 'Lora', radius: 14, bgOverlay: 80 } },
  { name: 'Rose Garden', theme: { bg: '#fdf0f2', surface: '#ffffff', text: '#4a2a33', muted: '#a07583', accent: '#d0567a', headingFont: 'Dancing Script', bodyFont: 'Quicksand', radius: 20, bgOverlay: 85 } },
  { name: 'Ocean', theme: { bg: '#e8f3f6', surface: '#ffffff', text: '#13323d', muted: '#5c7f8a', accent: '#1f8a9e', headingFont: 'Josefin Sans', bodyFont: 'Nunito', radius: 14, bgOverlay: 85 } },
  { name: 'Noir', theme: { bg: '#e9e7e3', surface: '#f7f6f3', text: '#111111', muted: '#666666', accent: '#9b1c1c', headingFont: 'Special Elite', bodyFont: 'Courier Prime', radius: 0, bgOverlay: 85 } },
  { name: 'Horror', theme: { bg: '#120a0a', surface: '#1d1111', text: '#eadede', muted: '#9a7f7f', accent: '#c1121f', headingFont: 'Creepster', bodyFont: 'Crimson Pro', radius: 4, bgOverlay: 80 } },
  { name: 'Pirate', theme: { bg: '#2b2118', surface: '#3a2d21', text: '#f3e6cf', muted: '#bfa27a', accent: '#e0a83a', headingFont: 'Pirata One', bodyFont: 'Libre Baskerville', radius: 6, bgOverlay: 80 } },
  { name: 'Pixel', theme: { bg: '#1d1f3a', surface: '#2a2d55', text: '#f2f2ff', muted: '#a0a3d0', accent: '#ffcc00', headingFont: 'Press Start 2P', bodyFont: 'Nunito', radius: 0, bgOverlay: 80 } },
  { name: 'Minimal', theme: { bg: '#fafafa', surface: '#ffffff', text: '#1a1a1a', muted: '#777777', accent: '#3b5bdb', headingFont: 'Inter', bodyFont: 'Inter', radius: 10, bgOverlay: 85 } },
];

export const DEFAULT_TABS: TabConfig[] = [
  { key: 'overview', label: 'Overview', hidden: false },
  { key: 'characters', label: 'Characters', hidden: false },
  { key: 'relationships', label: 'Relationships', hidden: false },
  { key: 'plot', label: 'Plot', hidden: false },
  { key: 'chapters', label: 'Chapters', hidden: false },
  { key: 'world', label: 'World', hidden: false },
  { key: 'songs', label: 'Songs', hidden: false },
];

export const REL_PRESETS: Omit<RelType, 'id'>[] = [
  { label: 'Lover', emoji: '❤️', color: '#e63946' },
  { label: 'Crush', emoji: '💘', color: '#ff6fa5' },
  { label: 'Spouse', emoji: '💍', color: '#c9184a', family: 'spouse' },
  { label: 'Ex', emoji: '💔', color: '#9d4edd' },
  { label: 'Best friend', emoji: '🤞', color: '#f4a261' },
  { label: 'Friend', emoji: '🤝', color: '#2a9d8f' },
  { label: 'Family', emoji: '🏠', color: '#e9c46a' },
  { label: 'Sibling', emoji: '👫', color: '#ddb34c', family: 'sibling' },
  { label: 'Parent', emoji: '🧓', color: '#b08968', family: 'parent' },
  { label: 'Child', emoji: '🧒', color: '#c8a27a', family: 'child' },
  { label: 'Adoptive parent', emoji: '🫶', color: '#a47148', family: 'adoptive-parent' },
  { label: 'Adopted child', emoji: '🌱', color: '#bc8a5f', family: 'adoptive-child' },
  { label: 'Aunt / Uncle', emoji: '🧑‍🦳', color: '#c2a878' },
  { label: 'Cousin', emoji: '🧑‍🤝‍🧑', color: '#d4b483' },
  { label: 'Dragon bond', emoji: '🐉', color: '#2d6a4f' },
  { label: 'Suspect', emoji: '🔎', color: '#6d597a' },
  { label: 'Mentor', emoji: '🧭', color: '#3a86ff' },
  { label: 'Student', emoji: '📖', color: '#5fa8ff' },
  { label: 'Colleague', emoji: '💼', color: '#6c757d' },
  { label: 'Ally', emoji: '🛡️', color: '#43aa8b' },
  { label: 'Rival', emoji: '⚔️', color: '#f77f00' },
  { label: 'Enemy', emoji: '☠️', color: '#9b2226' },
  { label: 'Complicated', emoji: '🌀', color: '#7b2cbf' },
  { label: 'Acquaintance', emoji: '👋', color: '#94a3b8' },
  { label: "Doesn't know", emoji: '❔', color: '#adb5bd' },
];

const DEFAULT_REL_LABELS = ['Lover', 'Crush', 'Friend', 'Family', 'Parent', 'Child', 'Sibling', 'Spouse', 'Mentor', 'Rival', 'Enemy', 'Complicated', 'Acquaintance', "Doesn't know"];

export const defaultRelTypes = (): RelType[] =>
  REL_PRESETS.filter((p) => DEFAULT_REL_LABELS.includes(p.label)).map((p) => ({ ...p, id: uid() }));

export const SECTION_KINDS: { kind: SectionKind; label: string; hint: string }[] = [
  { kind: 'facts', label: 'Overview chart', hint: 'Label / value rows — age, height, job…' },
  { kind: 'stats', label: 'Stat chart', hint: 'Rate traits 0–10, shown as a radar or bars' },
  { kind: 'text', label: 'Text', hint: 'Free writing — backstory, notes…' },
  { kind: 'tags', label: 'Tags', hint: 'Short chips — traits, likes, dislikes' },
  { kind: 'images', label: 'Images', hint: 'Reference pictures, outfits, moodboard' },
  { kind: 'quotes', label: 'Quotes & voice', hint: 'Signature lines and how they talk' },
];

export function makeSection(kind: SectionKind, title?: string): Section {
  const base: Section = { id: uid(), kind, title: title ?? SECTION_KINDS.find((k) => k.kind === kind)!.label, width: 'half' };
  if (kind === 'facts') base.facts = [{ id: uid(), label: '', value: '' }];
  if (kind === 'stats') {
    base.stats = [];
    base.statsView = 'radar';
  }
  if (kind === 'text') {
    base.text = '';
    base.width = 'full';
  }
  if (kind === 'tags') base.tags = [];
  if (kind === 'images') {
    base.images = [];
    base.width = 'full';
  }
  if (kind === 'quotes') {
    base.quotes = [];
    base.voice = '';
  }
  return base;
}

const facts = (labels: string[]) => labels.map((label) => ({ id: uid(), label, value: '' }));
const stats = (labels: string[]) => labels.map((label) => ({ id: uid(), label, value: 5 }));

export function defaultCharacterTemplate(): Section[] {
  return [
    { ...makeSection('facts', 'Overview'), facts: facts(['Full name', 'Age', 'Birthday', 'Height', 'Occupation', 'Hometown']) },
    { ...makeSection('stats', 'Personality'), stats: stats(['Courage', 'Kindness', 'Intelligence', 'Humour', 'Temper']) },
    makeSection('tags', 'Traits'),
    { ...makeSection('facts', 'Motivations'), facts: facts(['Goal', 'Fear', 'Secret', 'Flaw']) },
    makeSection('quotes', 'Voice & quotes'),
    makeSection('text', 'Appearance'),
    makeSection('text', 'Backstory'),
  ];
}

/** Copies a template section, giving everything fresh ids and keeping labels but not values. */
export function cloneSectionShape(s: Section): Section {
  return {
    ...s,
    id: uid(),
    text: s.kind === 'text' ? '' : undefined,
    facts: s.facts?.map((f) => ({ id: uid(), label: f.label, value: '' })),
    stats: s.stats?.map((f) => ({ id: uid(), label: f.label, value: 5 })),
    tags: s.kind === 'tags' ? [] : undefined,
    images: s.kind === 'images' ? [] : undefined,
    quotes: s.kind === 'quotes' ? [] : undefined,
    voice: s.kind === 'quotes' ? '' : undefined,
  };
}

export const QUESTION_BANK: Record<string, string[]> = {
  Geography: [
    'What does the land look like — climate, terrain, seasons?',
    'Which places matter most to the story, and why?',
    'How long does it take to travel between key locations?',
    'What natural dangers exist?',
  ],
  'Magic & Technology': [
    'Does magic exist? Where does it come from?',
    'What are the costs or limits of magic / technology?',
    'Who has access to it and who is excluded?',
    'How has it changed everyday life?',
  ],
  Society: [
    'Who holds power, and how did they get it?',
    'What are the social classes or castes?',
    'What is considered rude, taboo, or illegal?',
    'How do people greet each other, celebrate, and mourn?',
  ],
  History: [
    'What major event shaped the world before the story begins?',
    'What do people misremember or lie about in their history?',
    'Which old conflicts are still unresolved?',
  ],
  'Religion & Beliefs': [
    'What do people believe happens after death?',
    'Are the gods real? Do they intervene?',
    'What superstitions are common?',
  ],
  Economy: [
    'What is used as money?',
    'What are the main jobs and industries?',
    'What resource is scarce, and who controls it?',
  ],
  'Daily Life': [
    'What does a typical meal look like?',
    'What do people do for fun?',
    'What do people wear, and what does clothing signal?',
    'How do people communicate over distances?',
  ],
};

export function defaultQuestions(): Question[] {
  return [
    ...QUESTION_BANK.Geography.slice(0, 2).map((q) => ({ id: uid(), category: 'Geography', question: q, answer: '' })),
    ...QUESTION_BANK.Society.slice(0, 2).map((q) => ({ id: uid(), category: 'Society', question: q, answer: '' })),
    ...QUESTION_BANK['Magic & Technology'].slice(0, 2).map((q) => ({ id: uid(), category: 'Magic & Technology', question: q, answer: '' })),
  ];
}

export const defaultMoments = (): Moment[] => ['Beginning', 'Middle', 'End'].map((label) => ({ id: uid(), label }));

export const defaultMeters = (): MeterDef[] => [
  { id: uid(), label: 'Trust', color: '#2a9d8f' },
  { id: uid(), label: 'Affection', color: '#e63946' },
  { id: uid(), label: 'Tension', color: '#f77f00' },
  { id: uid(), label: 'Attraction', color: '#d0567a' },
];

/** Guesses a family-tree role from a type's name, for types made before roles existed. */
export function inferFamily(label: string): FamilyRole | undefined {
  const l = label.toLowerCase();
  if (/adopt.*(parent|mother|father|mum|mom|dad)/.test(l)) return 'adoptive-parent';
  if (/adopt.*(child|son|daughter)/.test(l)) return 'adoptive-child';
  if (/^(parent|mother|father|mum|mom|dad)s?$/.test(l)) return 'parent';
  if (/^(child|son|daughter|kid)s?$/.test(l)) return 'child';
  if (/^(sibling|brother|sister|twin)s?$/.test(l)) return 'sibling';
  if (/^(spouse|husband|wife|married|partner)$/.test(l)) return 'spouse';
  return undefined;
}

export function defaultArcs(): Arc[] {
  return [
    { id: uid(), title: 'Main Arc', description: '', color: '#e76f51', points: [] },
  ];
}

export const STATUSES: { key: StoryStatus; label: string; icon: string; color: string }[] = [
  { key: 'idea', label: 'Idea', icon: '💡', color: '#e9c46a' },
  { key: 'planning', label: 'Planning', icon: '🗺️', color: '#7aa6d8' },
  { key: 'drafting', label: 'Drafting', icon: '✍️', color: '#e76f51' },
  { key: 'editing', label: 'Editing', icon: '🔍', color: '#9b5de5' },
  { key: 'finished', label: 'Finished', icon: '🏁', color: '#2a9d8f' },
  { key: 'on-hold', label: 'On hold', icon: '⏸️', color: '#94a3b8' },
];
export const statusInfo = (s: StoryStatus) => STATUSES.find((x) => x.key === s) ?? STATUSES[1];

export function makeUniverse(name = 'New Universe', theme?: Theme): Story {
  const u = makeStory(name, theme);
  u.kind = 'universe';
  u.tabs = u.tabs.map((t) => ({ ...t, hidden: t.key === 'plot' || t.key === 'chapters', label: t.key === 'characters' ? 'Shared cast' : t.label }));
  u.arcs = [];
  u.questions = [];
  return u;
}

export function makeStory(title = 'Untitled Story', theme?: Theme): Story {
  const now = Date.now();
  return {
    id: uid(),
    kind: 'story',
    status: 'planning',
    seriesOrder: 0,
    sharedCharacterIds: [],
    title,
    tagline: '',
    synopsis: '',
    genres: [],
    theme: theme ? { ...theme } : { ...THEME_PRESETS[0].theme },
    tabs: DEFAULT_TABS.map((t) => ({ ...t })),
    playlistUrl: '',
    links: [],
    songs: [],
    characters: [],
    characterTemplate: defaultCharacterTemplate(),
    relTypes: defaultRelTypes(),
    relationships: [],
    moments: defaultMoments(),
    relMeters: defaultMeters(),
    characterArcs: {},
    arcs: defaultArcs(),
    worldImages: [],
    questions: defaultQuestions(),
    createdAt: now,
    updatedAt: now,
  };
}

/** Fills in anything missing (older exports, hand-edited files). */
export function normalizeStory(raw: Partial<Story>): Story {
  const base = makeStory();
  const s = { ...base, ...raw } as Story;
  s.theme = { ...base.theme, ...(raw.theme ?? {}) };
  const tabs = Array.isArray(raw.tabs) ? raw.tabs : [];
  // keep the user's tab order, slotting any new pages in after the page they normally follow
  s.tabs = tabs.filter((t) => DEFAULT_TABS.some((d) => d.key === t.key)).map((t) => ({ ...t }));
  DEFAULT_TABS.forEach((d, i) => {
    if (s.tabs.some((t) => t.key === d.key)) return;
    const prev = i > 0 ? s.tabs.findIndex((t) => t.key === DEFAULT_TABS[i - 1].key) : -1;
    s.tabs.splice(prev + 1, 0, { ...d });
  });
  if (s.kind !== 'universe') s.kind = 'story';
  if (!STATUSES.some((x) => x.key === s.status)) s.status = 'planning';
  if (typeof s.seriesOrder !== 'number') s.seriesOrder = 0;
  for (const k of ['sharedCharacterIds', 'genres', 'links', 'songs', 'characters', 'relTypes', 'relationships', 'arcs', 'worldImages', 'questions', 'characterTemplate'] as const) {
    if (!Array.isArray(s[k])) (s as any)[k] = (base as any)[k];
  }
  if (!s.id) s.id = uid();
  if (s.kind === 'universe') {
    const ch = s.tabs.find((t) => t.key === 'chapters');
    if (ch && !tabs.some((t) => t.key === 'chapters')) ch.hidden = true;
  }
  if (!Array.isArray(s.moments) || !s.moments.length) s.moments = defaultMoments();
  if (!Array.isArray(s.relMeters)) s.relMeters = defaultMeters();
  if (!s.characterArcs || typeof s.characterArcs !== 'object') s.characterArcs = {};
  s.relTypes = s.relTypes.map((t) => (t.family || !inferFamily(t.label) ? t : { ...t, family: inferFamily(t.label) }));
  // older relationships had a single type and feeling: move them to the first moment
  s.songs = s.songs.map((x) => ({ ...x, characterIds: x.characterIds ?? [], chapterIds: x.chapterIds ?? [], pointIds: x.pointIds ?? [] }));
  s.relationships = s.relationships.map((r: any) => {
    if (r.states && typeof r.states === 'object') return r;
    const { typeId, feeling, ...rest } = r;
    return { ...rest, notes: r.notes ?? '', states: { [s.moments[0].id]: { typeIds: typeId ? [typeId] : [], feeling: feeling ?? '', values: {} } } };
  });
  return s;
}

export function emptyLibrary(): Library {
  return { version: 1, siteTitle: "Writer's Oatmeal", stories: [], universes: [], chapters: [], metaUpdatedAt: 0, tombstones: {} };
}

export function normalizeLibrary(raw: unknown): Library | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<Library>;
  if (!Array.isArray(r.stories)) return null;
  return {
    version: 1,
    siteTitle: r.siteTitle || "Writer's Oatmeal",
    stories: r.stories.map(normalizeStory),
    chapters: Array.isArray(r.chapters) ? r.chapters.map(normalizeChapter) : [],
    universes: Array.isArray(r.universes) ? r.universes.map((u) => ({ ...normalizeStory(u), kind: 'universe' as const })) : [],
    metaUpdatedAt: typeof r.metaUpdatedAt === 'number' ? r.metaUpdatedAt : 0,
    tombstones: r.tombstones && typeof r.tombstones === 'object' ? r.tombstones : {},
  };
}

export const CHAPTER_STATUSES: { key: ChapterStatus; label: string; color: string }[] = [
  { key: 'idea', label: 'Idea', color: '#e9c46a' },
  { key: 'outline', label: 'Outlined', color: '#7aa6d8' },
  { key: 'draft', label: 'Draft', color: '#e76f51' },
  { key: 'revised', label: 'Revised', color: '#9b5de5' },
  { key: 'final', label: 'Final', color: '#2a9d8f' },
];

export function makeChapter(storyId: string, order: number, title = ''): Chapter {
  const now = Date.now();
  return { id: uid(), storyId, title, order, status: 'idea', summary: '', html: '', words: 0, comments: [], createdAt: now, updatedAt: now };
}

export function normalizeChapter(raw: Partial<Chapter>): Chapter {
  const base = makeChapter(raw.storyId ?? '', 0);
  const c = { ...base, ...raw } as Chapter;
  if (!CHAPTER_STATUSES.some((x) => x.key === c.status)) c.status = 'idea';
  if (!Array.isArray(c.comments)) c.comments = [];
  if (typeof c.html !== 'string') c.html = '';
  if (typeof c.order !== 'number') c.order = 0;
  return c;
}

export const countWords = (text: string) => (text.match(/[\p{L}\p{N}’'-]+/gu) ?? []).length;

// ---------------------------------------------------------------- story structures

type BeatSeed = [name: string, pct: number, guide: string];

export const STRUCTURES: { id: string; name: string; blurb: string; beats: BeatSeed[] }[] = [
  {
    id: 'three-act',
    name: 'Three-Act Structure',
    blurb: 'Setup, confrontation, resolution. The classic shape.',
    beats: [
      ['Setup', 0, 'Introduce the hero, their world and what they want.'],
      ['Inciting incident', 10, 'Something disrupts normal life and starts the story.'],
      ['Plot point 1', 25, 'The hero commits; there is no going back. Act 2 begins.'],
      ['Rising action', 35, 'Obstacles escalate; allies and enemies take shape.'],
      ['Midpoint', 50, 'A revelation or reversal changes the game.'],
      ['Plot point 2 / crisis', 75, 'Everything falls apart. Act 3 begins.'],
      ['Climax', 88, 'The final confrontation. The hero acts on what they learned.'],
      ['Resolution', 96, 'The new normal. Loose ends tied.'],
    ],
  },
  {
    id: 'save-the-cat',
    name: 'Save the Cat',
    blurb: "Blake Snyder's 15 beats: very precise and popular for pacing.",
    beats: [
      ['Opening image', 0, 'A snapshot of the hero and their world before the change.'],
      ['Theme stated', 5, 'Someone hints at the lesson the hero needs to learn.'],
      ['Set-up', 6, "Show the hero's flaws, what they want, and what's missing."],
      ['Catalyst', 10, 'The life-changing event.'],
      ['Debate', 12, 'The hero hesitates. Should they go?'],
      ['Break into Two', 20, 'The hero chooses to enter the new world.'],
      ['B Story', 22, 'A new relationship that carries the theme (often love interest or mentor).'],
      ['Fun and games', 30, 'The promise of the premise: what the reader came for.'],
      ['Midpoint', 50, 'False victory or false defeat; the stakes rise.'],
      ['Bad guys close in', 55, 'External pressure and internal doubts tighten.'],
      ['All is lost', 75, 'The lowest point; something or someone is lost.'],
      ['Dark night of the soul', 78, 'The hero wallows, then finds the truth.'],
      ['Break into Three', 80, 'The solution, combining A story and B story.'],
      ['Finale', 85, 'The hero proves they have changed.'],
      ['Final image', 99, 'A mirror of the opening image, showing the change.'],
    ],
  },
  {
    id: 'heros-journey',
    name: "Hero's Journey",
    blurb: '12 stages of a quest: great for fantasy and adventure.',
    beats: [
      ['Ordinary world', 0, 'The hero at home, unaware of what is coming.'],
      ['Call to adventure', 8, 'A challenge or quest appears.'],
      ['Refusal of the call', 12, 'Fear or duty holds them back.'],
      ['Meeting the mentor', 17, 'Guidance, training or a gift.'],
      ['Crossing the threshold', 25, 'Leaving the known world behind.'],
      ['Tests, allies, enemies', 35, 'Learning the rules of the new world.'],
      ['Approach to the inmost cave', 45, 'Preparing for the central ordeal.'],
      ['The ordeal', 50, 'Facing the greatest fear; a death and rebirth.'],
      ['Reward', 60, 'Seizing the sword: the prize, knowledge or reconciliation.'],
      ['The road back', 75, 'Consequences chase the hero home.'],
      ['Resurrection', 90, 'A final test where everything is at stake.'],
      ['Return with the elixir', 97, 'Home again, changed, bringing something back.'],
    ],
  },
  {
    id: 'kishotenketsu',
    name: 'Kishōtenketsu',
    blurb: 'Four acts built on contrast and a twist rather than conflict.',
    beats: [
      ['Ki: introduction', 0, 'Introduce characters and setting.'],
      ['Shō: development', 25, 'Develop them; nothing major changes yet.'],
      ['Ten: twist', 50, 'An unexpected turn that recasts everything.'],
      ['Ketsu: reconciliation', 75, 'Bring the threads together in a new understanding.'],
    ],
  },
];

export function makeStructure(templateId: string): Structure {
  const t = STRUCTURES.find((x) => x.id === templateId);
  if (!t) return { templateId: 'custom', name: 'My structure', beats: [{ id: uid(), name: 'Beginning', guide: '', pct: 0, notes: '', pointIds: [] }] };
  return { templateId: t.id, name: t.name, beats: t.beats.map(([name, pct, guide]) => ({ id: uid(), name, pct, guide, notes: '', pointIds: [] })) };
}
