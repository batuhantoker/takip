import { lonLatToTile, tileBbox } from '@takip/core/tiles';
import { encodeTrk1, decodeTrk1 } from '@takip/core/trk';
import { describe, expect, it, vi } from 'vitest';
import { createReplayClock } from './clock';
import { chunkUrls, createReplaySession, type Manifest, normaliseBbox } from './session';
import { BRIDGE_S, HOLD_S, type ReplayEntity, sampleEntity } from './track-layer';
import { bearing, sampleAt, trailTo } from './track-math';

const T = 1_791_810_000;
const track = decodeTrk1(encodeTrk1([
  { t: T, lon: 10, lat: 50, heading: 350 },
  { t: T + 60, lon: 11, lat: 50, heading: 10 },
  { t: T + 120, lon: 12, lat: 51, heading: 30 },
]));

describe('sampleAt', () => {
  it('interpolates position and heading the short way round', () => {
    const s = sampleAt(track, T + 30)!;
    expect(s.lon).toBeCloseTo(10.5, 5);
    expect(s.age).toBe(0);
    // 350° → 10° passes through north, not back through 180°.
    expect([359, 0, 1].some(h => Math.abs(s.heading - h) < 1.5)).toBe(true);
  });

  it('is absent before the track and held at its last fix after it, with an age', () => {
    expect(sampleAt(track, T - 1)).toBeNull();
    expect(sampleAt(track, T + 300)).toMatchObject({ lon: 12, lat: 51, age: 180 });
  });

  it('falls back to the bearing when a track carries no heading', () => {
    const plain = decodeTrk1(encodeTrk1([{ t: T, lon: 0, lat: 0 }, { t: T + 60, lon: 1, lat: 0 }]));
    expect(sampleAt(plain, T + 10)!.heading).toBeCloseTo(90, 3);
    expect(bearing(0, 0, 0, 1)).toBeCloseTo(0, 5);
  });
});

describe('trailTo', () => {
  it('covers the trail window and ends at the current position', () => {
    const here = sampleAt(track, T + 90)!;
    expect(trailTo(track, T + 90, 60, here)).toEqual([[11, 50], [here.lon, here.lat]]);
  });
});

describe('createReplayClock', () => {
  it('advances at its speed, never past now, and stops when it gets there', () => {
    let now = 1_000_000;
    const frames: ((ms: number) => void)[] = [];
    const clock = createReplayClock(now - 60_000, { now: () => now, frame: cb => frames.push(cb), cancelFrame: () => {} });
    let changes = 0;
    clock.subscribe(() => changes++);
    clock.setSpeed(10);
    clock.play();
    frames.shift()!(0);
    frames.shift()!(1000);
    expect(clock.time()).toBe(now - 50_000);
    frames.shift()!(6000);
    expect(clock.time()).toBe(now);
    expect(clock.playing()).toBe(false);
    expect(frames).toHaveLength(0);
    expect(changes).toBeGreaterThan(2);
    now += 5000;
    clock.seek(now + 99_999);
    expect(clock.time()).toBe(now);
  });
});

describe('chunk selection', () => {
  const manifest = {
    token: 'tok',
    tracks: {
      url: '/api/replay/tracks/{class}/{lod}/{z}/{x}/{y}/{bucket}.bin?v={v}&p=tok',
      categories: { vessel: [], aircraft: [] },
      lods: [{ lod: 0, bucketS: 3600, fetchZoom: 7, buckets: [[T, 11, 0], [T + 3600, 22, 1], [T + 7200, 33, 1]] }],
    },
  } as unknown as Manifest;

  it('splits a view across the antimeridian and keeps a world view whole', () => {
    expect(normaliseBbox({ w: 170, s: 0, e: 190, n: 10 })).toEqual([{ w: 170, s: 0, e: 180, n: 10 }, { w: -180, s: 0, e: -170, n: 10 }]);
    expect(normaliseBbox({ w: -400, s: -95, e: 400, n: 95 })).toEqual([{ w: -180, s: -90, e: 180, n: 90 }]);
  });

  it('asks only for sealed buckets overlapping the window, with their versions and the token', () => {
    // A view well inside one z7 tile.
    const { x, y } = lonLatToTile(29, 41, 7);
    const b = tileBbox(7, x, y);
    const view = { w: b.w + 0.1, s: b.s + 0.1, e: b.e - 0.1, n: b.n - 0.1 };
    const urls = chunkUrls(manifest, 0, view, T + 3600 - 600, T + 3700, ['aircraft'])!;
    expect(urls).toEqual([
      `/api/replay/tracks/aircraft/0/7/${x}/${y}/${T}.bin?v=11&p=tok`,
      `/api/replay/tracks/aircraft/0/7/${x}/${y}/${T + 3600}.bin?v=22&p=tok`,
    ]);
  });

  it('refuses a view that would need too many tiles at this level', () => {
    expect(chunkUrls(manifest, 0, { w: -180, s: -85, e: 180, n: 85 }, T, T, ['vessel'])).toBeNull();
  });
});

