import { afterEach, describe, it, expect, vi } from 'vitest';
import { stealthFetch } from '@/lib/core/net/stealth-fetch';
import { mapKcScoutCamera, fetchKcScoutCameras, KC_SCOUT_BOUNDS, type KcScoutCamera } from './kcscout';

vi.mock('@/lib/core/net/stealth-fetch', () => ({ stealthFetch: vi.fn() }));
afterEach(() => vi.restoreAllMocks());

// Trimmed rows from kcscout.net/DataProvider.asmx/LoadEntities (2026-10-13).
const stadium: KcScoutCamera = { ID: 'M435SBC-13', OnStreetName: 'I-435 SB At Stadium Dr', Latitude: 39.0477, Longitude: -94.4891 };
const antioch: KcScoutCamera = { ID: 'K435EBC-06', OnStreetName: 'I-435 EB At Antioch Rd', Latitude: 38.934232, Longitude: -94.690704 };
const parked: KcScoutCamera = { ID: 'P001', OnStreetName: 'Spare', Latitude: 0, Longitude: 0 };

describe('mapKcScoutCamera', () => {
  it('maps a Missouri-side camera to its snapshot', () => {
    expect(mapKcScoutCamera(stadium)).toEqual({
      id: 'kcscout-M435SBC-13',
      lat: 39.0477,
      lng: -94.4891,
      name: 'I-435 SB At Stadium Dr',
      city: 'Kansas City area, Missouri',
      country: 'US',
      feed_url: 'https://www.kcscout.net/TransSuite.VCS.CameraSnapshots/M435SBC-13.jpg',
      stream_type: 'jpg',
      source: 'KC Scout',
    });
  });

  it('leaves Kansas-side rows to KanDrive and drops parked ones', () => {
    expect(mapKcScoutCamera(antioch)).toBeNull();
    expect(mapKcScoutCamera(parked)).toBeNull();
  });

  it('drops unsafe ids and unusable coordinates', () => {
    expect(mapKcScoutCamera({ ...stadium, ID: 'M/../x' })).toBeNull();
    expect(mapKcScoutCamera({ ...stadium, Latitude: null })).toBeNull();
    expect(mapKcScoutCamera({ ...stadium, Latitude: 0, Longitude: 0 })).toBeNull();
    expect(mapKcScoutCamera(null)).toBeNull();
  });

  it('falls back to the id for a blank name', () => {
    expect(mapKcScoutCamera({ ...stadium, OnStreetName: ' ' })?.name).toBe('KC Scout Camera M435SBC-13');
  });
});

describe('fetchKcScoutCameras', () => {
  const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ ...stadium, ID: `M${i}` }));

  it('reads the entity list and dedupes', async () => {
    vi.mocked(stealthFetch).mockResolvedValue(Response.json({ d: { Camera: [...rows(150), ...rows(10), antioch, parked] } }));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await fetchKcScoutCameras()).toHaveLength(150);
    expect(vi.mocked(stealthFetch).mock.calls[0][1]).toMatchObject({ method: 'POST', body: '{}' });
  });

  it('throws on an HTTP error, an odd body or a short read', async () => {
    vi.mocked(stealthFetch).mockResolvedValue(new Response('', { status: 500 }));
    await expect(fetchKcScoutCameras()).rejects.toThrow('HTTP 500');
    vi.mocked(stealthFetch).mockResolvedValue(Response.json({ d: {} }));
    await expect(fetchKcScoutCameras()).rejects.toThrow('unexpected response');
    vi.mocked(stealthFetch).mockResolvedValue(Response.json({ d: { Camera: rows(20) } }));
    await expect(fetchKcScoutCameras()).rejects.toThrow('short read: 20');
  });
});

// Live integration test — opt in with RUN_LIVE_TESTS=1.
const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('fetchKcScoutCameras (live)', () => {
  liveIt('fetches the Missouri-side cameras', async () => {
    const { stealthFetch: real } = await vi.importActual<typeof import('@/lib/core/net/stealth-fetch')>('@/lib/core/net/stealth-fetch');
    vi.mocked(stealthFetch).mockImplementation(real);
    const cams = await fetchKcScoutCameras();
    expect(cams.length).toBeGreaterThan(150);
    const b = KC_SCOUT_BOUNDS;
    for (const c of cams) expect(c.lat > b.minLat && c.lat < b.maxLat && c.lng > b.minLng && c.lng < b.maxLng).toBe(true);
  }, 30_000);
});
