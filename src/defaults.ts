import type { Arc, Library, Question, RelType, Section, SectionKind, Story, TabConfig, Theme } from './types';
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
  { key: 'world', label: 'World', hidden: false },
  { key: 'songs', label: 'Songs', hidden: false },
];

export const REL_PRESETS: Omit<RelType, 'id'>[] = [
  { label: 'Lover', emoji: '❤️', color: '#e63946' },
  { label: 'Crush', emoji: '💘', color: '#ff6fa5' },
  { label: 'Spouse', emoji: '💍', color: '#c9184a' },
  { label: 'Ex', emoji: '💔', color: '#9d4edd' },
  { label: 'Best friend', emoji: '🤞', color: '#f4a261' },
  { label: 'Friend', emoji: '🤝', color: '#2a9d8f' },
  { label: 'Family', emoji: '🏠', color: '#e9c46a' },
  { label: 'Sibling', emoji: '👫', color: '#ddb34c' },
  { label: 'Parent', emoji: '🧓', color: '#b08968' },
  { label: 'Child', emoji: '🧒', color: '#c8a27a' },
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

const DEFAULT_REL_LABELS = ['Lover', 'Crush', 'Friend', 'Family', 'Mentor', 'Rival', 'Enemy', 'Complicated', 'Acquaintance', "Doesn't know"];

export const defaultRelTypes = (): RelType[] =>
  REL_PRESETS.filter((p) => DEFAULT_REL_LABELS.includes(p.label)).map((p) => ({ ...p, id: uid() }));

export const SECTION_KINDS: { kind: SectionKind; label: string; hint: string }[] = [
  { kind: 'facts', label: 'Overview chart', hint: 'Label / value rows — age, height, job…' },
  { kind: 'stats', label: 'Stat chart', hint: 'Rate traits 0–10, shown as a radar or bars' },
  { kind: 'text', label: 'Text', hint: 'Free writing — backstory, notes…' },
  { kind: 'tags', label: 'Tags', hint: 'Short chips — traits, likes, dislikes' },
  { kind: 'images', label: 'Images', hint: 'Reference pictures, outfits, moodboard' },
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

export function defaultArcs(): Arc[] {
  return [
    { id: uid(), title: 'Main Arc', description: '', color: '#e76f51', points: [] },
  ];
}

export function makeStory(title = 'Untitled Story', theme?: Theme): Story {
  const now = Date.now();
  return {
    id: uid(),
    title,
    tagline: '',
    synopsis: '',
    genres: [],
    theme: theme ? { ...theme } : { ...THEME_PRESETS[0].theme },
    tabs: DEFAULT_TABS.map((t) => ({ ...t })),
    playlistUrl: '',
    songs: [],
    characters: [],
    characterTemplate: defaultCharacterTemplate(),
    relTypes: defaultRelTypes(),
    relationships: [],
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
  s.tabs = [
    ...tabs.filter((t) => DEFAULT_TABS.some((d) => d.key === t.key)),
    ...DEFAULT_TABS.filter((d) => !tabs.some((t) => t.key === d.key)).map((t) => ({ ...t })),
  ];
  for (const k of ['genres', 'songs', 'characters', 'relTypes', 'relationships', 'arcs', 'worldImages', 'questions', 'characterTemplate'] as const) {
    if (!Array.isArray(s[k])) (s as any)[k] = (base as any)[k];
  }
  if (!s.id) s.id = uid();
  return s;
}

export function emptyLibrary(): Library {
  return { version: 1, siteTitle: "Writer's Oatmeal", stories: [] };
}

export function normalizeLibrary(raw: unknown): Library | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<Library>;
  if (!Array.isArray(r.stories)) return null;
  return { version: 1, siteTitle: r.siteTitle || "Writer's Oatmeal", stories: r.stories.map(normalizeStory) };
}
