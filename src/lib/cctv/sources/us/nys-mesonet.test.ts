import { afterEach, describe, it, expect, vi } from 'vitest';
import { mapNysmStation, fetchNysMesonetCameras, NYS_MESONET_BOUNDS, type NysmStation } from './nys-mesonet';

afterEach(() => vi.unstubAllGlobals());

// Trimmed features from api.nysmesonet.org/meta/geoinfo/index.php/geojson/nysm (2026-10-12).
const addison: NysmStation = {
  geometry: { coordinates: [-77.23726, 42.04036] },
  properties: { stid: 'ADDI', name: 'Addison', city: 'Addison', decommissioned: null },
};
const beacon: NysmStation = {
  geometry: { coordinates: [-73.94527, 41.52875] },
  properties: { stid: 'BEAC', name: 'Beacon', city: 'Beacon', decommissioned: null },
};
const brooklyn: NysmStation = {
  geometry: { coordinates: [-73.953678, 40.631762] },
  properties: { stid: 'BKLN', name: 'Brooklyn', city: 'Brooklyn', decommissioned: null },
};

// Trimmed from api.nysmesonet.org/cam/index.php/multilist/nysm/ADDI,BEAC,BKLN/latest (2026-10-12).
const LATEST = '{"ADDI":{"photos":[{"timestamp":1791828027,"url":"https:\\/\\/api.nysmesonet.org\\/cam\\/index.php\\/image\\/nysm\\/ADDI\\/1791828027","direction":0}]},"BEAC":{"photos":[]},"BKLN":{"photos":[{"timestamp":1791828027,"url":"https:\\/\\/api.nysmesonet.org\\/cam\\/index.php\\/image\\/nysm\\/BKLN\\/1791828027","direction":0}]}}';

const NOW_S = Date.parse('2026-10-12T18:05:00Z') / 1000;
const photo = { timestamp: 1791828027 };

describe('mapNysmStation', () => {
  it('maps a station to its latest photo', () => {
    expect(mapNysmStation(addison, photo, NOW_S)).toEqual({
      id: 'nysm-ADDI',
      lat: 42.04036,
      lng: -77.23726,
      name: 'Addison',
      city: 'Addison',
      country: 'US',
      feed_url: 'https://api.nysmesonet.org/cam/index.php/image/nysm/ADDI/latest',
      stream_type: 'jpg',
      external_url: 'https://nysmesonet.org/weather/#?network=nysm&stid=ADDI',
      source: 'NYS Mesonet',
    });
  });

  it('drops stations without a recent photo', () => {
    expect(mapNysmStation(beacon, undefined, NOW_S)).toBeNull();
    expect(mapNysmStation(addison, { timestamp: null }, NOW_S)).toBeNull();
    expect(mapNysmStation(addison, photo, NOW_S + 8 * 86_400)).toBeNull();
  });

  it('drops decommissioned stations and bad ids', () => {
    expect(mapNysmStation({ ...addison, properties: { ...addison.properties, decommissioned: 1700000000000 } }, photo, NOW_S)).toBeNull();
    expect(mapNysmStation({ ...addison, properties: { ...addison.properties, stid: '../ADDI' } }, photo, NOW_S)).toBeNull();
    expect(mapNysmStation({ ...addison, properties: null }, photo, NOW_S)).toBeNull();
  });

  it('reads GeoJSON order and drops points outside New York', () => {
    expect(mapNysmStation({ ...addison, geometry: { coordinates: [42.04036, -77.23726] } }, photo, NOW_S)).toBeNull();
    expect(mapNysmStation({ ...addison, geometry: { coordinates: [0, 0] } }, photo, NOW_S)).toBeNull();
    expect(mapNysmStation({ ...addison, geometry: null }, photo, NOW_S)).toBeNull();
  });
});

describe('fetchNysMesonetCameras', () => {
  it('asks for every station’s newest photo in one call', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW_S * 1000);
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/geojson/nysm')) {
        return new Response(JSON.stringify({ type: 'FeatureCollection', features: [addison, beacon, brooklyn, addison] }), { status: 200 });
      }
      if (url.includes('/multilist/nysm/')) return new Response(LATEST, { status: 200 });
      return new Response('', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);
    try {
      expect((await fetchNysMesonetCameras()).map(c => c.id)).toEqual(['nysm-ADDI', 'nysm-BKLN']);
    } finally {
      vi.useRealTimers();
    }
    expect(fetchMock.mock.calls.map(c => c[0])).toEqual([
      'https://api.nysmesonet.org/meta/geoinfo/index.php/geojson/nysm',
      'https://api.nysmesonet.org/cam/index.php/multilist/nysm/ADDI,BEAC,BKLN/latest',
    ]);
  });

  it('throws when either call fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })));
    await expect(fetchNysMesonetCameras()).rejects.toThrow(/stations HTTP 500/);
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.includes('/geojson/')
      ? new Response(JSON.stringify({ features: [addison] }), { status: 200 })
      : new Response('', { status: 503 })));
    await expect(fetchNysMesonetCameras()).rejects.toThrow(/photos HTTP 503/);
  });
});

const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('fetchNysMesonetCameras (live)', () => {
  liveIt('fetches the station cameras', async () => {
    const cams = await fetchNysMesonetCameras();
    expect(cams.length).toBeGreaterThan(100);
    expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
    const b = NYS_MESONET_BOUNDS;
    for (const c of cams) {
      expect(c.lat >= b.minLat && c.lat <= b.maxLat && c.lng >= b.minLng && c.lng <= b.maxLng).toBe(true);
      expect(c.feed_url).toMatch(/^https:\/\/api\.nysmesonet\.org\/cam\/index\.php\/image\/nysm\/[A-Z0-9]+\/latest$/);
    }
  }, 20000);
});
