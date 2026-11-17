import { useCallback, useMemo } from 'react';
import type { Draft } from 'immer';
import { useLibrary } from './store';
import type { Chapter, Story } from './types';
import { slug } from './util';

export function useChapters(storyId: string) {
  const { lib, update } = useLibrary();
  const chapters = useMemo(
    () => lib.chapters.filter((c) => c.storyId === storyId).sort((a, b) => a.order - b.order || a.createdAt - b.createdAt),
    [lib.chapters, storyId],
  );
  const edit = useCallback(
    (id: string, fn: (c: Draft<Chapter>) => void) =>
      update((d) => {
        const c = d.chapters.find((x) => x.id === id);
        if (c) fn(c);
      }),
    [update],
  );
  return { chapters, edit, update };
}

/** Swaps a chapter with its neighbour (and tidies the order numbers). */
export function moveChapter(d: Draft<{ chapters: Chapter[] }>, storyId: string, id: string, dir: -1 | 1) {
  const list = d.chapters.filter((c) => c.storyId === storyId).sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
  const i = list.findIndex((c) => c.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  list.forEach((c, k) => {
    if (c.order !== k + 1) c.order = k + 1;
  });
}

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);

/** A single HTML file of the whole manuscript. Opens in Word, Google Docs, Pages… */
export function downloadManuscript(story: Story, chapters: Chapter[]) {
  const body = chapters
    .map((c, i) => {
      // comment highlights are for you, not the manuscript
      const clean = c.html.replace(/<span[^>]*data-comment[^>]*>(.*?)<\/span>/gs, '$1').replace(/<hr\s*\/?>/g, '<p class="break">* * *</p>');
      return `<section class="chapter"><h2>Chapter ${i + 1}${c.title ? ': ' + esc(c.title) : ''}</h2>${clean}</section>`;
    })
    .join('\n');
  const doc = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(story.title)}</title>
<style>body{font-family:Georgia,serif;max-width:40em;margin:3em auto;line-height:1.7;font-size:12pt}h1{text-align:center;margin-bottom:.2em}.tagline{text-align:center;font-style:italic;margin-top:0}
.chapter{page-break-before:always}h2{text-align:center;margin:2em 0 1em}.break{text-align:center}blockquote{font-style:italic;margin-left:2em}</style></head>
<body><h1>${esc(story.title)}</h1>${story.tagline ? `<p class="tagline">${esc(story.tagline)}</p>` : ''}${body}</body></html>`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([doc], { type: 'text/html' }));
  a.download = `${slug(story.title)}-manuscript.html`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
