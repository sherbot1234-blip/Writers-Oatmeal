import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { imageFileToDataUrl, SWATCHES } from '../util';
import type { Character } from '../types';

/** Text that looks like plain text until you click into it. */
export function Field({
  value,
  onChange,
  placeholder,
  multiline,
  className = '',
  style,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 2 + 'px';
  }, [value, multiline]);
  if (multiline)
    return (
      <textarea
        ref={ref}
        rows={1}
        className={'field ' + className}
        style={style}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  return (
    <input
      className={'field ' + className}
      style={style}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function Modal({ title, onClose, children, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'modal' + (wide ? ' wide' : '')} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

/** Button that opens a file picker for one or many images. */
export function ImagePick({
  onPick,
  multiple,
  children,
  className = 'btn',
  maxDim,
}: {
  onPick: (dataUrls: string[]) => void;
  multiple?: boolean;
  children: ReactNode;
  className?: string;
  maxDim?: number;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => ref.current?.click()} disabled={busy}>
        {busy ? 'Loading…' : children}
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        multiple={multiple}
        hidden
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (!files.length) return;
          setBusy(true);
          try {
            onPick(await Promise.all(files.map((f) => imageFileToDataUrl(f, maxDim))));
          } catch {
            alert('Sorry, that image could not be read.');
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}

export function Avatar({ c, size = 40 }: { c: Pick<Character, 'name' | 'image' | 'color'>; size?: number }) {
  const initials = (c.name || '?')
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, fontSize: size * 0.38, background: c.image ? undefined : c.color, borderColor: c.color }}
    >
      {c.image ? <img src={c.image} alt="" /> : initials}
    </span>
  );
}

export function ColorPick({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="color-pick">
      <button type="button" className="swatch" style={{ background: value }} onClick={() => setOpen(!open)} aria-label="Pick colour" />
      {open && (
        <div className="swatch-pop" onMouseLeave={() => setOpen(false)}>
          {SWATCHES.map((c) => (
            <button
              type="button"
              key={c}
              className="swatch"
              style={{ background: c }}
              onClick={() => {
                onChange(c);
                setOpen(false);
              }}
            />
          ))}
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)} title="Custom colour" />
        </div>
      )}
    </span>
  );
}

export function TagInput({ tags, onChange, placeholder = 'Add…' }: { tags: string[]; onChange: (t: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setDraft('');
  };
  return (
    <div className="tags">
      {tags.map((t) => (
        <span className="tag" key={t}>
          {t}
          <button type="button" onClick={() => onChange(tags.filter((x) => x !== t))} aria-label={'Remove ' + t}>
            ×
          </button>
        </span>
      ))}
      <input
        className="tag-input"
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add();
          } else if (e.key === 'Backspace' && !draft && tags.length) onChange(tags.slice(0, -1));
        }}
        onBlur={add}
      />
    </div>
  );
}

/** Toggle chips for choosing which characters are involved. */
export function CharacterChips({
  characters,
  selected,
  onChange,
}: {
  characters: Character[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  if (!characters.length) return <p className="muted small">No characters yet.</p>;
  return (
    <div className="chip-row">
      {characters.map((c) => {
        const on = selected.includes(c.id);
        return (
          <button
            type="button"
            key={c.id}
            className={'chip' + (on ? ' on' : '')}
            style={on ? { borderColor: c.color, background: c.color + '33' } : undefined}
            onClick={() => onChange(on ? selected.filter((x) => x !== c.id) : [...selected, c.id])}
          >
            <Avatar c={c} size={20} /> {c.name || 'Unnamed'}
          </button>
        );
      })}
    </div>
  );
}

export function RadarChart({ stats, color, size = 260 }: { stats: { label: string; value: number }[]; color: string; size?: number }) {
  const n = stats.length;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 48;
  const pt = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + Math.cos(a) * r * (v / 10), cy + Math.sin(a) * r * (v / 10)];
  };
  const ring = (v: number) => stats.map((_, i) => pt(i, v).join(',')).join(' ');
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="radar" role="img" aria-label="Stat chart">
      {[2, 4, 6, 8, 10].map((v) => (
        <polygon key={v} points={ring(v)} className="radar-ring" />
      ))}
      {stats.map((_, i) => {
        const [x, y] = pt(i, 10);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} className="radar-ring" />;
      })}
      <polygon points={stats.map((s, i) => pt(i, Math.max(0, Math.min(10, s.value))).join(',')).join(' ')} fill={color} fillOpacity={0.35} stroke={color} strokeWidth={2} />
      {stats.map((s, i) => {
        const [x, y] = pt(i, 12.6);
        return (
          <text key={i} x={x} y={y} textAnchor={Math.abs(x - cx) < 6 ? 'middle' : x > cx ? 'start' : 'end'} dominantBaseline="middle" className="radar-label">
            {s.label || '—'}
          </text>
        );
      })}
    </svg>
  );
}

export function Empty({ icon, title, children }: { icon: string; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      {children}
    </div>
  );
}

export function Lightbox({ src, caption, onClose }: { src: string; caption?: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="lightbox" onClick={onClose}>
      <img src={src} alt={caption ?? ''} />
      {caption && <p>{caption}</p>}
    </div>
  );
}
