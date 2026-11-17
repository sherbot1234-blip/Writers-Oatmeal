import type { CustomPage, Section, Theme } from './types';
import { makeSection, THEME_BASE } from './defaults';
import { uid } from './util';

export interface StylePack {
  id: string;
  name: string;
  blurb: string;
  theme: Theme;
}

const pack = (id: string, name: string, blurb: string, t: Partial<Theme> & Pick<Theme, 'bg' | 'surface' | 'text' | 'muted' | 'accent' | 'headingFont' | 'bodyFont'>): StylePack => ({
  id,
  name,
  blurb,
  theme: { ...THEME_BASE, radius: 12, bgOverlay: 80, ...t, pack: id } as Theme,
});

/** Whole looks: colours, fonts, card shapes, textures and ornaments together. */
export const STYLE_PACKS: StylePack[] = [
  pack('game-hud', 'Game HUD', 'Pixel menus and scanlines, with a Whimsy ↔ Dark mood switch. Made for Arcane Legends Eternal.', {
    bg: '#fbf5ff', surface: '#ffffff', text: '#2b2350', muted: '#8a83b5', accent: '#7b5cff',
    alt: { bg: '#100e24', surface: '#1d1a40', text: '#f2efff', muted: '#a09cd0', accent: '#39ff88' },
    mainName: 'Whimsy', altName: 'Dark',
    headingFont: 'Press Start 2P', bodyFont: 'Space Grotesk', card: 'pixel', texture: 'scanlines', ornament: '▸ ▸ ▸', headingCase: 'upper', radius: 0,
  }),
  pack('field-journal', 'Field Journal', 'A naturalist’s sketchbook: taped notes, handwriting and paper. Made for Secret Below.', {
    bg: '#ece2cc', surface: '#fbf6e8', text: '#3a3226', muted: '#86785c', accent: '#2d6a4f',
    headingFont: 'Caveat', bodyFont: 'Lora', card: 'paper', texture: 'paper', ornament: '〰 ❧ 〰', radius: 3,
  }),
  pack('case-file', 'Case File', 'Manila folders, typewriter text and red stamps. Made for Wolf in Sheep Clothing.', {
    bg: '#cfc9bb', surface: '#f2e5c4', text: '#1c1b18', muted: '#6b6455', accent: '#b3261e',
    alt: { bg: '#121212', surface: '#1e1d1b', text: '#ece6d6', muted: '#8f8a7d', accent: '#e0453a' },
    mainName: 'Day', altName: 'Night shift',
    headingFont: 'Special Elite', bodyFont: 'Courier Prime', card: 'folder', texture: 'noise', ornament: '— ✕ —', headingCase: 'upper', radius: 2,
  }),
  pack('parchment-scroll', 'Parchment Scroll', 'Old maps and illuminated borders for classic fantasy.', {
    bg: '#efe1bf', surface: '#f9f0d9', text: '#3b2a17', muted: '#8c7350', accent: '#8b2e16',
    headingFont: 'Cinzel', bodyFont: 'EB Garamond', card: 'outlined', texture: 'paper', ornament: '❦', headingCase: 'small-caps', radius: 4,
  }),
  pack('gothic', 'Gothic', 'Candlelight, crimson and old stone.', {
    bg: '#0c0a0e', surface: '#16121a', text: '#e9e1ec', muted: '#988b9e', accent: '#a3173a',
    headingFont: 'IM Fell English', bodyFont: 'Crimson Pro', card: 'outlined', texture: 'noise', ornament: '✠', headingCase: 'small-caps', radius: 2,
  }),
  pack('cute-pastel', 'Cute Pastel', 'Soft, round and sweet.', {
    bg: '#fff3f8', surface: '#ffffff', text: '#5a3d5c', muted: '#b08bb3', accent: '#ff7eb0',
    headingFont: 'Fredoka', bodyFont: 'Quicksand', card: 'soft', texture: 'dots', ornament: '♡ ✿ ♡', radius: 22,
  }),
  pack('comic', 'Comic Book', 'Bold ink, halftone dots and POW.', {
    bg: '#ffe94d', surface: '#ffffff', text: '#111111', muted: '#4a4a4a', accent: '#e4002b',
    headingFont: 'Bangers', bodyFont: 'Comic Neue', card: 'comic', texture: 'dots', ornament: '★ ★ ★', headingCase: 'upper', radius: 4,
  }),
  pack('starlight', 'Starlight', 'Glass panels over a night sky.', {
    bg: '#0b1026', surface: '#1a2150', text: '#eef0ff', muted: '#9aa3d6', accent: '#ffd36e',
    headingFont: 'Cormorant Garamond', bodyFont: 'Nunito', card: 'glass', texture: 'stars', ornament: '✧', radius: 16,
  }),
  pack('clean', 'Clean', 'Plain and quiet. Let the words do the work.', {
    bg: '#fafafa', surface: '#ffffff', text: '#1a1a1a', muted: '#777777', accent: '#3b5bdb',
    headingFont: 'Inter', bodyFont: 'Inter', card: 'soft', texture: 'none', radius: 10,
  }),
];

