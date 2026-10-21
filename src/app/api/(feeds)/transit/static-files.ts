import type { TransitFeed } from '@/lib/feeds/transit/select';

const RETRY_MS = 10 * 60_000;

/**
 * Files from a feed's static GTFS, loaded on first use and held for the `max` most recently used feeds.
 * A feed whose load failed is not asked again for RETRY_MS.
 */
export function staticFiles<T>(what: string, max: number, load: (feed: TransitFeed) => Promise<T | null>) {
  const files = new Map<string, Promise<T | null>>();
  const failed = new Map<string, number>();
  return (feed: TransitFeed): Promise<T | null> => {
    const hit = files.get(feed.id);
    if (hit) {
      files.delete(feed.id);
      files.set(feed.id, hit);
      return hit;
    }
    if (Date.now() - (failed.get(feed.id) ?? 0) < RETRY_MS) return Promise.resolve(null);
    const p = load(feed).catch(err => {
      console.warn(`[TAKIP] transit ${what} for ${feed.id}: ${err instanceof Error ? err.message : String(err)}`);
      failed.set(feed.id, Date.now());
      files.delete(feed.id);
      return null;
    });
    files.set(feed.id, p);
    while (files.size > max) files.delete(files.keys().next().value!);
    return p;
  };
}

/** Each key's answer, worked out once; the oldest are let go past `max`. */
export function memo<T>(max: number) {
  const hits = new Map<string, Promise<T>>();
  return (key: string, work: () => Promise<T>): Promise<T> => {
    let hit = hits.get(key);
    if (!hit) {
      hit = work();
      hits.set(key, hit);
      while (hits.size > max) hits.delete(hits.keys().next().value!);
    }
    return hit;
  };
}
