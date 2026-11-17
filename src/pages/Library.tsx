import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLibrary } from '../store';
import { makeStory, normalizeLibrary, normalizeStory, THEME_PRESETS } from '../defaults';
import { download, ensureFonts, fontStack, pickJsonFile, uid } from '../util';
import { Field, Modal } from '../components/ui';
import type { Story, Theme } from '../types';
import { CloudButton } from '../sync/Cloud';

export function themeVars(t: Theme): React.CSSProperties {
  return {
    ['--bg' as any]: t.bg,
    ['--surface' as any]: t.surface,
    ['--text' as any]: t.text,
    ['--muted' as any]: t.muted,
    ['--accent' as any]: t.accent,
    ['--radius' as any]: t.radius + 'px',
    ['--font-head' as any]: fontStack(t.headingFont),
    ['--font-body' as any]: fontStack(t.bodyFont),
    ['--on-accent' as any]: readableOn(t.accent),
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

export default function LibraryPage() {
  const { lib, update, replace, saveState } = useLibrary();
  const nav = useNavigate();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [preset, setPreset] = useState(0);

  useEffect(() => {
    document.body.style.background = '';
    document.title = lib.siteTitle;
    ensureFonts(lib.stories.flatMap((s) => [s.theme.headingFont, s.theme.bodyFont]));
  }, [lib.siteTitle, lib.stories]);

  useEffect(() => {
    if (creating) ensureFonts(THEME_PRESETS.flatMap((p) => [p.theme.headingFont, p.theme.bodyFont]));
  }, [creating]);

  const create = () => {
    const s = makeStory(title.trim() || 'Untitled Story', THEME_PRESETS[preset].theme);
    update((d) => {
      d.stories.unshift(s);
    });
    setCreating(false);
    setTitle('');
    nav('/story/' + s.id);
  };

  const importFile = async () => {
    try {
      const data: any = await pickJsonFile();
      if (data?.stories) {
        const l = normalizeLibrary(data);
        if (!l) throw new Error();
        const mode = lib.stories.length
          ? confirm(`This backup has ${l.stories.length} stories.\n\nOK = add them to your library\nCancel = replace your whole library`)
          : true;
        if (mode) {
          update((d) => {
            const ids = new Set(d.stories.map((s) => s.id));
            for (const s of l.stories) d.stories.push(ids.has(s.id) ? { ...s, id: uid() } : s);
          });
        } else if (confirm('Replace everything? Your current stories will be deleted.')) replace(l);
      } else if (data?.title !== undefined && data?.theme) {
        const s = normalizeStory(data);
        update((d) => {
          if (d.stories.some((x) => x.id === s.id)) s.id = uid();
          d.stories.unshift(s);
        });
      } else throw new Error();
    } catch {
      alert("That file doesn't look like a Writer's Oatmeal backup.");
    }
  };

  return (
    <div className="library">
      <header className="lib-head">
        <div>
          <Field className="lib-title" value={lib.siteTitle} onChange={(v) => update((d) => void (d.siteTitle = v))} />
          <p className="muted">
            {lib.stories.length} {lib.stories.length === 1 ? 'story' : 'stories'} · <SaveBadge state={saveState} />
          </p>
        </div>
        <div className="row gap wrap">
          <CloudButton />
          <button className="btn ghost" onClick={importFile}>Import</button>
          <button className="btn ghost" onClick={() => download(`writers-oatmeal-backup-${new Date().toISOString().slice(0, 10)}.json`, lib)} disabled={!lib.stories.length}>
            Back up all
          </button>
          <button className="btn primary" onClick={() => setCreating(true)}>+ New story</button>
        </div>
      </header>

      {lib.stories.length === 0 ? (
        <div className="lib-empty">
          <div style={{ fontSize: 56 }}>📚</div>
          <h2>Your shelf is empty</h2>
          <p className="muted">Create your first story. Each one gets its own look, characters, plot, world and soundtrack.</p>
          <button className="btn primary" onClick={() => setCreating(true)}>+ New story</button>
        </div>
      ) : (
        <div className="shelf">
          {lib.stories.map((s) => (
            <StoryCard key={s.id} s={s} />
          ))}
        </div>
      )}

      <p className="muted small lib-foot">
        Your stories are saved on this device, and in the cloud when you're signed in (☁️). <b>Back up all</b> downloads a copy you can keep anywhere.
      </p>

      {creating && (
        <Modal title="New story" onClose={() => setCreating(false)} wide>
          <label className="lbl">Title</label>
          <input className="input" autoFocus value={title} placeholder="Untitled Story" onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} />
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
            <button className="btn ghost" onClick={() => setCreating(false)}>Cancel</button>
            <button className="btn primary" onClick={create}>Create</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function StoryCard({ s }: { s: Story }) {
  const t = s.theme;
  return (
    <Link to={'/story/' + s.id} className="story-card" style={{ ...themeVars(t), background: t.surface, color: t.text }}>
      <div className="story-card-cover" style={{ background: s.cover ? `url(${s.cover}) center/cover` : `linear-gradient(135deg, ${t.accent}, ${t.bg})` }} />
      <div className="story-card-body">
        <h2 style={{ fontFamily: fontStack(t.headingFont) }}>{s.title || 'Untitled'}</h2>
        {s.tagline && <p style={{ fontFamily: fontStack(t.bodyFont), color: t.muted }}>{s.tagline}</p>}
        <div className="story-card-meta" style={{ color: t.muted }}>
          <span>👤 {s.characters.length}</span>
          <span>📍 {s.arcs.reduce((n, a) => n + a.points.length, 0)}</span>
          <span>🎵 {s.songs.length}</span>
        </div>
      </div>
      <span className="story-card-accent" style={{ background: t.accent }} />
    </Link>
  );
}

export function SaveBadge({ state }: { state: 'saved' | 'saving' | 'error' }) {
  if (state === 'error') return <span className="save-err">⚠ Not saved — browser storage may be full</span>;
  return <span>{state === 'saving' ? 'Saving…' : 'All changes saved'}</span>;
}
