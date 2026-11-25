import { imageFileToDataUrl } from './util';

/** What was dropped, read immediately (the browser forgets it once the drop event ends). */
export interface Dropped {
  files: File[];
  urls: string[];
}

export function readDrop(dt: DataTransfer | null): Dropped {
  if (!dt) return { files: [], urls: [] };
  const files = Array.from(dt.files ?? []).filter((f) => f.type.startsWith('image/'));
  if (files.length) return { files, urls: [] };
  const urls = new Set<string>();
  // a picture dragged from another web page usually comes with its address and some HTML
  const html = dt.getData('text/html');
  if (html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('img[src]').forEach((img) => urls.add((img as HTMLImageElement).getAttribute('src')!));
  }
  if (!urls.size) {
    const list = dt.getData('text/uri-list') || dt.getData('text/plain');
    list
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#') && /^(https?:|data:image\/)/i.test(l))
      .forEach((l) => urls.add(l));
  }
  return { files: [], urls: [...urls] };
}

export const hasDroppable = (dt: DataTransfer | null) =>
  !!dt && Array.from(dt.types).some((t) => t === 'Files' || t === 'text/uri-list' || t === 'text/html');

/**
 * Turns dropped files / web pictures into stored pictures. Pictures from websites
 * are copied when the site allows it; otherwise you're offered a link instead.
 */
export async function dropToImages(d: Dropped, maxDim?: number): Promise<string[]> {
  const out: string[] = [];
  for (const f of d.files) out.push(await imageFileToDataUrl(f, maxDim));
  const failed: string[] = [];
  for (const url of d.urls) {
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      if (!blob.type.startsWith('image/')) throw new Error('not an image');
      out.push(await imageFileToDataUrl(new File([blob], 'web-image', { type: blob.type }), maxDim));
    } catch {
      failed.push(url);
    }
  }
  if (failed.length) {
    const n = failed.length;
    const ok = confirm(
      `${n === 1 ? "That website doesn't" : `${n} of those pictures come from websites that don't`} let other sites copy ${n === 1 ? 'its pictures' : 'them'}.\n\n` +
        `OK = use a link to the picture instead (it may disappear if the website removes it)\n` +
        `Cancel = skip. You can save it to your computer and drag that in instead.`,
    );
    if (ok) out.push(...failed.filter((u) => /^https?:/i.test(u)));
  }
  return out;
}
