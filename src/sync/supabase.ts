import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { get, set } from 'idb-keyval';
import type { Backend, LocalCache, RemoteDoc } from './engine';
import { BUILT_IN_SUPABASE } from '../config';

export interface CloudConfig {
  url: string;
  key: string;
}

const LS_KEY = 'wo-cloud-config';
const BUCKET = 'images';

/** People often paste the API address (…/rest/v1/); the client wants just the project address. */
export const cleanUrl = (u: string) => u.trim().replace(/\/(rest|auth|storage)\/v1\/?.*$/, '').replace(/\/+$/, '');

/** Order of preference: GitHub repo variables, then the address built into the site, then one pasted into the app. */
export function getConfig(): CloudConfig | null {
  const env = import.meta.env as Record<string, string | undefined>;
  if (env.VITE_SUPABASE_URL && env.VITE_SUPABASE_KEY) return { url: cleanUrl(env.VITE_SUPABASE_URL), key: env.VITE_SUPABASE_KEY };
  if (BUILT_IN_SUPABASE.url && BUILT_IN_SUPABASE.key) return { url: cleanUrl(BUILT_IN_SUPABASE.url), key: BUILT_IN_SUPABASE.key };
  try {
    const raw = localStorage.getItem(LS_KEY);
    const c = raw ? (JSON.parse(raw) as CloudConfig) : null;
    return c ? { ...c, url: cleanUrl(c.url) } : null;
  } catch {
    return null;
  }
}

export const configFromBuild = () =>
  !!(import.meta.env as Record<string, string | undefined>).VITE_SUPABASE_URL || !!(BUILT_IN_SUPABASE.url && BUILT_IN_SUPABASE.key);

export function saveConfig(c: CloudConfig | null) {
  try {
    if (c) localStorage.setItem(LS_KEY, JSON.stringify(c));
    else localStorage.removeItem(LS_KEY);
  } catch {
    /* private mode: config just won't persist */
  }
  client = null;
}

let client: SupabaseClient | null = null;
export function getClient(): SupabaseClient | null {
  if (client) return client;
  const c = getConfig();
  if (!c) return null;
  try {
    client = createClient(cleanUrl(c.url), c.key.trim(), { auth: { persistSession: true, autoRefreshToken: true } });
  } catch {
    return null;
  }
  return client;
}

export function makeBackend(sb: SupabaseClient, userId: string): Backend {
  const path = (hash: string) => `${userId}/${hash}`;
  const fail = (what: string, e: { message?: string } | null) => {
    if (e) throw new Error(`${what}: ${e.message ?? 'unknown error'}`);
  };
  return {
    async list() {
      const { data, error } = await sb.from('docs').select('id, updated_at, deleted').range(0, 9999);
      fail('Reading stories', error);
      return (data ?? []).map((r) => ({ ...r, updated_at: Number(r.updated_at) })) as RemoteDoc[];
    },
    async fetch(ids) {
      const out: RemoteDoc[] = [];
      for (let i = 0; i < ids.length; i += 20) {
        const { data, error } = await sb.from('docs').select('id, updated_at, deleted, data').in('id', ids.slice(i, i + 20));
        fail('Downloading stories', error);
        out.push(...((data ?? []).map((r) => ({ ...r, updated_at: Number(r.updated_at) })) as RemoteDoc[]));
      }
      return out;
    },
    async upsert(rows) {
      const { error } = await sb.from('docs').upsert(
        rows.map((r) => ({ ...r, user_id: userId })),
        { onConflict: 'user_id,id' },
      );
      fail('Uploading stories', error);
    },
    async uploadImage(hash, blob) {
      // raw bytes + content type (a Blob would be sent as multipart form data)
      const { error } = await sb.storage.from(BUCKET).upload(path(hash), await blob.arrayBuffer(), { contentType: blob.type || 'image/webp', upsert: false });
      // same content hash = same image, so "already exists" is success
      if (error && !/exist|duplicate/i.test(error.message)) fail('Uploading an image', error);
    },
    async downloadImage(hash) {
      const { data, error } = await sb.storage.from(BUCKET).download(path(hash));
      fail('Downloading an image', error);
      return data!;
    },
  };
}

export function makeCache(userId: string): LocalCache {
  const k = (name: string) => `sync:${userId}:${name}`;
  return {
    getSynced: async () => (await get(k('synced'))) ?? {},
    setSynced: (v) => set(k('synced'), v),
    getUploaded: async () => (await get(k('uploaded'))) ?? [],
    setUploaded: (v) => set(k('uploaded'), v),
    getImage: (h) => get('img:' + h),
    setImage: (h, v) => set('img:' + h, v),
    getBase: (id) => get(k('base:' + id)),
    setBase: (id, v) => set(k('base:' + id), v),
  };
}
