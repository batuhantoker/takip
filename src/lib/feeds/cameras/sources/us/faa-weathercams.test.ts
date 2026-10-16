import { afterEach, describe, it, expect, vi } from 'vitest';
import {
  mapFaaCamera, fetchFaaCameras, fetchLatestFaaImage, parseLatestImage, FAA_BOUNDS, type FaaSite,
} from './faa-weathercams';

afterEach(() => vi.unstubAllGlobals());

// Trimmed sites from weathercams.faa.gov/api/sites (2026-10-12).
const izg: FaaSite = {
  siteId: 617, siteName: 'White Mountain Regional Airport', siteArea: 'White Mountain Regional Airport',
  siteInMaintenance: false, siteActive: true, country: 'US', state: 'ME', operatedBy: 'LifeFlight of Maine',
  cameras: [{
    cameraId: 12265, cameraDirection: 'SouthWest', cameraLastSuccess: '2026-10-12T17:47:22.037Z',
    cameraInMaintenance: false, cameraOutOfOrder: false, latitude: 43.988842, longitude: -70.94977,
  }],
};
const bancroft: FaaSite = {
  siteId: 344, siteName: 'Bancroft', siteArea: 'Bancroft', siteInMaintenance: false, siteActive: true,
  country: 'CA', state: 'ON', operatedBy: 'NAV CANADA',
  cameras: [{
    cameraId: 11129, cameraDirection: 'East', cameraLastSuccess: '2026-10-12T17:51:03.932Z',
    cameraInMaintenance: false, cameraOutOfOrder: false, latitude: 45.07306, longitude: -77.88056,
  }],
};
const ummc: FaaSite = {
  siteId: 553, siteName: 'UMMC Jackson', siteArea: 'Jackson', siteInMaintenance: false, siteActive: true,
  country: 'US', state: 'MS', operatedBy: 'MedTrans',
  cameras: [{
    cameraId: 12014, cameraDirection: 'SouthEast', cameraLastSuccess: '2026-10-12T17:46:37.053Z',
    cameraInMaintenance: false, cameraOutOfOrder: true, latitude: 32.32905, longitude: -90.17377,
  }],
};
const perryville: FaaSite = {
  siteId: 203, siteName: 'Perryville', siteArea: 'Perryville', siteInMaintenance: false, siteActive: true,
  country: 'US', state: 'AK', operatedBy: null,
  cameras: [{
    cameraId: 10669, cameraDirection: 'SouthWest', cameraLastSuccess: '2025-12-15T03:49:02.666Z',
    cameraInMaintenance: true, cameraOutOfOrder: false, latitude: 55.91042, longitude: -159.14459,
  }],
};
const terry: FaaSite = {
  siteId: 870, siteName: 'Terry Airport', siteArea: 'Terry Airport', siteInMaintenance: false, siteActive: true,
  country: 'US', state: 'MT', operatedBy: 'MDT',
  cameras: [{
    cameraId: 13187, cameraDirection: 'SouthEast', cameraLastSuccess: '2026-07-24T17:41:40.575Z',
    cameraInMaintenance: false, cameraOutOfOrder: false, latitude: 46.7784, longitude: -105.3054,
  }],
};
const lakeClark: FaaSite = {
  siteId: 68, siteName: 'Lake Clark Pass East', siteArea: 'Lake Clark Pass', siteInMaintenance: true, siteActive: true,
  country: 'US', state: 'AK', operatedBy: null,
  cameras: [{
    cameraId: 10585, cameraDirection: 'SouthEast', cameraLastSuccess: '2026-10-12T17:44:15.705Z',
    cameraInMaintenance: false, cameraOutOfOrder: false, latitude: 60.7636, longitude: -152.4119,
  }],
};
const stoneyRidge: FaaSite = {
  siteId: 996, siteName: 'Stoney Ridge', siteArea: 'Stoney Ridge', siteInMaintenance: false, siteActive: true,
  country: 'US', state: 'CA', operatedBy: 'UCSD',
  cameras: [{
    cameraId: 13693, cameraDirection: 'NorthEast', cameraLastSuccess: '2026-10-12T17:46:27.935Z',
    cameraInMaintenance: false, cameraOutOfOrder: false, latitude: 38.919655, longitude: -121.128784,
  }],
};

const NOW = Date.parse('2026-10-12T18:00:00Z');
const cam = (s: FaaSite) => s.cameras![0];

