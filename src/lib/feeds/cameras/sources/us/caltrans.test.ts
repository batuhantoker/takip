import { afterEach, describe, it, expect, vi } from 'vitest';
import { mapCaltransCamera, fetchCaltransCameras, districtUrl, CALTRANS_BOUNDS, type CaltransRecord } from './caltrans';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// Trimmed records from cwwp2.dot.ca.gov/data/d{n}/cctv/cctvStatusD{nn}.json, minus the referenceImage URLs (2026-10-12).
const avenue26: CaltransRecord = {
  cctv: {
    index: '1', recordTimestamp: { recordDate: '2024-05-07', recordTime: '16:27:07', recordEpoch: '1715124427' },
    location: {
      district: '7', locationName: 'I-110 : (196) Avenue 26 Off Ramp', nearbyPlace: 'Cypress Park', longitude: '-118.2215',
      latitude: '34.0837', elevation: '95', direction: 'South', county: 'Alameda', route: 'I-110', routeSuffix: '',
      postmilePrefix: '', postmile: '26.01', alignment: '', milepost: '25.892',
    },
    inService: 'true',
    imageData: {
      imageDescription: '', streamingVideoURL: 'https://wzmedia.dot.ca.gov/D7/CCTV-196.stream/playlist.m3u8',
      static: {
        currentImageUpdateFrequency: '2',
        currentImageURL: 'https://cwwp2.dot.ca.gov/data/d7/cctv/image/i110196avenue26offramp/i110196avenue26offramp.jpg',
      },
    },
  },
} as CaltransRecord;
const triggs: CaltransRecord = {
  cctv: {
    index: '7', recordTimestamp: { recordDate: '2026-09-04', recordTime: '09:35:59', recordEpoch: '1788539759' },
    location: {
      district: '7', locationName: 'I-5 : (7) Triggs St', nearbyPlace: 'Los Angeles', longitude: '-118.16267',
      latitude: '34.01224', elevation: '157', direction: 'North', county: 'Los Angeles', route: 'I-5', routeSuffix: '',
      postmilePrefix: '', postmile: '13.132', alignment: 'R', milepost: '129.555',
    },
    inService: 'false',
    imageData: {
      imageDescription: '', streamingVideoURL: 'https://wzmedia.dot.ca.gov/D7/CCTV-007.stream/playlist.m3u8',
      static: { currentImageUpdateFrequency: '2', currentImageURL: 'https://cwwp2.dot.ca.gov/data/d7/cctv/image/i57triggsst/i57triggsst.jpg' },
    },
  },
} as CaltransRecord;
const fortBragg: CaltransRecord = {
  cctv: {
    index: '1', recordTimestamp: { recordDate: '2026-05-14', recordTime: '16:56:28', recordEpoch: '1778802988' },
    location: {
      district: '1', locationName: 'SR-20 : At SR-1 - Looking East (C020)', nearbyPlace: 'Fort Bragg', longitude: '-123.807828',
      latitude: '39.420010', elevation: '95', direction: 'East', county: 'Mendocino', route: 'SR-20', routeSuffix: '',
      postmilePrefix: 'R', postmile: '0.007', alignment: '', milepost: '0.007',
    },
    inService: 'true',
    imageData: {
      imageDescription: '', streamingVideoURL: '',
      static: { currentImageUpdateFrequency: '15', currentImageURL: 'https://cwwp2.dot.ca.gov/data/d1/cctv/image/sr20atsr1lookingeast/sr20atsr1lookingeast.jpg' },
    },
  },
} as CaltransRecord;

const withLocation = (patch: object): CaltransRecord => ({ cctv: { ...avenue26.cctv, location: { ...avenue26.cctv!.location, ...patch } } });
const withStill = (url: string | null): CaltransRecord => ({ cctv: { ...avenue26.cctv, imageData: { static: { currentImageURL: url } } } });

