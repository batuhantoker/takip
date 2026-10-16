import { describe, expect, it, vi } from 'vitest';
import type { RtVehicle } from '@/lib/feeds/transit/gtfs/realtime';
import type { TransitFeed } from '@/lib/feeds/transit/select';
import { createFeedCache } from './feed-cache';

const feed: TransitFeed = { id: 'f', name: 'F', kind: 'gtfs-rt', url: 'https://example.invalid/vp.pb', bbox: [0, 0, 1, 1] };
const bus = (id: string): RtVehicle => ({ id, lat: 0.5, lng: 0.5 });

function setup(fetcher: () => Promise<RtVehicle[]>) {
  let t = 1_000_000;
  const spy = vi.fn(fetcher);
  const cache = createFeedCache(spy, { now: () => t });
  return { cache, spy, advance: (ms: number) => { t += ms; } };
}

describe('createFeedCache', () => {
  it('serves one fetch to every caller within the TTL', async () => {
    const { cache, spy, advance } = setup(async () => [bus('a')]);
    const [x, y] = await Promise.all([cache.get(feed), cache.get(feed)]);
    expect(x.vehicles).toEqual([bus('a')]);
    expect(y.vehicles).toEqual([bus('a')]);
    advance(10_000);
    await cache.get(feed);
    expect(spy).toHaveBeenCalledTimes(1);
    advance(6_000);
    await cache.get(feed);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('caches an empty feed like any other', async () => {
    const { cache, spy } = setup(async () => []);
    expect(await cache.get(feed)).toEqual({ vehicles: [], ok: true });
    await cache.get(feed);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('backs off after a failure and keeps serving recent vehicles meanwhile', async () => {
    let fail = false;
    const { cache, spy, advance } = setup(async () => { if (fail) throw new Error('HTTP 503'); return [bus('a')]; });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await cache.get(feed);
    fail = true;
    advance(20_000);
    expect(await cache.get(feed)).toEqual({ vehicles: [bus('a')], ok: true });
    advance(30_000);
    await cache.get(feed);
    expect(spy).toHaveBeenCalledTimes(2);
    // Two minutes after the last good fetch the feed reads as down; the backoff doubles after each failure.
    advance(80_000);
    expect(await cache.get(feed)).toEqual({ vehicles: [], ok: false });
    expect(spy).toHaveBeenCalledTimes(3);
    advance(60_000);
    await cache.get(feed);
    expect(spy).toHaveBeenCalledTimes(3);
    advance(70_000);
    await cache.get(feed);
    expect(spy).toHaveBeenCalledTimes(4);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('answers without waiting longer than asked for a slow feed', async () => {
    const { cache } = setup(() => new Promise(() => {}));
    expect(await cache.get(feed, 5)).toEqual({ vehicles: [], ok: true });
  });
});
