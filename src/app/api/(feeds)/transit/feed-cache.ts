import { createPool } from '@/lib/core/net/fetch-pool';
import type { RtVehicle } from '@/lib/feeds/transit/gtfs/realtime';
import type { TransitFeed } from '@/lib/feeds/transit/select';

/** One fetch of a feed serves every viewer this long; most agencies refresh every 10–30 s. */
const TTL_MS: Record<TransitFeed['kind'], number> = { 'gtfs-rt': 15_000, iett: 30_000, lametro: 15_000, cta: 30_000, tfl: 30_000, hafas: 30_000, fgc: 30_000, scheduled: 15_000 };
/** After a failure the last good vehicles are served this long, then the feed reads as down. */
const STALE_MS = 2 * 60_000;
const BACKOFF_MS = 60_000;
const MAX_BACKOFF_MS = 10 * 60_000;
/** A feed nobody has looked at for this long is forgotten. */
const IDLE_MS = 10 * 60_000;

interface Entry {
  at: number;
  vehicles: RtVehicle[];
  failures: number;
  retryAt: number;
  usedAt: number;
  inflight: Promise<void> | null;
}

export interface FeedState {
  vehicles: RtVehicle[];
  ok: boolean;
}

type Fetcher = (feed: TransitFeed, signal: AbortSignal) => Promise<RtVehicle[]>;

/**
 * Per-feed memo, not `cachedSource`: an empty feed is a normal answer at night and must be
 * cached like any other. A failing feed backs off, so a dead entry costs one call per backoff.
 */
export function createFeedCache(fetcher: Fetcher, { now = Date.now, workers = 6, timeoutMs = 10_000 } = {}) {
  const pool = createPool(workers);
  const entries = new Map<string, Entry>();

  const refresh = (feed: TransitFeed, e: Entry) => {
    // The timeout starts when the pool runs the call, not while it queues.
    e.inflight = pool.run(() => fetcher(feed, AbortSignal.timeout(timeoutMs)))
      .then(vehicles => {
        Object.assign(e, { at: now(), vehicles, failures: 0, retryAt: 0 });
      })
      .catch(err => {
        e.failures++;
        e.retryAt = now() + Math.min(BACKOFF_MS * 2 ** (e.failures - 1), MAX_BACKOFF_MS);
        if (e.failures === 1) console.warn(`[TAKIP] transit feed ${feed.id} failed: ${err instanceof Error ? err.message : String(err)}`);
      })
      .finally(() => { e.inflight = null; });
  };

  const forgetIdle = (t: number) => {
    for (const [id, e] of entries) if (!e.inflight && t - e.usedAt > IDLE_MS) entries.delete(id);
  };

  /** The feed's vehicles, refreshed if due; waits at most `waitMs` for the refresh, then serves what it has. */
  async function get(feed: TransitFeed, waitMs = 6_000): Promise<FeedState> {
    const t = now();
    forgetIdle(t);
    let e = entries.get(feed.id);
    if (!e) entries.set(feed.id, (e = { at: 0, vehicles: [], failures: 0, retryAt: 0, usedAt: t, inflight: null }));
    e.usedAt = t;
    if (!e.inflight && t - e.at >= TTL_MS[feed.kind] && t >= e.retryAt) refresh(feed, e);
    if (e.inflight) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([e.inflight, new Promise<void>(r => { timer = setTimeout(r, waitMs); })]);
      clearTimeout(timer);
    }
    const recent = e.at > 0 && now() - e.at < STALE_MS;
    return { vehicles: e.failures === 0 || recent ? e.vehicles : [], ok: e.failures === 0 || recent };
  }

  return { get };
}
