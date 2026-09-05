import { get, set, keys, del, createStore } from 'idb-keyval';

const cacheStore = createStore('ecm-voice', 'clips');

export interface CachedClip {
  samples: Float32Array;
  sampleRate: number;
  durationSec: number;
  createdAt: number;
}

const MAX_CACHE_ENTRIES = 400;

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function cacheKeyFor(voice: string, speed: number, text: string): Promise<string> {
  return sha256(`${voice}|${speed.toFixed(2)}|${text.trim()}`);
}

export async function getCachedClip(key: string): Promise<CachedClip | undefined> {
  return get<CachedClip>(key, cacheStore);
}

export async function putCachedClip(key: string, clip: Omit<CachedClip, 'createdAt'>): Promise<void> {
  await set(key, { ...clip, createdAt: Date.now() }, cacheStore);
  void evictOldestIfOverCap();
}

/** Best-effort trim once the cache grows past MAX_CACHE_ENTRIES — never blocks a save. */
async function evictOldestIfOverCap(): Promise<void> {
  try {
    const allKeys = await keys(cacheStore);
    if (allKeys.length <= MAX_CACHE_ENTRIES) return;
    const entries = await Promise.all(
      allKeys.map(async (k) => ({ key: k, item: await get<CachedClip>(k, cacheStore) }))
    );
    entries.sort((a, b) => (a.item?.createdAt ?? 0) - (b.item?.createdAt ?? 0));
    const overflow = entries.length - MAX_CACHE_ENTRIES;
    for (let i = 0; i < overflow; i++) await del(entries[i].key, cacheStore);
  } catch {
    // Non-critical housekeeping — ignore failures.
  }
}