describe('createReplaySession', () => {
  it('reports a rate-limited chunk with its Retry-After, then fetches it again', async () => {
    vi.stubGlobal('requestAnimationFrame', () => 0);
    vi.stubGlobal('cancelAnimationFrame', () => {});
    let chunkCalls = 0;
    const get = vi.fn(async (url: string | URL | Request) => {
      if (String(url).startsWith('/api/replay/manifest')) return Response.json({ from: 0, to: 9e9, tracks: { categories: { vessel: [], aircraft: [] } } });
      chunkCalls++;
      return chunkCalls === 1
        ? new Response(JSON.stringify({ error: 'rate_limited', retry_after: 3 }), { status: 429, headers: { 'retry-after': '3' } })
        : new Response(new Uint8Array([0x54, 0x52, 0x4b, 0x43, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
    });
    const session = createReplaySession(Date.now() - 3_600_000, get as typeof fetch);
    expect(await session.tracks(['/chunk'])).toEqual({ tracks: [], retryAfterMs: 3000 });
    expect(await session.tracks(['/chunk'])).toEqual({ tracks: [], retryAfterMs: undefined });
    expect(chunkCalls).toBe(2);
    session.dispose();
    vi.unstubAllGlobals();
  });
});

describe('sampleEntity', () => {
  const seg = (t0: number, lon0: number, t1: number, lon1: number) => decodeTrk1(encodeTrk1([{ t: t0, lon: lon0, lat: 0 }, { t: t1, lon: lon1, lat: 0 }]));
  // Polled every 15 minutes: two one-minute segments with a 14-minute silence between them.
  const plane: ReplayEntity = { entity: 1, cls: 'aircraft', category: 'commercial', label: '', color: [1, 1, 1], segs: [seg(T, 0, T + 60, 0.1), seg(T + 900, 1.5, T + 960, 1.6)] };

  it('is measured inside a segment', () => {
    expect(sampleEntity(plane, T + 30)).toMatchObject({ lon: 0.05, alpha: 1 });
  });

  it('bridges a short silence between segments, dimmer, heading for the next fix', () => {
    const s = sampleEntity(plane, T + 480)!;
    expect(s.lon).toBeCloseTo(0.8, 5);
    expect(s.alpha).toBe(0.7);
    expect(s.heading).toBeCloseTo(90, 0);
  });

  it('holds at the last fix after a track ends, fading, then lets it go', () => {
    const held = sampleEntity(plane, T + 960 + HOLD_S / 2)!;
    expect(held).toMatchObject({ lon: 1.6 });
    expect(held.alpha).toBeLessThan(0.8);
    expect(sampleEntity(plane, T + 960 + HOLD_S + 1)).toBeNull();
  });

  it('does not bridge a silence longer than the limit', () => {
    const long: ReplayEntity = { ...plane, segs: [seg(T, 0, T + 60, 0.1), seg(T + 60 + BRIDGE_S + 600, 5, T + 60 + BRIDGE_S + 660, 5.1)] };
    expect(sampleEntity(long, T + 60 + BRIDGE_S)).toBeNull();
  });
});
