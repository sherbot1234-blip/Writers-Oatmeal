/**
 * Cloud sync engine. Pure logic: knows nothing about Supabase or React.
 *
 * Model: every story is one remote document, plus one "__meta" document for
 * library-wide settings. Each side has a version (story.updatedAt). We remember
 * the version both sides agreed on at the last sync ("synced" map), which tells
 * us who changed since. If both changed, the cloud copy wins and the local one
 * is kept as a "conflict copy" so nothing is ever lost.
 *
 * Images are pulled out of the JSON before upload (stored once in a private
 * bucket, keyed by content hash) and put back as data URLs on download, so the
 * rest of the app only ever sees plain data URLs.
 */
import type { Library, Story } from '../types';
import { normalizeStory } from '../defaults';
import { uid } from '../util';

export const META_ID = '__meta';
const IMG_PREFIX = 'cloudimg:';

export interface RemoteDoc {
  id: string;
  updated_at: number;
  deleted: boolean;
  data?: unknown;
}

export interface Backend {
  /** All docs without their data. */
  list(): Promise<RemoteDoc[]>;
  /** Full docs for the given ids. */
  fetch(ids: string[]): Promise<RemoteDoc[]>;
  upsert(docs: RemoteDoc[]): Promise<void>;
  /** Must succeed (no-op) if the image already exists. */
  uploadImage(hash: string, blob: Blob): Promise<void>;
  downloadImage(hash: string): Promise<Blob>;
}

export interface LocalCache {
  getSynced(): Promise<Record<string, number>>;
  setSynced(v: Record<string, number>): Promise<void>;
  getUploaded(): Promise<string[]>;
  setUploaded(v: string[]): Promise<void>;
  getImage(hash: string): Promise<string | undefined>;
  setImage(hash: string, dataUrl: string): Promise<void>;
}

export interface Changes {
  /** Stories to put into the library, with the local version they're allowed to replace. */
  upserts: { story: Story; ifLocalVersion: number | undefined }[];
  removes: { id: string; ifLocalVersion: number | undefined }[];
  conflictCopies: Story[];
  meta?: { siteTitle: string; metaUpdatedAt: number; ifLocalVersion: number };
}

export interface SyncResult {
  changes: Changes;
  pushed: number;
  pulled: number;
  conflicts: number;
}

// ---------- helpers ----------

function b64ToBytes(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64(bytes: Uint8Array) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function parseDataUrl(url: string) {
  const m = url.match(/^data:([^;,]+)(;base64)?,(.*)$/s);
  if (!m) return null;
  const bytes = m[2] ? b64ToBytes(m[3]) : new TextEncoder().encode(decodeURIComponent(m[3]));
  return { mime: m[1], bytes };
}

async function sha256(bytes: Uint8Array) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(d, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Deep-maps every string in a JSON value. */
async function mapStrings(v: unknown, fn: (s: string) => Promise<string>): Promise<unknown> {
  if (typeof v === 'string') return fn(v);
  if (Array.isArray(v)) return Promise.all(v.map((x) => mapStrings(x, fn)));
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) out[k] = await mapStrings(x, fn);
    return out;
  }
  return v;
}

async function extractImages(story: Story, backend: Backend, cache: LocalCache, uploaded: Set<string>) {
  return mapStrings(story, async (s) => {
    if (!s.startsWith('data:image/')) return s;
    const parsed = parseDataUrl(s);
    if (!parsed) return s;
    const hash = await sha256(parsed.bytes);
    if (!uploaded.has(hash)) {
      await backend.uploadImage(hash, new Blob([parsed.bytes], { type: parsed.mime }));
      uploaded.add(hash);
      await cache.setImage(hash, s);
    }
    return IMG_PREFIX + hash;
  });
}

async function restoreImages(data: unknown, backend: Backend, cache: LocalCache, uploaded: Set<string>) {
  return mapStrings(data, async (s) => {
    if (!s.startsWith(IMG_PREFIX)) return s;
    const hash = s.slice(IMG_PREFIX.length);
    const cached = await cache.getImage(hash);
    if (cached) return cached;
    try {
      const blob = await backend.downloadImage(hash);
      const url = `data:${blob.type || 'image/webp'};base64,${bytesToB64(new Uint8Array(await blob.arrayBuffer()))}`;
      await cache.setImage(hash, url);
      uploaded.add(hash);
      return url;
    } catch {
      return ''; // missing image: show nothing rather than failing the whole sync
    }
  });
}

// ---------- main ----------

