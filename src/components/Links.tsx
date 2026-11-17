import { useState } from 'react';
import type { LinkItem } from '../types';
import { uid } from '../util';

export function linkKind(url: string): { icon: string; name: string } {
  const u = url.toLowerCase();
  if (u.includes('milanote.com')) return { icon: '📌', name: 'Milanote' };
  if (u.includes('spotify.com')) return { icon: '🎵', name: 'Spotify' };
  if (u.includes('youtube.com') || u.includes('youtu.be')) return { icon: '▶️', name: 'YouTube' };
  if (u.includes('pinterest.')) return { icon: '📍', name: 'Pinterest' };
  if (u.includes('docs.google.com') || u.includes('drive.google.com')) return { icon: '📄', name: 'Google' };
  return { icon: '🔗', name: 'Link' };
}

const normalise = (url: string) => (/^[a-z]+:\/\//i.test(url) ? url : 'https://' + url);

/** A small list of outside links, e.g. the Milanote boards for a story or character. */
export function Links({ links, onChange, hint = 'Paste a Milanote board link (Share → Copy link), or any other link' }: { links: LinkItem[]; onChange: (l: LinkItem[]) => void; hint?: string }) {
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [adding, setAdding] = useState(false);

  const add = () => {
    if (!url.trim()) return;
    const u = normalise(url.trim());
    onChange([...links, { id: uid(), url: u, label: label.trim() || linkKind(u).name + ' board' }]);
    setUrl('');
    setLabel('');
    setAdding(false);
  };

  return (
    <div className="links">
      {links.map((l) => (
        <span key={l.id} className="link-chip">
          <a href={l.url} target="_blank" rel="noreferrer" title={l.url}>
            <span aria-hidden>{linkKind(l.url).icon}</span> {l.label}
          </a>
          <button onClick={() => onChange(links.filter((x) => x.id !== l.id))} aria-label={'Remove ' + l.label}>×</button>
        </span>
      ))}
      {adding ? (
        <div className="link-add">
          <input className="input slim" autoFocus placeholder="https://app.milanote.com/…" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
          <input className="input slim" placeholder="Name (optional)" value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
          <button className="btn small primary" onClick={add}>Add</button>
          <button className="btn small ghost" onClick={() => setAdding(false)}>Cancel</button>
          <span className="muted small" style={{ flexBasis: '100%' }}>{hint}</span>
        </div>
      ) : (
        <button className="btn small dashed" onClick={() => setAdding(true)}>+ Link a board</button>
      )}
    </div>
  );
}
