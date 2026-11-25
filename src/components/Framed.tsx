import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { Frame } from '../types';
import { Modal } from './ui';

export const DEFAULT_FRAME: Frame = { x: 0.5, y: 0.5, zoom: 1, fit: 'cover' };

interface Size {
  w: number;
  h: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Where the picture goes inside a box of a given size. The frame says which
 * point of the picture is centred and how far it's zoomed; we then keep the
 * picture from leaving gaps when it's big enough to fill the box.
 */
export function layout(nat: Size, box: Size, f: Frame) {
  const base = f.fit === 'contain' ? Math.min(box.w / nat.w, box.h / nat.h) : Math.max(box.w / nat.w, box.h / nat.h);
  const w = nat.w * base * f.zoom;
  const h = nat.h * base * f.zoom;
  let left = box.w / 2 - f.x * w;
  let top = box.h / 2 - f.y * h;
  left = w >= box.w ? clamp(left, box.w - w, 0) : (box.w - w) / 2;
  top = h >= box.h ? clamp(top, box.h - h, 0) : (box.h - h) / 2;
  return { left, top, w, h };
}

function useBoxSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

/**
 * The picture's real width and height, tied to the picture it belongs to, so a
 * new picture never borrows the old one's size, and a picture the browser had
 * already loaded (cached) is measured straight away.
 */
function useNaturalSize(src: string) {
  const [nat, setNat] = useState<(Size & { src: string }) | null>(null);
  const read = (img: HTMLImageElement | null) => {
    if (img && img.complete && img.naturalWidth) setNat((n) => (n?.src === src && n.w === img.naturalWidth ? n : { src, w: img.naturalWidth, h: img.naturalHeight || 1 }));
  };
  const imgRef = (img: HTMLImageElement | null) => read(img);
  const onLoad = (e: React.SyntheticEvent<HTMLImageElement>) => read(e.currentTarget);
  return [nat && nat.src === src ? (nat as Size) : null, imgRef, onLoad] as const;
}

/** A picture shown inside its frame. Fills whatever box it's put in. */
export function FramedImg({
  src,
  frame,
  alt = '',
  className = '',
  style,
  onClick,
  children,
}: {
  src: string;
  frame?: Frame | null;
  alt?: string;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  children?: ReactNode;
}) {
  const [ref, size] = useBoxSize();
  const [nat, imgRef, onLoad] = useNaturalSize(src);
  const [broken, setBroken] = useState<string | null>(null);
  const f = frame ?? DEFAULT_FRAME;
  if (broken === src)
    return (
      <div ref={ref} className={'framed broken ' + className} style={style} onClick={onClick} title={src.startsWith('http') ? src : undefined}>
        <span>⚠ Picture unavailable{src.startsWith('http') ? ' (the website may have removed it)' : ''}</span>
        {children}
      </div>
    );
  const g = nat && size && size.w > 0 && size.h > 0 ? layout(nat, size, f) : null;
  return (
    <div ref={ref} className={'framed ' + className} style={style} onClick={onClick}>
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        draggable={false}
        onLoad={onLoad}
        onError={() => setBroken(src)}
        style={
          g
            ? { position: 'absolute', left: g.left, top: g.top, width: g.w, height: g.h, maxWidth: 'none' }
            : { width: '100%', height: '100%', objectFit: f.fit === 'contain' ? 'contain' : 'cover' }
        }
      />
      {children}
    </div>
  );
}

/** Drag to move, slider / wheel / pinch to zoom, fill or show-whole. */
export function FrameEditor({
  src,
  frame,
  aspect,
  round,
  title = 'Adjust picture',
  onSave,
  onClose,
}: {
  src: string;
  frame?: Frame | null;
  /** width ÷ height of where the picture is shown */
  aspect: number;
  round?: boolean;
  title?: string;
  onSave: (f: Frame) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState<Frame>({ ...DEFAULT_FRAME, ...(frame ?? {}) });
  const [nat, imgRef, onLoad] = useNaturalSize(src);
  const drag = useRef<{ x: number; y: number; f: Frame } | null>(null);
  const pinch = useRef<{ d: number; zoom: number } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());

  // the editing box: as big as fits on screen, in the frame's shape
  const maxW = Math.min(560, (typeof window !== 'undefined' ? window.innerWidth : 600) - 80);
  const maxH = Math.min(420, (typeof window !== 'undefined' ? window.innerHeight : 600) * 0.55);
  let bw = maxW;
  let bh = bw / aspect;
  if (bh > maxH) {
    bh = maxH;
    bw = bh * aspect;
  }
  const box = { w: bw, h: bh };
  const g = nat ? layout(nat, box, f) : null;

  /** After a move, store where the picture actually ended up (edges stop it). */
  const settle = (next: Frame) => {
    if (!nat) return setF(next);
    const p = layout(nat, box, next);
    setF({ ...next, x: (box.w / 2 - p.left) / p.w, y: (box.h / 2 - p.top) / p.h });
  };

  const onDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: f.zoom };
      drag.current = null;
    } else drag.current = { x: e.clientX, y: e.clientY, f };
  };
  const onMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      settle({ ...f, zoom: clamp((pinch.current.zoom * d) / pinch.current.d, 1, 5) });
      return;
    }
    const d = drag.current;
    if (!d || !g) return;
    // dragging the picture right shows more of its left side
    settle({ ...d.f, x: d.f.x - (e.clientX - d.x) / g.w, y: d.f.y - (e.clientY - d.y) / g.h });
  };
  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (!pointers.current.size) drag.current = null;
  };

  return (
    <Modal title={title} onClose={onClose}>
      <div className="frame-stage">
        <div
          className={'frame-box' + (round ? ' round' : '')}
          style={{ width: box.w, height: box.h }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onWheel={(e) => settle({ ...f, zoom: clamp(f.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08), 1, 5) })}
        >
          <img
            ref={imgRef}
            src={src}
            alt=""
            draggable={false}
            onLoad={onLoad}
            style={g ? { position: 'absolute', left: g.left, top: g.top, width: g.w, height: g.h, maxWidth: 'none' } : { opacity: 0 }}
          />
          <span className="frame-grid" aria-hidden />
        </div>
        <p className="muted small" style={{ textAlign: 'center', margin: '8px 0 0' }}>Drag the picture to move it · scroll or pinch to zoom</p>
      </div>
      <div className="frame-controls">
        <label className="row gap small">
          <span>Zoom</span>
          <input type="range" min={1} max={5} step={0.01} value={f.zoom} onChange={(e) => settle({ ...f, zoom: +e.target.value })} style={{ flex: 1 }} aria-label="Zoom" />
          <span className="bar-val">{f.zoom.toFixed(1)}×</span>
        </label>
        <div className="row gap wrap between">
          <div className="seg small">
            <button className={f.fit === 'cover' ? 'on' : ''} onClick={() => settle({ ...f, fit: 'cover' })}>Fill the frame</button>
            <button className={f.fit === 'contain' ? 'on' : ''} onClick={() => settle({ ...f, fit: 'contain' })}>Show the whole picture</button>
          </div>
          <button className="btn small ghost" onClick={() => setF({ ...DEFAULT_FRAME })}>Reset</button>
        </div>
      </div>
      <div className="row end gap" style={{ marginTop: 14 }}>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button
          className="btn primary"
          onClick={() => {
            onSave({ x: +f.x.toFixed(4), y: +f.y.toFixed(4), zoom: +f.zoom.toFixed(3), fit: f.fit });
            onClose();
          }}
        >
          Save
        </button>
      </div>
    </Modal>
  );
}

/** A small "Adjust" button that opens the editor for one picture. */
export function AdjustButton({
  src,
  frame,
  aspect,
  round,
  onSave,
  className = 'btn small',
  label = '✥ Adjust',
}: {
  src: string;
  frame?: Frame | null;
  aspect: number;
  round?: boolean;
  onSave: (f: Frame) => void;
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={className}
        title="Move, zoom or crop how this picture fits"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        {label}
      </button>
      {open && <FrameEditor src={src} frame={frame} aspect={aspect} round={round} onSave={onSave} onClose={() => setOpen(false)} />}
    </>
  );
}
