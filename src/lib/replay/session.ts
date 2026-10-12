import { type Bbox, tilesForBbox } from '@takip/core/tiles';
import { LODS, type Lod } from '@takip/core/tracks';
import { decodeChunk, decodeTrk1, type DecodedTrack } from '@takip/core/trk';
import { createReplayClock, type ReplayClock } from './clock';

/* What the browser keeps while replaying: the clock, the manifest around it, and decoded chunks. */

export type CoverageSpan = { source: string; from: number; to: number | null; status: 'ok' | 'degraded' | 'down' | 'not_recording' };

export type Manifest = {
  now: number;
  from: number;
  to: number;
  token: string;
  limits: { lookbackDays: number; windowHours: number; earliest: number };
  tracks: {
    url: string;
    categories: { vessel: string[]; aircraft: string[] };
    lods: { lod: Lod; bucketS: number; fetchZoom: number; buckets: [number, number, number][] }[];
  };
  coverage: CoverageSpan[];
  attribution: string[];
};

export type ReplayTrack = {
  key: string;
  entity: number;
  cls: 'vessel' | 'aircraft';
  category: string;
  label: string;
  track: DecodedTrack;
};

/** Up to this many chunks stay decoded; a chunk is one tile-hour at L0. */
const CHUNK_CACHE = 400;
/** Tiles per view beyond which a level would fetch too much; the map then waits for a closer zoom. */
const MAX_TILES = 24;
const MANIFEST_REFRESH_MS = 60_000;

/** Longitudes inside [-180, 180]; a view across the antimeridian becomes two boxes. */
export function normaliseBbox({ w, s, e, n }: Bbox): Bbox[] {
  const south = Math.max(-90, s);
  const north = Math.min(90, n);
  if (e - w >= 360) return [{ w: -180, s: south, e: 180, n: north }];
  const wrap = (x: number) => ((((x + 180) % 360) + 360) % 360) - 180;
  const west = wrap(w);
  const east = wrap(e);
  return west <= east
    ? [{ w: west, s: south, e: east, n: north }]
    : [{ w: west, s: south, e: 180, n: north }, { w: -180, s: south, e: east, n: north }];
}

/** Chunk URLs for a view: the tiles of `lod` covering it, for the sealed buckets overlapping [fromS, toS]. */
export function chunkUrls(manifest: Manifest, lod: Lod, view: Bbox, fromS: number, toS: number, classes: ('vessel' | 'aircraft')[]): string[] | null {
  const level = manifest.tracks.lods.find(l => l.lod === lod);
  if (!level) return [];
  const tiles = new Map<string, { x: number; y: number }>();
  for (const box of normaliseBbox(view)) for (const t of tilesForBbox(box, level.fetchZoom)) tiles.set(`${t.x}/${t.y}`, t);
  if (tiles.size > MAX_TILES) return null;
  const buckets = level.buckets.filter(([b]) => b + level.bucketS > fromS && b <= toS);
  const urls: string[] = [];
  for (const cls of classes) {
    for (const [bucket, v] of buckets) {
      for (const { x, y } of tiles.values()) {
        urls.push(manifest.tracks.url
          .replace('{class}', cls).replace('{lod}', String(lod)).replace('{z}', String(level.fetchZoom))
          .replace('{x}', String(x)).replace('{y}', String(y)).replace('{bucket}', String(bucket)).replace('{v}', String(v)));
      }
    }
  }
  return urls;
}

/** What the map layer drew at the last frame, for the timeline to show. */
export type ReplayStats = { shown: number; state: 'ok' | 'loading' | 'zoom_in' | 'nothing_recorded' | 'before_window' | 'nothing_selected' };

export type ReplaySession = {
  clock: ReplayClock;
  stats(): ReplayStats;
  setStats(stats: ReplayStats): void;
  manifest(): Manifest | null;
  /** The manifest changed, or a fetch failed. */
  subscribe(listener: () => void): () => void;
  error(): string | null;
  /**
   * Tracks of the given chunk URLs, de-duplicated across tile edges. `retryAfterMs` is set when the api
   * rate-limited some of them: ask again after it and only those are fetched.
   */
  tracks(urls: string[]): Promise<{ tracks: ReplayTrack[]; retryAfterMs?: number }>;
  dispose(): void;
};

