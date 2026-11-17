import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLibrary } from '../store';
import { makeStory, makeUniverse, normalizeChapter, normalizeLibrary, normalizeStory, STATUSES, statusInfo, THEME_PRESETS } from '../defaults';
import { download, ensureFonts, fontStack, pickJsonFile, uid } from '../util';
import { Field, Modal } from '../components/ui';
import type { Story, StoryStatus, Theme } from '../types';
import { pathFor } from '../storyContext';
import { CloudButton } from '../sync/Cloud';
import { OatLogo } from '../components/Logo';

/** The colours in use right now: the main palette, or the second mood if it's switched on. */
export function palette(t: Theme) {
  return t.mood === 'alt' && t.alt ? t.alt : { bg: t.bg, surface: t.surface, text: t.text, muted: t.muted, accent: t.accent };
}

export function themeVars(t: Theme): React.CSSProperties {
  const p = palette(t);
  return {
    ['--bg' as any]: p.bg,
    ['--surface' as any]: p.surface,
    ['--text' as any]: p.text,
    ['--muted' as any]: p.muted,
    ['--accent' as any]: p.accent,
    ['--ornament' as any]: JSON.stringify(t.ornament || ''),
    ['--radius' as any]: t.radius + 'px',
    ['--font-head' as any]: fontStack(t.headingFont),
    ['--font-body' as any]: fontStack(t.bodyFont),
    ['--on-accent' as any]: readableOn(p.accent),
  };
}