export const CARD_STYLES: { key: Theme['card']; label: string }[] = [
  { key: 'soft', label: 'Soft' },
  { key: 'flat', label: 'Flat' },
  { key: 'outlined', label: 'Outlined' },
  { key: 'paper', label: 'Taped paper' },
  { key: 'pixel', label: 'Pixel' },
  { key: 'folder', label: 'Folder' },
  { key: 'glass', label: 'Glass' },
  { key: 'comic', label: 'Comic' },
];

export const TEXTURES: { key: Theme['texture']; label: string }[] = [
  { key: 'none', label: 'None' },
  { key: 'paper', label: 'Paper' },
  { key: 'noise', label: 'Grain' },
  { key: 'lined', label: 'Lined' },
  { key: 'grid', label: 'Grid' },
  { key: 'scanlines', label: 'Scanlines' },
  { key: 'dots', label: 'Dots' },
  { key: 'stars', label: 'Stars' },
];

export const ORNAMENTS = ['', '❦', '✦ ✦ ✦', '〰 ❧ 〰', '▸ ▸ ▸', '— ✕ —', '✠', '♡ ✿ ♡', '★ ★ ★', '✧', '◆◇◆', '⚔', '🐉', '🔎'];

// ---------------------------------------------------------------- custom page templates

const facts = (labels: string[]) => labels.map((label) => ({ id: uid(), label, value: '' }));
const sec = (kind: Section['kind'], title: string, patch: Partial<Section> = {}): Section => ({ ...makeSection(kind, title), ...patch });

export const PAGE_TEMPLATES: { id: string; name: string; icon: string; blurb: string; sections: () => Section[] }[] = [
  { id: 'blank', name: 'Blank page', icon: '📄', blurb: 'Start empty and add sections.', sections: () => [sec('text', 'Notes')] },
  {
    id: 'magic',
    name: 'Magic system',
    icon: '✨',
    blurb: 'Rules, costs, limits and who can use it.',
    sections: () => [
      sec('facts', 'The rules', { facts: facts(['Source', 'How it works', 'Cost', 'Limits', 'Who can use it']) }),
      sec('tags', 'Types / schools'),
      sec('text', 'Spells & techniques'),
      sec('text', 'History & misconceptions'),
    ],
  },
  {
    id: 'factions',
    name: 'Factions & powers',
    icon: '🏰',
    blurb: 'Who wants what, and who stands in their way.',
    sections: () => [
      sec('facts', 'Overview', { facts: facts(['Leader', 'Base', 'Goal', 'Allies', 'Enemies']) }),
      sec('stats', 'Strength', { stats: ['Military', 'Wealth', 'Influence', 'Secrecy'].map((label) => ({ id: uid(), label, value: 5 })) }),
      sec('text', 'History'),
    ],
  },
  {
    id: 'levels',
    name: 'Game levels',
    icon: '🎮',
    blurb: 'Track levels, bosses and rules of a game world (hello, 300 levels).',
    sections: () => [
      sec('facts', 'Game rules', { facts: facts(['Total levels', 'Lives / respawn', 'How to level up', 'Way out']) }),
      sec('facts', 'Levels', { width: 'full', facts: facts(['Level 1', 'Level 2', 'Level 3', 'Level 10 (boss)']) }),
      sec('tags', 'Items & power-ups'),
      sec('images', 'Screenshots & concept art'),
    ],
  },
  {
    id: 'case',
    name: 'Case board',
    icon: '🗂️',
    blurb: 'Suspects, evidence and what the detectives know.',
    sections: () => [
      sec('facts', 'The case', { facts: facts(['Victims', 'Pattern', 'Weapon', 'Lead detective', 'Status']) }),
      sec('tags', 'Suspects'),
      sec('text', 'Evidence log', { width: 'full' }),
      sec('facts', 'Who knows what', { facts: facts(['The police know', 'The friends know', 'The reader knows', 'Only the killer knows']) }),
      sec('images', 'Evidence board'),
    ],
  },
  {
    id: 'bestiary',
    name: 'Bestiary',
    icon: '🐉',
    blurb: 'Creatures, their habits and how to survive them.',
    sections: () => [
      sec('facts', 'Species', { facts: facts(['Size', 'Habitat', 'Diet', 'Temperament', 'Weakness']) }),
      sec('stats', 'Danger', { stats: ['Speed', 'Strength', 'Intelligence', 'Aggression'].map((label) => ({ id: uid(), label, value: 5 })) }),
      sec('images', 'Sketches'),
      sec('text', 'Field notes'),
    ],
  },
  {
    id: 'themes',
    name: 'Themes & symbols',
    icon: '🕯️',
    blurb: 'What the story is really about.',
    sections: () => [sec('tags', 'Themes'), sec('facts', 'Symbols', { facts: facts(['Symbol', 'Symbol', 'Symbol']) }), sec('text', 'What I want readers to feel')],
  },
];

export function makePage(templateId: string, title?: string): CustomPage {
  const t = PAGE_TEMPLATES.find((x) => x.id === templateId) ?? PAGE_TEMPLATES[0];
  return { id: uid(), title: title || t.name, icon: t.icon, hidden: false, sections: t.sections() };
}
