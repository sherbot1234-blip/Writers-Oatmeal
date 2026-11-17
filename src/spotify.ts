/**
 * Spotify sign-in and playlist reading, entirely in the browser.
 *
 * Uses Spotify's "Authorization Code with PKCE" flow, made for apps with no
 * server: no secret key is involved, only your app's public Client ID. The
 * access token stays in this browser.
 */

const LS_CLIENT = 'wo-spotify-client-id';
const LS_TOKEN = 'wo-spotify-token';
const SS_PKCE = 'wo-spotify-pkce';
const SS_ERROR = 'wo-spotify-error';
const SCOPES = 'playlist-read-private playlist-read-collaborative';
const ACCOUNTS = 'https://accounts.spotify.com';
const API = 'https://api.spotify.com/v1';

interface Token {
  access: string;
  refresh?: string;
  expires: number;
}

export interface SpPlaylist {
  id: string;
  name: string;
  image?: string;
  total: number;
  url: string;
  owner: string;
}

export interface SpTrack {
  title: string;
  artist: string;
  url: string;
}

const ls = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string | null) => {
    try {
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    } catch {
      /* private mode */
    }
  },
};

/** The address Spotify sends you back to. It must be listed in your Spotify app's settings. */
export const redirectUri = () => location.origin + location.pathname;

export function getClientId(): string {
  const env = (import.meta.env as Record<string, string | undefined>).VITE_SPOTIFY_CLIENT_ID;
  return env || ls.get(LS_CLIENT) || '';
}
export const clientIdFromBuild = () => !!(import.meta.env as Record<string, string | undefined>).VITE_SPOTIFY_CLIENT_ID;
export const setClientId = (id: string) => ls.set(LS_CLIENT, id.trim() || null);

const loadToken = (): Token | null => {
  try {
    return JSON.parse(ls.get(LS_TOKEN) || 'null');
  } catch {
    return null;
  }
};
const saveToken = (t: Token | null) => ls.set(LS_TOKEN, t ? JSON.stringify(t) : null);
export const isConnected = () => !!loadToken();
export const disconnect = () => saveToken(null);

/** An error from the last sign-in attempt, shown once. */
export function takeLoginError(): string | null {
  try {
    const e = sessionStorage.getItem(SS_ERROR);
    sessionStorage.removeItem(SS_ERROR);
    return e;
  } catch {
    return null;
  }
}

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const randomString = (n: number) => b64url(crypto.getRandomValues(new Uint8Array(n))).slice(0, n);

export async function startLogin() {
  const clientId = getClientId();
  if (!clientId) throw new Error('Add your Spotify Client ID first.');
  const verifier = randomString(64);
  const challenge = b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  const state = randomString(16);
  sessionStorage.setItem(SS_PKCE, JSON.stringify({ verifier, state, returnHash: location.hash }));
  const q = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri(),
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: SCOPES,
    state,
  });
  location.assign(`${ACCOUNTS}/authorize?${q}`);
}

