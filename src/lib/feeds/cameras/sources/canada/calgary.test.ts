import { afterEach, describe, it, expect, vi } from 'vitest';
import { mapCalgaryCamera, fetchCalgaryCameras, CALGARY_BOUNDS, type CalgaryCamera } from './calgary';

afterEach(() => vi.unstubAllGlobals());

// Trimmed rows from data.calgary.ca/resource/k7p9-kppz.json (2026-10-12).
const tenthStreet = {
  camera_url: { url: 'http://trafficcam.calgary.ca/loc74.jpg', description: 'Camera 75' },
  quadrant: 'NW',
  camera_location: '16 Avenue / 10 Street NW',
  point: { type: 'Point', coordinates: [-114.0849216, 51.0668068] },
  ':@computed_region_4a3i_ccfj': '2',
} as CalgaryCamera;
const crowchild = {
  camera_url: { url: 'https://trafficcam.calgary.ca/loc37.jpg', description: 'Camera 38' },
  quadrant: 'NW',
  camera_location: 'Crowchild Trail / Shaganappi Trail NW',
  point: { type: 'Point', coordinates: [-114.149379, 51.0988494] },
} as CalgaryCamera;

describe('mapCalgaryCamera', () => {
  it('maps a camera to its still over https', () => {
    expect(mapCalgaryCamera(tenthStreet)).toEqual({
      id: 'calgary-loc74',
      lat: 51.0668068,
      lng: -114.0849216,
      name: '16 Avenue / 10 Street NW',
      city: 'Calgary',
      country: 'Canada',
      feed_url: 'https://trafficcam.calgary.ca/loc74.jpg',
      stream_type: 'jpg',
      source: 'City of Calgary',
    });
    expect(mapCalgaryCamera(crowchild)?.feed_url).toBe('https://trafficcam.calgary.ca/loc37.jpg');
  });

  it('drops stills on another host or with an unexpected file name', () => {
    expect(mapCalgaryCamera({ ...tenthStreet, camera_url: { url: 'http://example.com/loc74.jpg' } })).toBeNull();
    expect(mapCalgaryCamera({ ...tenthStreet, camera_url: { url: 'https://trafficcam.calgary.ca/images/loc74.jpg' } })).toBeNull();
    expect(mapCalgaryCamera({ ...tenthStreet, camera_url: null })).toBeNull();
  });

  it('drops unusable coordinates', () => {
    expect(mapCalgaryCamera({ ...tenthStreet, point: { coordinates: [0, 0] } })).toBeNull();
    expect(mapCalgaryCamera({ ...tenthStreet, point: null })).toBeNull();
    expect(mapCalgaryCamera({ ...tenthStreet, point: { coordinates: [-113.4909, 53.5444] } })).toBeNull();
    expect(mapCalgaryCamera(null)).toBeNull();
  });

  it('falls back to the file name when the location is blank', () => {
    expect(mapCalgaryCamera({ ...tenthStreet, camera_location: ' ' })?.name).toBe('Calgary Camera loc74');
  });
});

describe('fetchCalgaryCameras', () => {
  it('maps and dedupes the dataset rows', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json([tenthStreet, crowchild, tenthStreet])));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const cams = await fetchCalgaryCameras();
    expect(cams.map(c => c.id)).toEqual(['calgary-loc74', 'calgary-loc37']);
  });

  it('throws on an HTTP error or an unexpected body', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })));
    await expect(fetchCalgaryCameras()).rejects.toThrow('HTTP 500');
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: true })));
    await expect(fetchCalgaryCameras()).rejects.toThrow('unexpected response');
  });
});

// Live integration test — opt in with RUN_LIVE_TESTS=1.
const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('fetchCalgaryCameras (live)', () => {
  liveIt('fetches the Calgary cameras', async () => {
    const cams = await fetchCalgaryCameras();
    expect(cams.length).toBeGreaterThan(180);
    const b = CALGARY_BOUNDS;
    for (const c of cams) {
      expect(c.lat > b.minLat && c.lat < b.maxLat && c.lng > b.minLng && c.lng < b.maxLng).toBe(true);
      expect(c.feed_url).toMatch(/^https:\/\/trafficcam\.calgary\.ca\/loc\d+\.jpg$/);
    }
  }, 20_000);
});
