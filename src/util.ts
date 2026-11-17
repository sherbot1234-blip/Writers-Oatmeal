export const uid = () =>
  Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

function readAsDataURL(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

/** Reads an image file and scales it down so stored data stays small. */
export async function imageFileToDataUrl(file: File, maxDim = 1600): Promise<string> {
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') return readAsDataURL(file);
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
    const webp = canvas.toDataURL('image/webp', 0.85);
    // Some browsers can't encode webp and silently return png; fall back to jpeg for photos.
    if (webp.startsWith('data:image/webp')) return webp;
    return file.type === 'image/png' ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export interface SpotifyRef {
  type: string;
  id: string;
  embed: string;
}

/** Accepts open.spotify.com links (any locale) or spotify:type:id URIs. */
export function parseSpotify(input: string): SpotifyRef | null {
  if (!input) return null;
  const s = input.trim();
  let m = s.match(/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(?:embed\/)?(track|album|playlist|artist|episode|show)\/([A-Za-z0-9]+)/);
  if (!m) m = s.match(/^spotify:(track|album|playlist|artist|episode|show):([A-Za-z0-9]+)/);
  if (!m) return null;
  return { type: m[1], id: m[2], embed: `https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator` };
}

export interface MediaRef {
  service: 'spotify' | 'youtube';
  embed: string;
  /** compact = a single track bar; otherwise a taller player */
  compact: boolean;
}

/** Spotify or YouTube link → embeddable player URL. */
export function parseMedia(input: string): MediaRef | null {
  const sp = parseSpotify(input);
  if (sp) return { service: 'spotify', embed: sp.embed, compact: sp.type === 'track' || sp.type === 'episode' };
  const s = (input || '').trim();
  const list = s.match(/[?&]list=([A-Za-z0-9_-]+)/);
  const vid = s.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/|music\.youtube\.com\/watch\?(?:.*&)?v=)([A-Za-z0-9_-]{11})/);
  if (vid) return { service: 'youtube', embed: `https://www.youtube-nocookie.com/embed/${vid[1]}${list ? '?list=' + list[1] : ''}`, compact: false };
  if (list && /youtube\.com/.test(s)) return { service: 'youtube', embed: `https://www.youtube-nocookie.com/embed/videoseries?list=${list[1]}`, compact: false };
  return null;
}

export function move<T>(arr: T[], from: number, to: number) {
  if (to < 0 || to >= arr.length) return;
  const [item] = arr.splice(from, 1);
  arr.splice(to, 0, item);
}

export function download(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function pickJsonFile(): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      try {
        resolve(JSON.parse(await f.text()));
      } catch (e) {
        reject(e);
      }
    };
    input.click();
  });
}

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'story';

const loadedFonts = new Set<string>(['Inter', 'Lora', 'Fredoka']);
/** Lazily loads Google Fonts by family name. */
export function ensureFonts(families: string[]) {
  const missing = families.filter((f) => f && !loadedFonts.has(f) && !SYSTEM_FONTS.includes(f));
  if (!missing.length) return;
  missing.forEach((f) => loadedFonts.add(f));
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href =
    'https://fonts.googleapis.com/css2?' +
    missing.map((f) => 'family=' + encodeURIComponent(f).replace(/%20/g, '+')).join('&') +
    '&display=swap';
  document.head.appendChild(link);
}

export const SYSTEM_FONTS = ['system-ui', 'Georgia', 'Times New Roman', 'Courier New'];

export const FONT_OPTIONS = [
  ...SYSTEM_FONTS,
  'Inter', 'Lora', 'Nunito', 'Quicksand', 'Josefin Sans', 'Space Grotesk', 'Merriweather',
  'Libre Baskerville', 'EB Garamond', 'Cormorant Garamond', 'Crimson Pro', 'Playfair Display',
  'Cinzel', 'IM Fell English', 'Uncial Antiqua', 'Pirata One', 'Special Elite', 'Courier Prime',
  'Orbitron', 'Press Start 2P', 'Bebas Neue', 'Creepster', 'Caveat', 'Dancing Script',
  'Fredoka', 'Bangers', 'Comic Neue', 'Patrick Hand', 'Kalam', 'Righteous',
];

export const fontStack = (f: string) =>
  SYSTEM_FONTS.includes(f) ? `${f === 'system-ui' ? 'system-ui' : `"${f}"`}, sans-serif` : `"${f}", system-ui, sans-serif`;

export const SWATCHES = [
  '#e76f51', '#f4a261', '#e9c46a', '#2a9d8f', '#264653', '#8ab17d', '#d0567a', '#9b5de5',
  '#3a86ff', '#00bbf9', '#ff006e', '#6d597a', '#b5651d', '#7f8c8d', '#c1121f', '#1f8a9e',
];