async function tokenRequest(body: Record<string, string>): Promise<Token> {
  const res = await fetch(`${ACCOUNTS}/api/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.access_token) throw new Error(j.error_description || j.error || `Spotify sign-in failed (${res.status})`);
  return { access: j.access_token, refresh: j.refresh_token, expires: Date.now() + (j.expires_in ?? 3600) * 1000 - 60_000 };
}

/**
 * Call once at start-up. If Spotify just sent us back here (?code=…), swap the
 * code for a token, then tidy the address bar and return to the page you were on.
 */
export async function completeLoginIfReturning(): Promise<void> {
  const q = new URLSearchParams(location.search);
  const code = q.get('code');
  const err = q.get('error');
  if (!code && !err) return;
  let pkce: { verifier: string; state: string; returnHash: string } | null = null;
  try {
    pkce = JSON.parse(sessionStorage.getItem(SS_PKCE) || 'null');
    sessionStorage.removeItem(SS_PKCE);
  } catch {
    /* ignore */
  }
  const clean = () => history.replaceState(null, '', location.pathname + (pkce?.returnHash || location.hash || ''));
  if (!pkce || q.get('state') !== pkce.state) {
    // not ours (or an old link): leave the URL tidy and carry on
    if (pkce) sessionStorage.setItem(SS_ERROR, 'Spotify sign-in expired. Please try again.');
    clean();
    return;
  }
  try {
    if (err) throw new Error(err === 'access_denied' ? 'You cancelled the Spotify sign-in.' : err);
    saveToken(await tokenRequest({ grant_type: 'authorization_code', code: code!, redirect_uri: redirectUri(), client_id: getClientId(), code_verifier: pkce.verifier }));
  } catch (e) {
    sessionStorage.setItem(SS_ERROR, e instanceof Error ? e.message : String(e));
  }
  clean();
}

async function accessToken(): Promise<string> {
  const t = loadToken();
  if (!t) throw new Error('Not connected to Spotify.');
  if (Date.now() < t.expires) return t.access;
  if (!t.refresh) {
    saveToken(null);
    throw new Error('Your Spotify connection expired. Please connect again.');
  }
  try {
    const next = await tokenRequest({ grant_type: 'refresh_token', refresh_token: t.refresh, client_id: getClientId() });
    saveToken({ ...next, refresh: next.refresh ?? t.refresh });
    return next.access;
  } catch (e) {
    saveToken(null);
    throw e;
  }
}

async function api(path: string): Promise<any> {
  const res = await fetch(path.startsWith('http') ? path : API + path, { headers: { Authorization: `Bearer ${await accessToken()}` } });
  if (res.status === 401) {
    saveToken(null);
    throw new Error('Your Spotify connection expired. Please connect again.');
  }
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    const e = new Error(j.error?.message || `Spotify said no (${res.status})`);
    (e as any).status = res.status;
    throw e;
  }
  return res.json();
}

export async function myPlaylists(): Promise<SpPlaylist[]> {
  const out: SpPlaylist[] = [];
  let next: string | null = '/me/playlists?limit=50';
  while (next && out.length < 1000) {
    const j: any = await api(next);
    for (const p of j.items ?? []) {
      if (!p) continue;
      out.push({
        id: p.id,
        name: p.name,
        image: p.images?.[p.images.length > 1 ? p.images.length - 2 : 0]?.url,
        total: p.tracks?.total ?? p.items?.total ?? 0,
        url: p.external_urls?.spotify ?? `https://open.spotify.com/playlist/${p.id}`,
        owner: p.owner?.display_name ?? '',
      });
    }
    next = j.next;
  }
  return out;
}

export async function playlistTracks(id: string): Promise<SpTrack[]> {
  const out: SpTrack[] = [];
  // Spotify has been renaming this endpoint; try the newer one, then the classic one
  let next: string | null = null;
  for (const first of [`/playlists/${id}/items?limit=100`, `/playlists/${id}/tracks?limit=100`]) {
    try {
      const j = await api(first);
      collect(j, out);
      next = j.next;
      break;
    } catch (e) {
      if ((e as any).status !== 404 && (e as any).status !== 403) throw e;
      if (first.includes('/tracks')) throw e;
    }
  }
  while (next && out.length < 2000) {
    const j: any = await api(next);
    collect(j, out);
    next = j.next;
  }
  return out;
}

function collect(j: any, out: SpTrack[]) {
  for (const it of j.items ?? []) {
    const t = it?.track ?? it?.item;
    if (!t || !t.name) continue; // removed / local files
    out.push({
      title: t.name,
      artist: (t.artists ?? []).map((a: any) => a.name).join(', ') || t.show?.name || '',
      url: t.external_urls?.spotify ?? (t.id ? `https://open.spotify.com/${t.type ?? 'track'}/${t.id}` : ''),
    });
  }
}
