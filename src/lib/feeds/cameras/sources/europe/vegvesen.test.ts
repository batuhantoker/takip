import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  mapVegvesenCamera, fetchVegvesenCameras, VEGVESEN_BOUNDS, type VegvesenSite, type VegvesenCamera,
} from './vegvesen';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// Verbatim from road-weather-and-view.atlas.vegvesen.no/weather-information/measurement-sites.
const record = {
  id: '2000065',
  name: 'Aisaroaivi',
  location: {
    geometry: { type: 'Point', coordinates: [24.10096, 70.27835] },
    heightAboveSeaLevel: 237.7,
    roadLinkReference: {
      source: 'NVDB', type: 'POINT', category: 'OVERVIEW',
      measure: { id: 930595, measure: 0.86394589, direction: 'BOTH' },
    },
    road: { name: '', number: 'E6', category: 'E' },
    county: { name: 'Finnmark', code: 56 },
  },
  cameras: [
    {
      id: '2000065_2',
      orientationDescription: 'Skaidi',
      stillImageUrl: 'https://kamera.atlas.vegvesen.no/api/images/2000065_2',
      videoUrl: '',
      yrUrl: 'https://www.yr.no/nb/værvarsel/daglig-tabell/70.2783537,24.1009594/',
      status: 'OK',
      lastUpdated: '2026-10-12T19:21:27.000+02:00',
    },
    {
      id: '2000065_1',
      orientationDescription: 'Sennalandet',
      stillImageUrl: 'https://kamera.atlas.vegvesen.no/api/images/2000065_1',
      videoUrl: 'https://kamera.vegvesen.no/public/2000065_1/manifest.m3u8',
      yrUrl: 'https://www.yr.no/nb/værvarsel/daglig-tabell/70.2783537,24.1009594/',
      status: 'OK',
      lastUpdated: '2026-10-12T19:21:27.000+02:00',
    },
  ],
  weatherData: {
    status: 'OK', airTemperature: -7.3, roadSurfaceTemperature: -4.2, precipitationIntensity: 0.0,
    relativeHumidity: 93.0, windSpeed: 0.6, windDirectionBearing: 318.0, maximumWindSpeed: 1.1,
    lastUpdated: '2026-10-12T19:10:00.000+02:00',
  },
  siteType: 'WeatherAndCamera',
};

const site: VegvesenSite = record;
const [still, hls] = record.cameras;

const at = (coordinates: (number | null)[] | null): VegvesenSite =>
  ({ ...site, location: { ...site.location, geometry: coordinates ? { coordinates } : null } });
const named = (name: string | null, orientationDescription: string | null) =>
  mapVegvesenCamera({ ...site, name }, { ...still, orientationDescription })?.name;

describe('mapVegvesenCamera', () => {
  it('maps a still-only view', () => {
    expect(mapVegvesenCamera(site, still)).toEqual({
      id: 'vegvesen-2000065_2',
      lat: 70.27835,
      lng: 24.10096,
      name: 'Aisaroaivi → Skaidi',
      city: 'Finnmark',
      country: 'Norway',
      feed_url: 'https://kamera.atlas.vegvesen.no/api/images/2000065_2',
      stream_type: 'jpg',
      source: 'Statens vegvesen',
    });
  });

  it('maps a view with video to its HLS stream and keeps the still', () => {
    expect(mapVegvesenCamera(site, hls)).toEqual({
      id: 'vegvesen-2000065_1',
      lat: 70.27835,
      lng: 24.10096,
      name: 'Aisaroaivi → Sennalandet',
      city: 'Finnmark',
      country: 'Norway',
      feed_url: 'https://kamera.atlas.vegvesen.no/api/images/2000065_1',
      stream_url: 'https://kamera.vegvesen.no/public/2000065_1/manifest.m3u8',
      stream_type: 'hls',
      source: 'Statens vegvesen',
    });
  });

  it('drops expired views and any status other than OK', () => {
    expect(mapVegvesenCamera(site, { ...hls, status: 'EXPIRED' })).toBeNull();
    expect(mapVegvesenCamera(site, { ...still, status: null })).toBeNull();
  });

  it('drops coordinates outside Norway', () => {
    expect(mapVegvesenCamera(at([0, 0]), still)).toBeNull();
    expect(mapVegvesenCamera(at([24.10096, 72.1]), still)).toBeNull();
    expect(mapVegvesenCamera(at([-24.10096, 70.27835]), still)).toBeNull();
    expect(mapVegvesenCamera(at([24.10096, null]), still)).toBeNull();
    expect(mapVegvesenCamera(at(null), still)).toBeNull();
  });

  it('drops rows without a usable id', () => {
    expect(mapVegvesenCamera(site, { ...still, id: null })).toBeNull();
    expect(mapVegvesenCamera(site, { ...still, id: ' ' })).toBeNull();
    expect(mapVegvesenCamera(site, { ...still, id: '../2000065_2' })).toBeNull();
    expect(mapVegvesenCamera(site, null)).toBeNull();
    expect(mapVegvesenCamera(null, still)).toBeNull();
  });

  it('labels the view by its site and the place it faces, with fallbacks', () => {
    expect(named('Kvisla', 'mot Hagafoss')).toBe('Kvisla → Hagafoss');
    expect(named('Oppdal', 'Oppdal')).toBe('Oppdal');
    expect(named(' Rv13  Ylvisåker IoT', ' Moss')).toBe('Rv13 Ylvisåker IoT → Moss');
    expect(named('Vrådal', '')).toBe('Vrådal');
    expect(named('Vrådal', null)).toBe('Vrådal');
    expect(named('  ', 'Skaidi')).toBe('Statens vegvesen Camera 2000065_2 → Skaidi');
    expect(named(null, null)).toBe('Statens vegvesen Camera 2000065_2');
  });

  it('captions with the county, or Norway without one', () => {
    const noCounty = { ...site, location: { ...site.location, county: null } };
    expect(mapVegvesenCamera(noCounty, still)?.city).toBe('Norway');
    expect(mapVegvesenCamera({ ...site, location: { ...site.location, county: { name: ' ' } } }, still)?.city).toBe('Norway');
  });

  it('keeps only https media on vegvesen hosts', () => {
    const plainVideo = mapVegvesenCamera(site, { ...hls, videoUrl: 'http://kamera.vegvesen.no/public/2000065_1/manifest.m3u8' });
    expect(plainVideo?.stream_url).toBeUndefined();
    expect(plainVideo?.stream_type).toBe('jpg');
    expect(mapVegvesenCamera(site, { ...hls, videoUrl: 'https://example.com/live.m3u8' })?.stream_type).toBe('jpg');
    const videoOnly = mapVegvesenCamera(site, { ...hls, stillImageUrl: 'https://example.com/x.jpg' });
    expect(videoOnly?.feed_url).toBeUndefined();
    expect(videoOnly?.stream_type).toBe('hls');
    expect(mapVegvesenCamera(site, { ...still, stillImageUrl: 'http://kamera.atlas.vegvesen.no/api/images/2000065_2' })).toBeNull();
  });
});