describe('mapFaaCamera', () => {
  it('maps a camera to its snapshot route and site page', () => {
    expect(mapFaaCamera(izg, cam(izg), NOW)).toEqual({
      id: 'faa-12265',
      lat: 43.988842,
      lng: -70.94977,
      name: 'White Mountain Regional Airport — SouthWest',
      city: 'ME',
      country: 'US',
      feed_url: '/api/cctv/faa/snapshot?id=12265',
      external_url: 'https://weathercams.faa.gov/map/-70.94977,43.988842,11/cameraSite/617/details/camera/12265',
      source: 'FAA WeatherCams',
    });
  });

  it('credits NAV CANADA for its cameras', () => {
    expect(mapFaaCamera(bancroft, cam(bancroft), NOW)).toMatchObject({
      id: 'faa-11129', name: 'Bancroft — East', city: 'ON', country: 'Canada', source: 'NAV CANADA via FAA WeatherCams',
    });
  });

  it('drops cameras out of order, in maintenance, or stale', () => {
    expect(mapFaaCamera(ummc, cam(ummc), NOW)).toBeNull();
    expect(mapFaaCamera(perryville, cam(perryville), NOW)).toBeNull();
    expect(mapFaaCamera(terry, cam(terry), NOW)).toBeNull();
    expect(mapFaaCamera(izg, { ...cam(izg), cameraLastSuccess: null }, NOW)).toBeNull();
  });

  it('drops sites in maintenance, inactive, or carried by alertcalifornia.ts', () => {
    expect(mapFaaCamera(lakeClark, cam(lakeClark), NOW)).toBeNull();
    expect(mapFaaCamera({ ...izg, siteActive: false }, cam(izg), NOW)).toBeNull();
    expect(mapFaaCamera(stoneyRidge, cam(stoneyRidge), NOW)).toBeNull();
    for (const operatedBy of ['UNR', 'UO', 'ALERTWest']) {
      expect(mapFaaCamera({ ...izg, operatedBy }, cam(izg), NOW), operatedBy).toBeNull();
    }
  });

  it('drops missing ids and unusable coordinates', () => {
    expect(mapFaaCamera(izg, { ...cam(izg), cameraId: null }, NOW)).toBeNull();
    expect(mapFaaCamera({ ...izg, siteId: null }, cam(izg), NOW)).toBeNull();
    expect(mapFaaCamera(izg, { ...cam(izg), latitude: null }, NOW)).toBeNull();
    expect(mapFaaCamera(izg, { ...cam(izg), latitude: 0, longitude: 0 }, NOW)).toBeNull();
    expect(mapFaaCamera(izg, { ...cam(izg), longitude: 70.94977 }, NOW)).toBeNull();
    expect(mapFaaCamera(izg, null, NOW)).toBeNull();
  });

  it('falls back to the site name without a direction', () => {
    expect(mapFaaCamera(izg, { ...cam(izg), cameraDirection: ' ' }, NOW)?.name).toBe('White Mountain Regional Airport');
  });
});

describe('fetchFaaCameras', () => {
  it('sends the Referer the API requires and keeps the live cameras', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({
      success: true, count: 5, payload: [izg, bancroft, ummc, stoneyRidge, izg],
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    try {
      expect((await fetchFaaCameras()).map(c => c.id)).toEqual(['faa-12265', 'faa-11129']);
    } finally {
      vi.useRealTimers();
    }
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://weathercams.faa.gov/api/sites');
    expect((init?.headers as Record<string, string>).Referer).toBe('https://weathercams.faa.gov/');
  });

  it('throws on an HTTP error', async () => {
    // Verbatim body for a request without the Referer.
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"success":false,"payload":null,"error":{"code":401,"message":"Unauthorized"}}', { status: 401 })));
    await expect(fetchFaaCameras()).rejects.toThrow(/HTTP 401/);
  });
});

// Verbatim from /api/cameras/12265/images/last/1 (2026-10-12).
const latest = {
  success: true, count: 1,
  payload: [{
    cameraId: 12265, imageFilename: '12265-1791828757141.jpg',
    imageUri: 'https://images.wcams-static.faa.gov/webimages/617/12/12265-1791828757141.jpg',
    imageDatetime: '2026-10-12T18:12:59.806Z',
  }],
};

describe('parseLatestImage', () => {
  it('returns the newest frame for the camera asked about', () => {
    expect(parseLatestImage(latest, 12265)).toBe('https://images.wcams-static.faa.gov/webimages/617/12/12265-1791828757141.jpg');
  });

  it('refuses another camera, another host, or no payload', () => {
    expect(parseLatestImage(latest, 12266)).toBeNull();
    const elsewhere = { payload: [{ ...latest.payload[0], imageUri: 'https://evil.example/x.jpg' }] };
    expect(parseLatestImage(elsewhere, 12265)).toBeNull();
    const plain = { payload: [{ ...latest.payload[0], imageUri: 'http://images.wcams-static.faa.gov/x.jpg' }] };
    expect(parseLatestImage(plain, 12265)).toBeNull();
    expect(parseLatestImage({ success: true, count: 0, payload: [] }, 12265)).toBeNull();
    expect(parseLatestImage(null, 12265)).toBeNull();
  });
});

describe('fetchLatestFaaImage', () => {
  it('sends the Referer and returns the frame', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(latest)));
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchLatestFaaImage(12265)).resolves.toMatch(/12265-1791828757141\.jpg$/);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://weathercams.faa.gov/api/cameras/12265/images/last/1');
    expect(new Headers(init?.headers).get('Referer')).toBe('https://weathercams.faa.gov/');
  });
});

const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('fetchFaaCameras (live)', () => {
  liveIt('fetches the reporting cameras', async () => {
    const cams = await fetchFaaCameras();
    expect(cams.length).toBeGreaterThan(2000);
    expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
    const b = FAA_BOUNDS;
    for (const c of cams) {
      expect(c.id).toMatch(/^faa-\d+$/);
      expect(c.lat >= b.minLat && c.lat <= b.maxLat && c.lng >= b.minLng && c.lng <= b.maxLng).toBe(true);
      expect(c.external_url).toMatch(/^https:\/\/weathercams\.faa\.gov\/map\/.+\/cameraSite\/\d+\/details\/camera\/\d+$/);
    }
  }, 20000);
});