/** Black or white, whichever reads better on the given hex colour. */
function readableOn(hex: string) {
  const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return '#fff';
  const [r, g, b] = m.slice(1).map((x) => {
    const c = parseInt(x, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#14141a' : '#fff';
}

type ViewMode = 'spines' | 'covers';
type SortMode = 'series' | 'recent' | 'title' | 'status';

const pref = <T extends string>(key: string, fallback: T): T => {
  try {
    return (localStorage.getItem(key) as T) || fallback;
  } catch {
    return fallback;
  }
};
const savePref = (key: string, v: string) => {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* ignore */
  }
};

export default function LibraryPage() {
  const { lib, update, replace, saveState } = useLibrary();
  const nav = useNavigate();
  const [creating, setCreating] = useState<null | 'story' | 'universe'>(null);
  const [title, setTitle] = useState('');
  const [preset, setPreset] = useState(0);
  const [query, setQuery] = useState('');
  const [statuses, setStatuses] = useState<StoryStatus[]>([]);
  const [view, setView] = useState<ViewMode>(() => pref('wo-shelf-view', 'spines'));
  const [sort, setSort] = useState<SortMode>(() => pref('wo-shelf-sort', 'series'));

  useEffect(() => {
    document.body.style.background = '';
    document.title = lib.siteTitle;
    ensureFonts([...lib.stories, ...lib.universes].flatMap((s) => [s.theme.headingFont, s.theme.bodyFont]));
  }, [lib.siteTitle, lib.stories, lib.universes]);

  useEffect(() => {
    if (creating) ensureFonts(THEME_PRESETS.flatMap((p) => [p.theme.headingFont, p.theme.bodyFont]));
  }, [creating]);

  const create = () => {
    const name = title.trim();
    const theme = THEME_PRESETS[preset].theme;
    const s = creating === 'universe' ? makeUniverse(name || 'New Universe', theme) : makeStory(name || 'Untitled Story', theme);
    update((d) => {
      if (s.kind === 'universe') d.universes.push(s);
      else d.stories.unshift(s);
    });
    setCreating(null);
    setTitle('');
    nav(pathFor(s));
  };

  const importFile = async () => {
    try {
      const data: any = await pickJsonFile();
      if (data?.stories) {
        const l = normalizeLibrary(data);
        if (!l) throw new Error();
        const mode = lib.stories.length
          ? confirm(`This backup has ${l.stories.length} stories and ${l.universes.length} universes.\n\nOK = add them to your library\nCancel = replace your whole library`)
          : true;
        if (mode) {
          update((d) => {
            const uRemap = new Map<string, string>();
            const uIds = new Set(d.universes.map((u) => u.id));
            for (const u of l.universes) {
              if (uIds.has(u.id)) uRemap.set(u.id, uid());
              d.universes.push({ ...u, id: uRemap.get(u.id) ?? u.id });
            }
            const ids = new Set(d.stories.map((s) => s.id));
            const sRemap = new Map<string, string>();
            for (const s of l.stories) {
              const id = ids.has(s.id) ? uid() : s.id;
              sRemap.set(s.id, id);
              d.stories.push({ ...s, id, universeId: s.universeId && (uRemap.get(s.universeId) ?? s.universeId) });
            }
            const cIds = new Set(d.chapters.map((c) => c.id));
            for (const c of l.chapters) d.chapters.push({ ...c, id: cIds.has(c.id) ? uid() : c.id, storyId: sRemap.get(c.storyId) ?? c.storyId });
          });
        } else if (confirm('Replace everything? Your current stories will be deleted.')) replace(l);
      } else if (data?.title !== undefined && data?.theme) {
        const s = normalizeStory(data);
        const chapters = Array.isArray(data.chapters) ? data.chapters.map(normalizeChapter) : [];
        delete (s as any).chapters;
        update((d) => {
          if (s.kind === 'universe') {
            if (d.universes.some((x) => x.id === s.id)) s.id = uid();
            d.universes.push(s);
          } else {
            if (d.stories.some((x) => x.id === s.id)) s.id = uid();
            if (s.universeId && !d.universes.some((u) => u.id === s.universeId)) s.universeId = undefined;
            d.stories.unshift(s);
            const cIds = new Set(d.chapters.map((c) => c.id));
            for (const c of chapters) d.chapters.push({ ...c, id: cIds.has(c.id) ? uid() : c.id, storyId: s.id });
          }
        });
      } else throw new Error();
    } catch {
      alert("That file doesn't look like a Writer's Oatmeal backup.");
    }
  };

  // ---- filtering & grouping ----
  const q = query.trim().toLowerCase();
  const uniName = (s: Story) => lib.universes.find((u) => u.id === s.universeId)?.title ?? '';
  const sharedNames = (s: Story) => {
    const u = lib.universes.find((x) => x.id === s.universeId);
    return u ? u.characters.filter((c) => s.sharedCharacterIds.includes(c.id)).map((c) => c.name) : [];
  };
  const matches = (s: Story) =>
    (!statuses.length || statuses.includes(s.status)) &&
    (!q ||
      [s.title, s.tagline, uniName(s), ...s.genres, ...s.characters.map((c) => c.name), ...sharedNames(s)].some((x) => x?.toLowerCase().includes(q)));
  const order = (list: Story[], inSeries: boolean) => {
    const l = [...list];
    if (sort === 'title') return l.sort((a, b) => a.title.localeCompare(b.title));
    if (sort === 'status') return l.sort((a, b) => STATUSES.findIndex((x) => x.key === a.status) - STATUSES.findIndex((x) => x.key === b.status));
    if (sort === 'series' && inSeries) return l.sort((a, b) => a.seriesOrder - b.seriesOrder);
    return l.sort((a, b) => b.updatedAt - a.updatedAt);
  };
  const filtering = !!q || statuses.length > 0;
  const shelves = [
    ...[...lib.universes]
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((u) => ({
        key: u.id,
        universe: u,
        books: order(lib.stories.filter((s) => s.universeId === u.id && matches(s)), true),
        universeMatches: !!q && [u.title, u.tagline, ...u.genres].some((x) => x.toLowerCase().includes(q)),
      })),
    { key: 'standalone', universe: undefined, books: order(lib.stories.filter((s) => !s.universeId && matches(s)), false), universeMatches: false },
  ].filter((sh) => sh.books.length || (!filtering && sh.universe) || sh.universeMatches);
  const total = lib.stories.length;
  const shown = shelves.reduce((n, sh) => n + sh.books.length, 0);

  return (
    <div className="library">
      <header className="lib-head">
        <div className="lib-brand">
          <OatLogo size={68} />
          <div>
          <Field className="lib-title" value={lib.siteTitle} onChange={(v) => update((d) => void (d.siteTitle = v))} />
          <p className="muted">
            {total} {total === 1 ? 'story' : 'stories'}
            {lib.universes.length > 0 && ` · ${lib.universes.length} ${lib.universes.length === 1 ? 'universe' : 'universes'}`} · <SaveBadge state={saveState} />
          </p>
          </div>
        </div>
        <div className="row gap wrap">
          <CloudButton />
          <button className="btn ghost" onClick={importFile}>Import</button>
          <button className="btn ghost" onClick={() => download(`writers-oatmeal-backup-${new Date().toISOString().slice(0, 10)}.json`, lib)} disabled={!total && !lib.universes.length}>
            Back up all
          </button>
          <button className="btn" onClick={() => setCreating('universe')}>🌌 New universe</button>
          <button className="btn primary" onClick={() => setCreating('story')}>+ New story</button>
        </div>
      </header>

      {total === 0 && lib.universes.length === 0 ? (
        <div className="lib-empty">
          <div className="empty-shelf" aria-hidden>
            <OatLogo size={110} />
          </div>
          <h2>Your shelf is empty</h2>
          <p className="muted">Create your first story. Each one gets its own look, characters, plot, world and soundtrack.<br />Stories that share a world can live together in a universe.</p>
          <div className="row gap" style={{ justifyContent: 'center' }}>
            <button className="btn" onClick={() => setCreating('universe')}>🌌 New universe</button>
            <button className="btn primary" onClick={() => setCreating('story')}>+ New story</button>
          </div>
        </div>
      ) : (
        <>
          <div className="shelf-tools">
            <input className="input search" type="search" placeholder="Search titles, genres, characters…" value={query} onChange={(e) => setQuery(e.target.value)} />
            <div className="chip-row">
              {STATUSES.map((st) => {
                const on = statuses.includes(st.key);
                const n = lib.stories.filter((s) => s.status === st.key).length;
                if (!n && !on) return null;
                return (
                  <button
                    key={st.key}
                    className={'chip' + (on ? ' on' : '')}
                    style={on ? { borderColor: st.color, background: st.color + '33' } : undefined}
                    onClick={() => setStatuses(on ? statuses.filter((x) => x !== st.key) : [...statuses, st.key])}
                  >
                    {st.icon} {st.label} <span className="muted">{n}</span>
                  </button>
                );
              })}
            </div>
            <div className="row gap wrap">
              <select className="input slim" value={sort} onChange={(e) => { setSort(e.target.value as SortMode); savePref('wo-shelf-sort', e.target.value); }} aria-label="Sort">
                <option value="series">Series order</option>
                <option value="recent">Recently edited</option>
                <option value="title">Title A–Z</option>
                <option value="status">Status</option>
              </select>
              <div className="seg">
                {(['spines', 'covers'] as const).map((v) => (
                  <button key={v} className={view === v ? 'on' : ''} onClick={() => { setView(v); savePref('wo-shelf-view', v); }}>
                    {v === 'spines' ? '📚 Spines' : '🖼️ Covers'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {filtering && <p className="muted small">{shown} of {total} stories match.</p>}

          {shelves.map((sh) => (
            <section key={sh.key} className="shelf">
              <div className="shelf-label">
                {sh.universe ? (
                  <Link to={pathFor(sh.universe)} className="plaque" style={{ ...themeVars(sh.universe.theme), fontFamily: fontStack(sh.universe.theme.headingFont) }}>
                    🌌 {sh.universe.title || 'Untitled universe'}
                    <span className="plaque-meta">{sh.books.length} {sh.books.length === 1 ? 'story' : 'stories'} · {sh.universe.characters.length} shared characters →</span>
                  </Link>
                ) : (
                  <span className="plaque plain">{lib.universes.length ? 'Standalone stories' : 'All stories'}</span>
                )}
              </div>
              <div className={'books ' + view}>
                {sh.books.map((s) => (view === 'spines' ? <Spine key={s.id} s={s} seriesNo={sh.universe && sort === 'series' ? s.seriesOrder : undefined} /> : <Cover key={s.id} s={s} />))}
                {!sh.books.length && <span className="muted small shelf-empty">No stories on this shelf yet: open a story and choose this universe.</span>}
              </div>
              <div className="plank" aria-hidden />
            </section>
          ))}
          {filtering && shown === 0 && <p className="muted" style={{ textAlign: 'center' }}>Nothing matches. Try another search.</p>}
        </>
      )}

      <p className="muted small lib-foot">
        Your stories are saved on this device, and in the cloud when you're signed in (☁️). <b>Back up all</b> downloads a copy you can keep anywhere.
      </p>

      {creating && (
        <Modal title={creating === 'universe' ? '🌌 New universe' : 'New story'} onClose={() => setCreating(null)} wide>
          {creating === 'universe' && (
            <p className="muted small">A universe holds stories that share a world: a series, sequels, spin-offs. Its characters and world can be used in all of them.</p>
          )}
          <label className="lbl">{creating === 'universe' ? 'Name' : 'Title'}</label>
          <input className="input" autoFocus value={title} placeholder={creating === 'universe' ? 'New Universe' : 'Untitled Story'} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} />
          <label className="lbl">Starting look <span className="muted small">(you can change every colour and font later)</span></label>
          <div className="preset-grid">
            {THEME_PRESETS.map((p, i) => (
              <button key={p.name} className={'preset' + (i === preset ? ' on' : '')} style={{ ...themeVars(p.theme), background: p.theme.bg, color: p.theme.text }} onClick={() => setPreset(i)}>
                <span style={{ fontFamily: fontStack(p.theme.headingFont), fontSize: 18 }}>{p.name}</span>
                <span className="preset-bar" style={{ background: p.theme.accent }} />
              </button>
            ))}
          </div>
          <div className="row end gap" style={{ marginTop: 16 }}>
            <button className="btn ghost" onClick={() => setCreating(null)}>Cancel</button>
            <button className="btn primary" onClick={create}>Create</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/** Small stable number from a string, so each book keeps the same height/width. */
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

function BookTip({ s }: { s: Story }) {
  const st = statusInfo(s.status);
  return (
    <span className="book-tip" role="tooltip">
      <b>{s.title || 'Untitled'}</b>
      {s.tagline && <span>{s.tagline}</span>}
      <span className="book-tip-meta">
        {st.icon} {st.label} · 👤 {s.characters.length + s.sharedCharacterIds.length}
      </span>
    </span>
  );
}

function Spine({ s, seriesNo }: { s: Story; seriesNo?: number }) {
  const t = s.theme;
  const h = hash(s.id);
  const height = 210 + (h % 5) * 12;
  const width = Math.min(78, Math.max(48, 34 + (s.title.length || 8) * 1.6 + (h % 3) * 4));
  const st = statusInfo(s.status);
  const style = {
    ...themeVars(t),
    height,
    width,
    background: `linear-gradient(90deg, color-mix(in srgb, ${t.accent} 70%, #000) 0 6%, ${t.accent} 12%, color-mix(in srgb, ${t.accent} 85%, #fff) 50%, ${t.accent} 88%, color-mix(in srgb, ${t.accent} 70%, #000) 100%)`,
    color: 'var(--on-accent)',
  } as React.CSSProperties;
  return (
    <Link to={pathFor(s)} className="book spine" style={style} aria-label={s.title}>
      <span className="spine-status" title={st.label}>{st.icon}</span>
      <span className="spine-band" />
      <span className="spine-title" style={{ fontFamily: fontStack(t.headingFont) }}>{s.title || 'Untitled'}</span>
      <span className="spine-band" />
      {seriesNo ? <span className="spine-no">{seriesNo}</span> : <span className="spine-no">✦</span>}
      <BookTip s={s} />
    </Link>
  );
}

function Cover({ s }: { s: Story }) {
  const t = s.theme;
  const st = statusInfo(s.status);
  return (
    <Link to={pathFor(s)} className="book cover" style={{ ...themeVars(t), background: t.bg, color: t.text }} aria-label={s.title}>
      {s.cover ? (
        <img src={s.cover} alt="" />
      ) : (
        <span className="gen-cover" style={{ background: `radial-gradient(circle at 50% 35%, color-mix(in srgb, ${t.accent} 45%, ${t.bg}), ${t.bg} 70%)` }}>
          <span className="gen-orn" style={{ color: t.accent }}>❦</span>
          <span className="gen-title" style={{ fontFamily: fontStack(t.headingFont) }}>{s.title || 'Untitled'}</span>
          <span className="gen-orn" style={{ color: t.accent }}>✦</span>
        </span>
      )}
      <span className="cover-status" style={{ ['--sc' as any]: st.color }}>{st.icon} {st.label}</span>
      <BookTip s={s} />
    </Link>
  );
}

export function SaveBadge({ state }: { state: 'saved' | 'saving' | 'error' }) {
  if (state === 'error') return <span className="save-err">⚠ Not saved — browser storage may be full</span>;
  return <span>{state === 'saving' ? 'Saving…' : 'All changes saved'}</span>;
}
