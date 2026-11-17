import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLibrary } from '../store';
import { applyChanges, hasChanges, runSync } from './engine';
import { configFromBuild, getClient, getConfig, makeBackend, makeCache, saveConfig, type CloudConfig } from './supabase';
import { Modal } from '../components/ui';

type Status = 'off' | 'signed-out' | 'syncing' | 'synced' | 'offline' | 'error';

interface CloudCtx {
  status: Status;
  error: string;
  email: string;
  lastSynced: number | null;
  syncNow: () => void;
  openPanel: () => void;
}

const Ctx = createContext<CloudCtx | null>(null);
export const useCloud = () => useContext(Ctx)!;

const SETUP_GUIDE = 'https://github.com/sherbot1234-blip/Writers-Oatmeal/blob/main/docs/CLOUD_SETUP.md';

export function CloudProvider({ children }: { children: ReactNode }) {
  const { lib, applyRemote } = useLibrary();
  const [configured, setConfigured] = useState(() => !!getConfig());
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>(configured ? 'signed-out' : 'off');
  const [error, setError] = useState('');
  const [lastSynced, setLastSynced] = useState<number | null>(null);
  const [panel, setPanel] = useState(false);

  const libRef = useRef(lib);
  libRef.current = lib;
  const appliedRef = useRef<typeof lib | null>(null);
  const running = useRef(false);
  const again = useRef(false);

  // follow the login session
  useEffect(() => {
    if (!configured) {
      setStatus('off');
      setUserId(null);
      return;
    }
    const sb = getClient();
    if (!sb) {
      setStatus('error');
      setError('The cloud settings look wrong. Check the project URL and key.');
      return;
    }
    sb.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id ?? null);
      setEmail(data.session?.user.email ?? '');
      if (!data.session) setStatus('signed-out');
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user.id ?? null);
      setEmail(session?.user.email ?? '');
      if (!session) setStatus('signed-out');
    });
    return () => sub.subscription.unsubscribe();
  }, [configured]);

  const syncNow = useCallback(async () => {
    const sb = getClient();
    if (!sb || !userId) return;
    if (running.current) {
      again.current = true;
      return;
    }
    if (!navigator.onLine) {
      setStatus('offline');
      return;
    }
    running.current = true;
    setStatus('syncing');
    try {
      const r = await runSync(libRef.current, makeBackend(sb, userId), makeCache(userId));
      if (hasChanges(r.changes)) {
        applyRemote((l) => {
          const next = applyChanges(l, r.changes);
          appliedRef.current = next;
          return next;
        });
        // conflict copies / skipped items need one more pass to upload
        if (r.changes.conflictCopies.length) again.current = true;
      }
      setError('');
      setStatus('synced');
      setLastSynced(Date.now());
    } catch (e) {
      setStatus(navigator.onLine ? 'error' : 'offline');
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      running.current = false;
      if (again.current) {
        again.current = false;
        setTimeout(syncNow, 500);
      }
    }
  }, [userId, applyRemote]);

  // sync on login, every minute, when the tab regains focus, and when back online
  useEffect(() => {
    if (!userId) return;
    syncNow();
    const iv = setInterval(syncNow, 60_000);
    const onFocus = () => document.visibilityState === 'visible' && syncNow();
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('online', syncNow);
    return () => {
      clearInterval(iv);
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('online', syncNow);
    };
  }, [userId, syncNow]);

  // sync a few seconds after you stop editing
  useEffect(() => {
    if (!userId || lib === appliedRef.current) return;
    const t = setTimeout(syncNow, 2500);
    return () => clearTimeout(t);
  }, [lib, userId, syncNow]);

  return (
    <Ctx.Provider value={{ status, error, email, lastSynced, syncNow, openPanel: () => setPanel(true) }}>
      {children}
      {panel && (
        <CloudPanel
          status={status}
          error={error}
          email={email}
          lastSynced={lastSynced}
          configured={configured}
          onConfigured={(c) => {
            saveConfig(c);
            setConfigured(!!c);
            setError('');
          }}
          syncNow={syncNow}
          onClose={() => setPanel(false)}
        />
      )}
    </Ctx.Provider>
  );
}