export async function runSync(lib: Library, backend: Backend, cache: LocalCache): Promise<SyncResult> {
  const remoteList = await backend.list();
  const remote = new Map(remoteList.map((r) => [r.id, r]));
  const synced = await cache.getSynced();
  const uploaded = new Set(await cache.getUploaded());
  const local = new Map(lib.stories.map((s) => [s.id, s]));
  const tomb = lib.tombstones ?? {};

  const changes: Changes = { upserts: [], removes: [], conflictCopies: [] };
  const toPush: { id: string; story?: Story; version: number }[] = [];
  const toPull: string[] = [];
  let conflicts = 0;

  const ids = new Set<string>([...local.keys(), ...Object.keys(tomb), ...remote.keys()]);
  ids.delete(META_ID);

  for (const id of ids) {
    const L = local.get(id);
    const T = L ? undefined : tomb[id];
    const R = remote.get(id);
    const S = synced[id];
    const localVer = L ? L.updatedAt : T;
    const localChanged = localVer !== undefined && localVer !== S;
    const remoteChanged = !!R && R.updated_at !== S;

    if (!R) {
      if (L) toPush.push({ id, story: L, version: L.updatedAt });
      continue; // deleted here and never reached the cloud: nothing to do
    }
    if (!localChanged && !remoteChanged) continue;

    if (localChanged && !remoteChanged) {
      toPush.push({ id, story: L, version: localVer! });
    } else if (!localChanged && remoteChanged) {
      if (R.deleted) {
        if (L) changes.removes.push({ id, ifLocalVersion: L.updatedAt });
        synced[id] = R.updated_at;
      } else toPull.push(id);
    } else {
      // both sides changed since we last agreed
      if (R.deleted && !L) synced[id] = R.updated_at;
      else if (R.deleted && L) toPush.push({ id, story: L, version: L.updatedAt }); // edited here after deletion elsewhere: keep it
      else if (!L) toPull.push(id); // deleted here, edited elsewhere: bring it back
      else if (R.updated_at === L.updatedAt) synced[id] = R.updated_at;
      else {
        toPull.push(id);
        conflicts++;
        const stamp = new Date(L.updatedAt).toLocaleString();
        changes.conflictCopies.push({ ...L, id: uid(), title: `${L.title} (conflict copy, ${stamp})` });
      }
    }
  }

  // library-wide settings
  const rMeta = remote.get(META_ID);
  const lMetaVer = lib.metaUpdatedAt ?? 0;
  const sMeta = synced[META_ID];
  const metaLocalChanged = lMetaVer !== (sMeta ?? 0);
  const metaRemoteChanged = !!rMeta && rMeta.updated_at !== sMeta;
  let pushMeta = false;
  if (!rMeta) pushMeta = true;
  else if (metaRemoteChanged && (!metaLocalChanged || rMeta.updated_at > lMetaVer)) toPull.push(META_ID);
  else if (metaLocalChanged) pushMeta = true;

  // ---- pull ----
  if (toPull.length) {
    const docs = await backend.fetch(toPull);
    for (const d of docs) {
      if (d.id === META_ID) {
        const m = (d.data ?? {}) as { siteTitle?: string };
        changes.meta = { siteTitle: m.siteTitle || lib.siteTitle, metaUpdatedAt: d.updated_at, ifLocalVersion: lMetaVer };
      } else {
        const data = await restoreImages(d.data, backend, cache, uploaded);
        const story = normalizeStory(data as Partial<Story>);
        story.id = d.id;
        story.updatedAt = d.updated_at;
        changes.upserts.push({ story, ifLocalVersion: local.get(d.id)?.updatedAt });
      }
      synced[d.id] = d.updated_at;
    }
  }

  // ---- push ----
  const rows: RemoteDoc[] = [];
  for (const p of toPush) {
    if (p.story) rows.push({ id: p.id, updated_at: p.version, deleted: false, data: await extractImages(p.story, backend, cache, uploaded) });
    else rows.push({ id: p.id, updated_at: p.version, deleted: true, data: null });
  }
  if (pushMeta) rows.push({ id: META_ID, updated_at: lMetaVer, deleted: false, data: { siteTitle: lib.siteTitle } });
  // upload in small batches so one huge story doesn't time out the rest
  for (let i = 0; i < rows.length; i += 5) await backend.upsert(rows.slice(i, i + 5));
  for (const r of rows) synced[r.id] = r.updated_at;

  await cache.setUploaded([...uploaded]);
  await cache.setSynced(synced);
  return { changes, pushed: rows.length, pulled: toPull.length, conflicts };
}

/** Applies remote changes to the newest local library, skipping anything edited locally meanwhile. */
export function applyChanges(lib: Library, c: Changes): Library {
  const stories = [...lib.stories];
  for (const u of c.upserts) {
    const i = stories.findIndex((s) => s.id === u.story.id);
    if (i >= 0) {
      if (stories[i].updatedAt === u.ifLocalVersion) stories[i] = u.story;
    } else if (u.ifLocalVersion === undefined) stories.push(u.story);
  }
  const removeIds = new Set(c.removes.filter((r) => stories.find((s) => s.id === r.id)?.updatedAt === r.ifLocalVersion).map((r) => r.id));
  const kept = stories.filter((s) => !removeIds.has(s.id));
  const next: Library = { ...lib, stories: [...kept, ...c.conflictCopies] };
  if (c.meta && (lib.metaUpdatedAt ?? 0) === c.meta.ifLocalVersion) {
    next.siteTitle = c.meta.siteTitle;
    next.metaUpdatedAt = c.meta.metaUpdatedAt;
  }
  return next;
}

export function hasChanges(c: Changes) {
  return c.upserts.length + c.removes.length + c.conflictCopies.length > 0 || !!c.meta;
}
