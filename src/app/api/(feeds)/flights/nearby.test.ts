import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadNearby, nearbyUrl, resetNearby, snapAnchor } from './nearby';
import { resetAdsbLolSnapshot } from './adsb-lol';

// Trimmed from api.adsb.lol/v2/lat/51.5/lon/-0.25/dist/250, 2026-10-16.
const EZY = { hex: '4ca7b5', type: 'adsb_icao', flight: 'EZY45TR ', r: 'G-UZHA', t: 'A20N', alt_baro: 36000, gs: 452.1, track: 121.3, squawk: '7700', emergency: 'general', lat: 51.2, lon: 0.4, nac_p: 9 };
const answer = (ac: unknown[]) => new Response(JSON.stringify({ ac, msg: 'No error' }));

afterEach(() => {
  vi.unstubAllGlobals();
  resetNearby();
  resetAdsbLolSnapshot();
});

describe('snapAnchor', () => {
  it('snaps to a quarter degree and wraps longitude', () => {
    expect(snapAnchor(51.48, -0.13)).toEqual({ lat: 51.5, lon: -0.25 });
    expect(snapAnchor(10, 190)).toEqual({ lat: 10, lon: -170 });
    expect(snapAnchor(89, 179.9)).toEqual({ lat: 85, lon: -180 });
  });

  it('asks adsb.lol for the 250 nm circle', () => {
    expect(nearbyUrl({ lat: 51.5, lon: -0.25 })).toBe('https://api.adsb.lol/v2/lat/51.5/lon/-0.25/dist/250');
  });
});

describe('loadNearby', () => {
  it('classifies the rows, keeping the emergency status, and serves a second view nearby from the same read', async () => {
    const fetchMock = vi.fn(async () => answer([EZY]));
    vi.stubGlobal('fetch', fetchMock);
    const first = await loadNearby(51.48, -0.13);
    expect(first.stale).toBe(false);
    expect(first.rows[0]).toMatchObject({ callsign: 'EZY45TR', icao24: '4ca7b5', squawk: '7700', emergency: 'general' });
    await loadNearby(51.51, -0.2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('spaces reads across anchors and answers stale meanwhile', async () => {
    const fetchMock = vi.fn(async () => answer([EZY]));
    vi.stubGlobal('fetch', fetchMock);
    await loadNearby(51.5, -0.25);
    const other = await loadNearby(40.75, -74);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(other).toMatchObject({ rows: [], at: null, stale: true });
  });

  it('backs off after a 429', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 429, headers: { 'retry-after': '60' } }));
    vi.stubGlobal('fetch', fetchMock);
    const now = Date.now();
    expect((await loadNearby(51.5, -0.25, now)).stale).toBe(true);
    await loadNearby(51.5, -0.25, now + 10_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