const LABELS: Record<Status, string> = {
  off: 'Only on this device',
  'signed-out': 'Not signed in',
  syncing: 'Syncing…',
  synced: 'Synced',
  offline: 'Offline — will sync later',
  error: 'Sync problem',
};
const ICONS: Record<Status, string> = { off: '💾', 'signed-out': '☁️', syncing: '🔄', synced: '☁️', offline: '📴', error: '⚠️' };

export function CloudButton() {
  const { status, openPanel } = useCloud();
  return (
    <button className={'cloud-btn ' + status} onClick={openPanel} title="Cloud sync">
      <span aria-hidden>{ICONS[status]}</span> <span className="cloud-label">{LABELS[status]}</span>
    </button>
  );
}

function CloudPanel({
  status,
  error,
  email,
  lastSynced,
  configured,
  onConfigured,
  syncNow,
  onClose,
}: {
  status: Status;
  error: string;
  email: string;
  lastSynced: number | null;
  configured: boolean;
  onConfigured: (c: CloudConfig | null) => void;
  syncNow: () => void;
  onClose: () => void;
}) {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [em, setEm] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const signIn = async () => {
    const sb = getClient();
    if (!sb) return;
    setBusy(true);
    setMsg('');
    const { error } = await sb.auth.signInWithPassword({ email: em.trim(), password: pw });
    setBusy(false);
    if (error) setMsg(error.message === 'Invalid login credentials' ? 'Wrong email or password.' : error.message);
    else setPw('');
  };

  return (
    <Modal title="☁️ Cloud sync" onClose={onClose}>
      {!configured ? (
        <>
          <p className="small">
            Connect your free Supabase project to keep your stories on all your devices. You only do this once.{' '}
            <a href={SETUP_GUIDE} target="_blank" rel="noreferrer">Step-by-step setup guide ↗</a>
          </p>
          <label className="lbl">Project URL</label>
          <input className="input" placeholder="https://abcdefgh.supabase.co" value={url} onChange={(e) => setUrl(e.target.value)} />
          <label className="lbl">Publishable key (or "anon" key)</label>
          <input className="input" placeholder="sb_publishable_… or eyJ…" value={key} onChange={(e) => setKey(e.target.value)} />
          <div className="row end gap" style={{ marginTop: 14 }}>
            <button
              className="btn primary"
              disabled={!/^https:\/\/.+/.test(url.trim()) || key.trim().length < 20}
              onClick={() => onConfigured({ url: url.trim(), key: key.trim() })}
            >
              Connect
            </button>
          </div>
        </>
      ) : !email ? (
        <>
          <p className="small">Sign in with the account you created in Supabase. Your stories will merge with what's already in the cloud.</p>
          <label className="lbl">Email</label>
          <input className="input" type="email" autoComplete="username" value={em} onChange={(e) => setEm(e.target.value)} />
          <label className="lbl">Password</label>
          <input className="input" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && signIn()} />
          {(msg || error) && <p className="save-err small">{msg || error}</p>}
          <div className="row between gap" style={{ marginTop: 14 }}>
            {!configFromBuild() ? (
              <button className="btn small ghost" onClick={() => confirm('Disconnect this Supabase project from this device?') && onConfigured(null)}>Change project</button>
            ) : <span />}
            <button className="btn primary" disabled={busy || !em || !pw} onClick={signIn}>{busy ? 'Signing in…' : 'Sign in'}</button>
          </div>
        </>
      ) : (
        <>
          <p>
            Signed in as <b>{email}</b>
          </p>
          <p className="small">
            Status: <b>{LABELS[status]}</b>
            {lastSynced && <span className="muted"> · last synced {new Date(lastSynced).toLocaleTimeString()}</span>}
          </p>
          {error && <p className="save-err small">{error}</p>}
          <p className="muted small">
            Changes sync automatically a few seconds after you stop typing, and whenever you come back to this tab. If the same story was changed on two devices at once, you'll get a "(conflict copy)" so nothing is lost.
          </p>
          <div className="row between gap" style={{ marginTop: 14 }}>
            <button
              className="btn small ghost"
              onClick={async () => {
                if (!confirm('Sign out on this device? Your stories stay here, they just stop syncing.')) return;
                await getClient()?.auth.signOut();
              }}
            >
              Sign out
            </button>
            <button className="btn primary" onClick={syncNow} disabled={status === 'syncing'}>Sync now</button>
          </div>
        </>
      )}
    </Modal>
  );
}
