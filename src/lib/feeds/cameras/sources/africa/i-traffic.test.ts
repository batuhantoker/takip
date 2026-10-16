import { afterEach, describe, it, expect, vi } from 'vitest';
import { mapITrafficIcon, fetchITrafficCameras, type ITrafficIcon } from './i-traffic';

afterEach(() => vi.unstubAllGlobals());

// Trimmed from www.i-traffic.co.za/map/mapIcons/Cameras (2026-10-12); one row per agency, verbatim.
const SAMPLE = `[{"itemId":"1--2","location":[-26.26888,28.06085],"zindex":0,"icon":{"url":"/Content/Images/map_camera.png","size":[25,35],"origin":[0,0],"anchor":[12,34]},"title":""},
{"itemId":"1--3","location":[-29.978761,30.93505],"zindex":0,"icon":{"url":"/Content/Images/map_camera.png","size":[25,35],"origin":[0,0],"anchor":[12,34]},"title":""},
{"itemId":"1--4","location":[-33.94648,18.4671],"zindex":0,"icon":{"url":"/Content/Images/map_camera.png","size":[25,35],"origin":[0,0],"anchor":[12,34]},"title":""},
{"itemId":"1--14","location":[-33.94811,25.45143],"zindex":0,"icon":{"url":"/Content/Images/map_camera.png","size":[25,35],"origin":[0,0],"anchor":[12,34]},"title":""}]`;

const rows = (): ITrafficIcon[] => JSON.parse(SAMPLE);
const capeTown = () => rows()[2];
// Verbatim rows of the generated table (from /List/GetData/Cameras).
const NAMES: Record<string, [string, string]> = {
  '1--4': ['WC CCTV N2 201B', 'City Of Cape Town'],
  '1--14': ['EC N2 CCTV 1101A', 'Nelson Mandela Bay'],
};

describe('mapITrafficIcon', () => {
  it('maps a marker to its still, reading the location latitude first and naming it from the list', () => {
    expect(mapITrafficIcon(capeTown(), NAMES)).toEqual({
      id: 'itraffic-1--4',
      lat: -33.94648,
      lng: 18.4671,
      name: 'WC CCTV N2 201B',
      city: 'City Of Cape Town',
      country: 'South Africa',
      feed_url: 'https://www.i-traffic.co.za/map/Cctv/1--4',
      external_url: 'https://www.i-traffic.co.za/map#camera-1--4',
      source: 'SANRAL i-traffic',
    });
  });

  it('falls back to the region when the list has no name for the camera', () => {
    expect(mapITrafficIcon(capeTown(), {})).toMatchObject({ name: 'Western Cape camera 1', city: 'Western Cape' });
    expect(mapITrafficIcon(capeTown(), { '1--4': ['', ''] })).toMatchObject({ name: 'Western Cape camera 1', city: 'Western Cape' });
  });

  it('keeps the agency in the id, since camera numbers repeat across agencies', () => {
    expect(rows().map(r => mapITrafficIcon(r, {})).map(c => [c?.id, c?.city])).toEqual([
      ['itraffic-1--2', 'Gauteng'], ['itraffic-1--3', 'KwaZulu-Natal'], ['itraffic-1--4', 'Western Cape'], ['itraffic-1--14', 'Eastern Cape'],
    ]);
  });

  it('falls back to a generic name for an unknown agency', () => {
    expect(mapITrafficIcon({ ...capeTown(), itemId: '7--99' }, {})).toMatchObject({ name: 'SANRAL i-traffic camera 7--99', city: '' });
  });

  it('drops malformed ids and unusable coordinates', () => {
    expect(mapITrafficIcon({ ...capeTown(), itemId: '1' })).toBeNull();
    expect(mapITrafficIcon({ ...capeTown(), itemId: '../1--4' })).toBeNull();
    expect(mapITrafficIcon({ ...capeTown(), itemId: null })).toBeNull();
    expect(mapITrafficIcon({ ...capeTown(), location: [18.4671, -33.94648] })).toBeNull();
    expect(mapITrafficIcon({ ...capeTown(), location: [0, 0] })).toBeNull();
    expect(mapITrafficIcon({ ...capeTown(), location: null })).toBeNull();
    expect(mapITrafficIcon(null)).toBeNull();
  });
});

describe('fetchITrafficCameras', () => {
  const many = (n: number) => Array.from({ length: n }, (_, i) => ({ ...capeTown(), itemId: `${i + 1}--4` }));

  it('fetches, maps and dedupes the markers with an honest client', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify([...many(1000), capeTown()]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const cams = await fetchITrafficCameras();
    expect(cams).toHaveLength(1000);
    expect(new Set(cams.map(c => c.id)).size).toBe(1000);
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({ 'User-Agent': 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)' });
  });

  it('throws on an HTTP error, a non-list or a short read', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 502 })));
    await expect(fetchITrafficCameras()).rejects.toThrow(/HTTP 502/);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":"x"}', { status: 200 })));
    await expect(fetchITrafficCameras()).rejects.toThrow(/unexpected response/);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(SAMPLE, { status: 200 })));
    await expect(fetchITrafficCameras()).rejects.toThrow(/short read: 4/);
  });
});

// Live integration test — opt in with RUN_LIVE_TESTS=1.
const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('fetchITrafficCameras (live)', () => {
  liveIt('fetches the marker list, almost all of it named', async () => {
    const cams = await fetchITrafficCameras();
    expect(cams.length).toBeGreaterThan(1000);
    expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
    expect(cams.filter(c => / camera \d+$/.test(c.name)).length).toBeLessThan(cams.length * 0.05);
  }, 20000);
});
