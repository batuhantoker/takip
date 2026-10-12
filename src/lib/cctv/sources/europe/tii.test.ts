import { afterEach, describe, it, expect, vi } from 'vitest';
import { mapTiiCamera, fetchTiiCameras, TII_BOUNDS } from './tii';
import type { CarsFeature } from '@/lib/cctv/sources/platforms/cars';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// Trimmed mapFeatures from traffic.tii.ie/api/graphql (2026-10-12).
const reaghstown = {
  title: 'Reaghstown', uri: 'camera/91',
  features: [{ geometry: { type: 'Point', coordinates: [-6.64806, 53.92972] } }],
  __typename: 'Camera', active: true,
  views: [{ category: 'IMAGE', url: 'https://irecam.carsprogram.org/Vaisala/1681_cam1.jpeg?1791830520000' }],
} as unknown as CarsFeature;
const m50Slip = {
  title: 'M50(S) On Slip From M1(S)', uri: 'camera/300',
  features: [{ geometry: { type: 'Point', coordinates: [-6.22477, 53.41061] } }],
  __typename: 'Camera', active: true,
  views: [
    { category: 'IMAGE', url: 'https://irecam.carsprogram.org/Kapsch/time_logo_cctv-107.jpg?1791830520000' },
    { category: 'IMAGE', url: 'https://irecam.carsprogram.org/Kapsch/time_logo_cctv-108.jpg?1791830520000' },
  ],
} as unknown as CarsFeature;
const bloomfield = {
  title: 'N40 at J9 (Bloomfield) - West', uri: 'camera/313',
  features: [{ geometry: { type: 'Point', coordinates: [-8.41982, 51.8802] } }],
  __typename: 'Camera', active: true,
  views: [{ category: 'IMAGE', url: 'https://irecam.carsprogram.org/IBI/11_N40_J9_W.jpg?1791830520000' }],
} as unknown as CarsFeature;

describe('mapTiiCamera', () => {
  it('maps a camera to its still, minus the cache-buster', () => {
    expect(mapTiiCamera(reaghstown)).toEqual({
      id: 'tii-91',
      lat: 53.92972,
      lng: -6.64806,
      name: 'Reaghstown',
      city: 'Ireland',
      country: 'Ireland',
      feed_url: 'https://irecam.carsprogram.org/Vaisala/1681_cam1.jpeg',
      stream_type: 'jpg',
      external_url: 'https://traffic.tii.ie/@53.92972,-6.64806,14?show=camera%2F91',
      source: 'TII',
    });
    expect(mapTiiCamera(bloomfield)?.feed_url).toBe('https://irecam.carsprogram.org/IBI/11_N40_J9_W.jpg');
  });

  it('makes one camera per view', () => {
    expect(mapTiiCamera(m50Slip, 0)).toMatchObject({
      id: 'tii-300', name: 'M50(S) On Slip From M1(S) – view 1',
      feed_url: 'https://irecam.carsprogram.org/Kapsch/time_logo_cctv-107.jpg',
    });
    expect(mapTiiCamera(m50Slip, 1)).toMatchObject({
      id: 'tii-300-2', name: 'M50(S) On Slip From M1(S) – view 2',
      feed_url: 'https://irecam.carsprogram.org/Kapsch/time_logo_cctv-108.jpg',
    });
    expect(mapTiiCamera(m50Slip, 2)).toBeNull();
  });

  it('drops inactive cameras, other feature types and unusable views', () => {
    expect(mapTiiCamera({ ...reaghstown, active: false })).toBeNull();
    expect(mapTiiCamera({ ...reaghstown, __typename: 'Sign' })).toBeNull();
    expect(mapTiiCamera({ ...reaghstown, uri: 'sign/91' })).toBeNull();
    expect(mapTiiCamera({ ...reaghstown, views: [{ category: 'IMAGE', url: '/images/camera-down.png' }] })).toBeNull();
    expect(mapTiiCamera({ ...reaghstown, views: [{ category: 'IMAGE', url: 'http://irecam.carsprogram.org/Vaisala/1681_cam1.jpeg' }] })).toBeNull();
    expect(mapTiiCamera({ ...reaghstown, views: [{ category: 'VIDEO', url: 'https://irecam.carsprogram.org/Vaisala/1681_cam1.jpeg' }] })).toBeNull();
    expect(mapTiiCamera({ ...reaghstown, views: [] })).toBeNull();
    expect(mapTiiCamera(null)).toBeNull();
  });

  it('drops unusable coordinates', () => {
    expect(mapTiiCamera({ ...reaghstown, features: [{ geometry: { coordinates: [0, 0] } }] })).toBeNull();
    expect(mapTiiCamera({ ...reaghstown, features: [{ geometry: { coordinates: [-0.1276, 51.5072] } }] })).toBeNull();
    expect(mapTiiCamera({ ...reaghstown, features: [] })).toBeNull();
  });

  it('tidies the title and falls back to the id', () => {
    expect(mapTiiCamera({ ...reaghstown, title: 'N4(W)  At J2 (Liffey Valley) - South' })?.name).toBe('N4(W) At J2 (Liffey Valley) - South');
    expect(mapTiiCamera({ ...reaghstown, title: ' R463 Scariff' })?.name).toBe('R463 Scariff');
    expect(mapTiiCamera({ ...reaghstown, title: null })?.name).toBe('TII Camera 91');
  });
});

describe('fetchTiiCameras', () => {
  const many = (n: number) => Array.from({ length: n }, (_, i) => ({ ...reaghstown, uri: `camera/${1000 + i}` }));

  it('posts one honest query and maps every view, deduped', async () => {
    const fetch = vi.fn(async () => Response.json({ data: { mapFeaturesQuery: { mapFeatures: [...many(160), m50Slip, reaghstown, reaghstown], error: null } } }));
    vi.stubGlobal('fetch', fetch);
    vi.spyOn(console, 'log').mockImplementation(() => {});

    const cams = await fetchTiiCameras();

    expect(cams).toHaveLength(163);
    expect(cams.map(c => c.id)).toEqual(expect.arrayContaining(['tii-91', 'tii-300', 'tii-300-2']));
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://traffic.tii.ie/api/graphql');
    expect(Object.keys(init.headers as Record<string, string>)).not.toContain('Referer');
    expect(JSON.parse(String(init.body)).variables.input).toMatchObject({ north: 55.5, south: 51.3, layerSlugs: ['normalCameras'] });
  });

  it('throws on an HTTP error, a GraphQL error or a short read', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 502 })));
    await expect(fetchTiiCameras()).rejects.toThrow('HTTP 502');
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ data: { mapFeaturesQuery: { mapFeatures: null, error: { message: 'bad input' } } } })));
    await expect(fetchTiiCameras()).rejects.toThrow('bad input');
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ data: { mapFeaturesQuery: { mapFeatures: [reaghstown] } } })));
    await expect(fetchTiiCameras()).rejects.toThrow('short read: 1');
  });
});

// Live integration test — opt in with RUN_LIVE_TESTS=1.
const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('fetchTiiCameras (live)', () => {
  liveIt('fetches the TII cameras', async () => {
    const cams = await fetchTiiCameras();
    expect(cams.length).toBeGreaterThan(200);
    expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
    const b = TII_BOUNDS;
    for (const c of cams) {
      expect(c.lat > b.minLat && c.lat < b.maxLat && c.lng > b.minLng && c.lng < b.maxLng).toBe(true);
      expect(c.feed_url).toMatch(/^https:\/\/irecam\.carsprogram\.org\//);
    }
  }, 20_000);
});