export function createReplaySession(start: number, get: typeof fetch = fetch): ReplaySession {
  const clock = createReplayClock(start);
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach(l => l());
  const chunks = new Map<string, Promise<ReplayTrack[]>>();
  let manifest: Manifest | null = null;
  let error: string | null = null;
  let loading: Promise<void> | null = null;
  let loadedAt = 0;
  let retryAt = 0;
  let disposed = false;
  let stats: ReplayStats = { shown: 0, state: 'loading' };

  const loadManifest = async () => {
    const t = clock.time() / 1000;
    try {
      const res = await get(`/api/replay/manifest?from=${Math.floor(t - 3 * 3600)}&to=${Math.ceil(t + 3 * 3600)}`, { cache: 'no-store' });
      if (res.status === 429) {
        retryAt = Date.now() + retryAfterMs(res);
        return;
      }
      const body = await res.json();
      if (!res.ok) throw new Error(body.message ?? body.error ?? `replay manifest: HTTP ${res.status}`);
      manifest = body as Manifest;
      error = null;
    } catch (e) {
      error = (e as Error).message;
    }
    loadedAt = Date.now();
    if (!disposed) emit();
  };

  // A fresh manifest when the clock leaves the one we have, and every minute for new provisional versions.
  const check = () => {
    const t = clock.time() / 1000;
    // Before the caller's replay window nothing is recorded, so a time there needs no new manifest.
    const outside = manifest && t >= manifest.limits.earliest && (t < manifest.from || t > manifest.to);
    const stale = !manifest || outside || Date.now() - loadedAt > MANIFEST_REFRESH_MS;
    if (stale && !loading && Date.now() - loadedAt > 2000 && Date.now() >= retryAt) loading = loadManifest().finally(() => { loading = null; });
  };
  const unsubscribe = clock.subscribe(check);
  const timer = setInterval(check, 10_000);
  check();

  const fetchChunk = (url: string): Promise<ReplayTrack[]> => {
    const hit = chunks.get(url);
    if (hit) {
      chunks.delete(url);
      chunks.set(url, hit);
      return hit;
    }
    const loadingChunk = get(url).then(async res => {
      if (res.status === 429) throw new RateLimited(retryAfterMs(res));
      if (!res.ok) throw new Error(`replay chunk: HTTP ${res.status}`);
      const m = manifest;
      const { bucket, records } = decodeChunk(new Uint8Array(await res.arrayBuffer()));
      return records.map(r => {
        const cls = r.cls === 1 ? 'vessel' : 'aircraft';
        return {
          key: `${r.entity}:${bucket}:${r.part}`,
          entity: r.entity,
          cls,
          category: m?.tracks.categories[cls][r.category] ?? 'other',
          label: r.label,
          track: decodeTrk1(r.blob),
        } satisfies ReplayTrack;
      });
    });
    loadingChunk.catch(() => chunks.delete(url));
    chunks.set(url, loadingChunk);
    while (chunks.size > CHUNK_CACHE) chunks.delete(chunks.keys().next().value!);
    return loadingChunk;
  };

  return {
    clock,
    stats: () => stats,
    setStats(next) {
      if (next.shown === stats.shown && next.state === stats.state) return;
      stats = next;
      emit();
    },
    manifest: () => manifest,
    error: () => error,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async tracks(urls) {
      const lists = await Promise.allSettled(urls.map(fetchChunk));
      const byKey = new Map<string, ReplayTrack>();
      let retry: number | undefined;
      for (const list of lists) {
        if (list.status === 'fulfilled') for (const t of list.value) byKey.set(t.key, t);
        else if (list.reason instanceof RateLimited) retry = Math.max(retry ?? 0, list.reason.afterMs);
      }
      return { tracks: [...byKey.values()], retryAfterMs: retry };
    },
    dispose() {
      disposed = true;
      unsubscribe();
      clearInterval(timer);
      clock.dispose();
      listeners.clear();
      chunks.clear();
    },
  };
}

export const lodBucketS = (lod: Lod) => LODS[lod].bucketMs / 1000;

class RateLimited extends Error {
  constructor(readonly afterMs: number) {
    super('rate limited');
  }
}

/** The api's Retry-After, in seconds; a second when it doesn't say. */
const retryAfterMs = (res: Response) => Math.max(1, Number(res.headers.get('retry-after')) || 1) * 1000;