describe('mapCaltransCamera', () => {
  it('maps an in-service camera to its still, without the Referer-gated HLS', () => {
    expect(mapCaltransCamera(avenue26)).toEqual({
      id: 'cal-i110196avenue26offramp',
      lat: 34.0837,
      lng: -118.2215,
      name: 'I-110 : (196) Avenue 26 Off Ramp',
      city: 'Cypress Park',
      country: 'US',
      feed_url: 'https://cwwp2.dot.ca.gov/data/d7/cctv/image/i110196avenue26offramp/i110196avenue26offramp.jpg',
      stream_type: 'jpg',
      source: 'Caltrans',
    });
    expect(mapCaltransCamera(fortBragg)).toMatchObject({ id: 'cal-sr20atsr1lookingeast', lat: 39.42001, lng: -123.807828 });
  });

  it('drops cameras out of service', () => {
    expect(mapCaltransCamera(triggs)).toBeNull();
    expect(mapCaltransCamera({ cctv: { ...avenue26.cctv, inService: null } })).toBeNull();
  });

  it('drops a missing or unexpected still', () => {
    expect(mapCaltransCamera(withStill(null))).toBeNull();
    expect(mapCaltransCamera(withStill('http://cwwp2.dot.ca.gov/data/d7/cctv/image/i57triggsst/i57triggsst.jpg'))).toBeNull();
    expect(mapCaltransCamera(withStill('https://cwwp2.dot.ca.gov/data/d7/cctv/image/i57triggsst/other.jpg'))).toBeNull();
    expect(mapCaltransCamera(withStill('https://example.com/data/d7/cctv/image/i57triggsst/i57triggsst.jpg'))).toBeNull();
  });

  it('drops unusable coordinates', () => {
    expect(mapCaltransCamera(withLocation({ latitude: '', longitude: '' }))).toBeNull();
    expect(mapCaltransCamera(withLocation({ latitude: '0', longitude: '0' }))).toBeNull();
    expect(mapCaltransCamera(withLocation({ latitude: '45.52', longitude: '-122.68' }))).toBeNull();
    expect(mapCaltransCamera({})).toBeNull();
    expect(mapCaltransCamera(null)).toBeNull();
  });

  it('falls back to the county, then the state', () => {
    expect(mapCaltransCamera(withLocation({ nearbyPlace: '' }))?.city).toBe('Alameda');
    expect(mapCaltransCamera(withLocation({ nearbyPlace: '', county: '' }))?.city).toBe('California');
    expect(mapCaltransCamera(withLocation({ locationName: '' }))?.name).toBe('Caltrans Camera i110196avenue26offramp');
  });
});

describe('fetchCaltransCameras', () => {
  it('reads all twelve districts and dedupes', async () => {
    const fetch = vi.fn(async (url: string) =>
      Response.json({ data: url.includes('/d7/') ? [avenue26, triggs, avenue26] : url.includes('/d1/') ? [fortBragg] : [] }));
    vi.stubGlobal('fetch', fetch);
    vi.spyOn(console, 'log').mockImplementation(() => {});

    const cams = await fetchCaltransCameras();

    expect(cams.map(c => c.id).sort()).toEqual(['cal-i110196avenue26offramp', 'cal-sr20atsr1lookingeast']);
    expect(fetch).toHaveBeenCalledTimes(12);
    expect(fetch.mock.calls.map(c => c[0])).toContain('https://cwwp2.dot.ca.gov/data/d12/cctv/cctvStatusD12.json');
  });

  it('keeps the districts it has and names the ones that failed', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) =>
      url.includes('/d7/') ? Response.json({ data: [avenue26] }) : new Response('', { status: 503 })));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(await fetchCaltransCameras()).toHaveLength(1);
    expect(warn.mock.calls[0][0]).toContain('D1 (HTTP 503)');
  });

  it('throws when every district fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: true })));
    await expect(fetchCaltransCameras()).rejects.toThrow('every district failed');
  });
});

describe('districtUrl', () => {
  it('pads the file name but not the folder', () => {
    expect(districtUrl(4)).toBe('https://cwwp2.dot.ca.gov/data/d4/cctv/cctvStatusD04.json');
    expect(districtUrl(11)).toBe('https://cwwp2.dot.ca.gov/data/d11/cctv/cctvStatusD11.json');
  });
});

// Live integration test — opt in with RUN_LIVE_TESTS=1.
const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('fetchCaltransCameras (live)', () => {
  liveIt('fetches the in-service cameras of every district', async () => {
    const cams = await fetchCaltransCameras();
    expect(cams.length).toBeGreaterThan(3000);
    expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
    const b = CALTRANS_BOUNDS;
    for (const c of cams) {
      expect(c.lat > b.minLat && c.lat < b.maxLat && c.lng > b.minLng && c.lng < b.maxLng).toBe(true);
      expect(c.feed_url).toMatch(/^https:\/\/cwwp2\.dot\.ca\.gov\/data\/d\d+\/cctv\/image\//);
      expect(c.stream_url).toBeUndefined();
    }
  }, 30_000);
});
