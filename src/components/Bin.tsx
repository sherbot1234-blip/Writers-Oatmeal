import { useState } from 'react';
import { useLibrary } from '../store';
import { daysLeft, restore } from '../trash';
import { TRASH_DAYS } from '../defaults';
import { Modal } from './ui';
import type { TrashItem } from '../types';

const ICON: Record<TrashItem['kind'], string> = { story: '📕', universe: '🌌', character: '👤', chapter: '✍️', item: '📄', version: '🕘' };

/** The "Recently deleted" bin: everything, or just one story's things. */
export function BinModal({ storyId, onClose }: { storyId?: string; onClose: () => void }) {
  const { lib, update } = useLibrary();
  const [msg, setMsg] = useState('');
  const items = lib.trash.filter((t) => !storyId || t.storyId === storyId || t.payload?.data?.storyId === storyId).sort((a, b) => b.deletedAt - a.deletedAt);
  const day = (t: number) => {
    const d = Math.floor((Date.now() - t) / 864e5);
    return d === 0 ? 'Today' : d === 1 ? 'Yesterday' : d < 7 ? 'This week' : 'Earlier';
  };
  let lastGroup = '';

  return (
    <Modal title={`🗑 Recently deleted${storyId ? ' in this story' : ''}`} onClose={onClose} wide>
      <p className="muted small">Deleted things stay here for {TRASH_DAYS} days, then disappear for good. Older versions replaced while syncing (🕘) also land here.</p>
      {msg && <p className="save-err small">{msg}</p>}
      {!items.length ? (
        <p className="muted" style={{ textAlign: 'center', padding: 20 }}>The bin is empty.</p>
      ) : (
        <div className="bin-list">
          {items.map((t) => {
            const g = day(t.deletedAt);
            const head = g !== lastGroup;
            lastGroup = g;
            return (
              <div key={t.id}>
                {head && <div className="bin-group">{g}</div>}
                <div className="bin-row">
                  <span className="bin-icon" aria-hidden>{ICON[t.kind]}</span>
                  <span className="bin-text">
                    <b>{t.title}</b>
                    <span className="muted small">
                      {t.what}
                      {!storyId && t.storyTitle && t.kind !== 'story' ? ` · in ${t.storyTitle}` : ''} · {daysLeft(t, TRASH_DAYS)} days left
                    </span>
                  </span>
                  <button
                    className="btn small"
                    onClick={() => {
                      let err: string | null = null;
                      update((d) => {
                        err = restore(d, t.id);
                      });
                      setMsg(err ?? '');
                    }}
                  >
                    {t.kind === 'version' ? 'Restore as copy' : 'Restore'}
                  </button>
                  <button
                    className="icon-btn danger"
                    title="Delete forever"
                    onClick={() => confirm(`Delete “${t.title}” forever? This can't be undone.`) && update((d) => void (d.trash = d.trash.filter((x) => x.id !== t.id)))}
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="row between gap" style={{ marginTop: 14 }}>
        {items.length > 0 ? (
          <button
            className="btn small ghost danger"
            onClick={() => {
              if (!confirm(`Delete all ${items.length} item(s) forever? This can't be undone.`)) return;
              const ids = new Set(items.map((t) => t.id));
              update((d) => void (d.trash = d.trash.filter((x) => !ids.has(x.id))));
            }}
          >
            Empty {storyId ? "this story's" : 'the'} bin
          </button>
        ) : <span />}
        <button className="btn primary" onClick={onClose}>Done</button>
      </div>
    </Modal>
  );
}

/** "🗑 Bin" button that opens the bin; shows how many things are in it. */
export function BinButton({ storyId, className = 'btn ghost', compact }: { storyId?: string; className?: string; compact?: boolean }) {
  const { lib } = useLibrary();
  const [open, setOpen] = useState(false);
  const n = lib.trash.filter((t) => !storyId || t.storyId === storyId).length;
  return (
    <>
      <button className={className} onClick={() => setOpen(true)} title="Recently deleted">
        🗑{compact ? '' : ' Bin'}{n ? ` (${n})` : ''}
      </button>
      {open && <BinModal storyId={storyId} onClose={() => setOpen(false)} />}
    </>
  );
}