describe('fetchVegvesenCameras', () => {
  const view = (n: number): VegvesenCamera => ({
    ...still, id: `${n}_1`, stillImageUrl: `https://kamera.atlas.vegvesen.no/api/images/${n}_1`,
  });
  const body = (cams: VegvesenCamera[]) =>
    Response.json({ metadata: {}, measurementSites: [...cams.map(c => ({ ...site, cameras: [c] })), { ...site, cameras: null }] });
  const quiet = () => vi.spyOn(console, 'log').mockImplementation(() => {});

  it('sends the vendor headers, maps every view and dedupes by id', async () => {
    quiet();
    const cams = Array.from({ length: 600 }, (_, i) => view(i));
    const fetchMock = vi.fn(async () => body([...cams, cams[0], { ...view(9999), status: 'EXPIRED' }]));
    vi.stubGlobal('fetch', fetchMock);
    const out = await fetchVegvesenCameras();
    expect(out).toHaveLength(600);
    expect(new Set(out.map(c => c.id)).size).toBe(600);
    const headers = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Record<string, string>;
    expect(headers).toMatchObject({ Accept: 'application/vnd.svv.v1+json', 'X-System-ID': 'takip' });
  });

  it('throws on an HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 406 })));
    await expect(fetchVegvesenCameras()).rejects.toThrow(/HTTP 406/);
  });

  it('throws on an unexpected shape', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json([site])));
    await expect(fetchVegvesenCameras()).rejects.toThrow(/no measurementSites/);
  });

  it('throws on a short read rather than returning a partial list', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => body(Array.from({ length: 40 }, (_, i) => view(i)))));
    await expect(fetchVegvesenCameras()).rejects.toThrow(/short read \(40\)/);
  });
});

// Live integration test — opt in with RUN_LIVE_TESTS=1.
const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('fetchVegvesenCameras (live)', () => {
  liveIt('fetches the national set', async () => {
    const cams = await fetchVegvesenCameras();
    expect(cams.length).toBeGreaterThan(600);
    expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
    const b = VEGVESEN_BOUNDS;
    for (const c of cams) {
      const native = c.id.match(/^vegvesen-(\d+_\d+)$/)?.[1];
      expect(native).toBeDefined();
      expect(c.lat > b.minLat && c.lat < b.maxLat && c.lng > b.minLng && c.lng < b.maxLng).toBe(true);
      expect(c.feed_url).toBe(`https://kamera.atlas.vegvesen.no/api/images/${native}`);
      if (c.stream_type === 'hls') {
        expect(c.stream_url).toBe(`https://kamera.vegvesen.no/public/${native}/manifest.m3u8`);
      } else {
        expect(c.stream_url).toBeUndefined();
      }
    }
    const hlsCount = cams.filter(c => c.stream_type === 'hls').length;
    expect(hlsCount).toBeGreaterThan(100);
    console.log(`Statens vegvesen live: ${cams.length}, hls ${hlsCount}`);
  }, 20_000);
});
