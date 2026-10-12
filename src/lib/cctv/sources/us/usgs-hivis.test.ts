import { afterEach, describe, it, expect, vi } from 'vitest';
import { mapHivisCamera, fetchHivisCameras, HIVIS_BOUNDS, type HivisCamera } from './usgs-hivis';

afterEach(() => vi.unstubAllGlobals());

// Trimmed rows from api.waterdata.usgs.gov/nims/v0/cameras?enabled=true (2026-10-12).
const lickCreek: HivisCamera = {
  camId: 'IL_Lick_Creek_near_Woodside', camName: 'Lick Creek near Woodside',
  lat: '39.71553889', lng: '-89.7024444', newestImageDT: '2026-10-12T17:45:02.000Z', hideCam: false,
  smallDir: 'https://usgs-nims-images.s3.amazonaws.com/720/IL_Lick_Creek_near_Woodside/',
};
const glacierCreek: HivisCamera = {
  camId: 'AK_Glacier_Creek_at_Alyeska_Highway_at_Girdwood_Approach', camName: 'Glacier Creek at Alyeska Highway at Girdwood Approach',
  lat: '60.9616194', lng: '-149.1319194', newestImageDT: '2026-10-12T17:00:02.000Z', hideCam: false,
  smallDir: 'https://usgs-nims-images.s3.amazonaws.com/720/AK_Glacier_Creek_at_Alyeska_Highway_at_Girdwood_Approach/',
};
// No hideCam field at all: shown in the app.
const connectionSlough: HivisCamera = {
  camId: 'CA_Connection_Slough_A_Swing_Br_nr_Orwood', camName: 'Connection Slough A Swing Br nr Orwood',
  lat: '38.004122', lng: '-121.530939', newestImageDT: '2026-10-12T17:45:23.000Z',
  smallDir: 'https://usgs-nims-images.s3.amazonaws.com/720/CA_Connection_Slough_A_Swing_Br_nr_Orwood/',
};
const kilaueaHidden: HivisCamera = {
  camId: 'HI_Kilauea_KWcam', camName: 'Kilauea KWcam',
  lat: '19.407540', lng: '-155.291750', newestImageDT: '2026-10-12T17:56:02.000Z', hideCam: true,
  smallDir: 'https://usgs-nims-images.s3.amazonaws.com/720/HI_Kilauea_KWcam/',
};
const sandKey: HivisCamera = {
  camId: 'FL_Sand_Key', camName: 'Sand Key',
  lat: '27.93907', lng: '-82.83934', newestImageDT: '2026-08-03T23:00:02.000Z', hideCam: false,
  smallDir: 'https://usgs-nims-images.s3.amazonaws.com/720/FL_Sand_Key/',
};
const opequon: HivisCamera = {
  camId: 'VA_OPEQUON_CREEK_NEAR_BERRYVILLE', camName: 'OPEQUON CREEK NEAR BERRYVILLE',
  lat: '39.1747222', lng: '-78.0783333', hideCam: false,
  smallDir: 'https://usgs-nims-images.s3.amazonaws.com/720/VA_OPEQUON_CREEK_NEAR_BERRYVILLE/',
};
const lasCrucesTest: HivisCamera = {
  camId: 'NM_Las_Cruces_Test_Site', camName: 'Las Cruces Test Site',
  lat: '32.285', lng: '-106.746', newestImageDT: '2026-10-12T17:45:02.000Z', hideCam: false,
  smallDir: 'https://usgs-nims-images.s3.amazonaws.com/720/NM_Las_Cruces_Test_Site/',
};
const eagleLake: HivisCamera = {
  camId: 'NM_EAGLE_LAKE_(SOUTH_12)', camName: 'EAGLE LAKE (SOUTH 12)',
  lat: '33.3852611', lng: '-105.7473694', newestImageDT: '2024-08-29T14:45:06.000Z', hideCam: true,
  smallDir: 'https://usgs-nims-images.s3.amazonaws.com/720/NM_EAGLE_LAKE_(SOUTH_12)/',
};

const NOW = Date.parse('2026-10-12T18:00:00Z');

describe('mapHivisCamera', () => {
  it('maps a camera to its newest 720 px frame', () => {
    expect(mapHivisCamera(lickCreek, NOW)).toEqual({
      id: 'hivis-IL_Lick_Creek_near_Woodside',
      lat: 39.71553889,
      lng: -89.7024444,
      name: 'Lick Creek near Woodside',
      city: '',
      country: 'US',
      feed_url: 'https://usgs-nims-images.s3.amazonaws.com/720/IL_Lick_Creek_near_Woodside/IL_Lick_Creek_near_Woodside_newest.jpg',
      stream_type: 'jpg',
      external_url: 'https://apps.usgs.gov/hivis/camera/IL_Lick_Creek_near_Woodside',
      source: 'USGS HIVIS',
    });
  });

  it('keeps Alaska and rows without a hideCam flag', () => {
    expect(mapHivisCamera(glacierCreek, NOW)?.id).toBe('hivis-AK_Glacier_Creek_at_Alyeska_Highway_at_Girdwood_Approach');
    expect(mapHivisCamera(connectionSlough, NOW)?.id).toBe('hivis-CA_Connection_Slough_A_Swing_Br_nr_Orwood');
  });

  it('keeps ids with parentheses', () => {
    const cam = mapHivisCamera({ ...eagleLake, hideCam: false, newestImageDT: '2026-10-12T17:45:02.000Z' }, NOW);
    expect(cam?.feed_url).toBe('https://usgs-nims-images.s3.amazonaws.com/720/NM_EAGLE_LAKE_(SOUTH_12)/NM_EAGLE_LAKE_(SOUTH_12)_newest.jpg');
    expect(cam?.external_url).toBe('https://apps.usgs.gov/hivis/camera/NM_EAGLE_LAKE_(SOUTH_12)');
  });

  it('drops hidden, test, stale and never-reporting cameras', () => {
    expect(mapHivisCamera(kilaueaHidden, NOW)).toBeNull();
    expect(mapHivisCamera(lasCrucesTest, NOW)).toBeNull();
    expect(mapHivisCamera(sandKey, NOW)).toBeNull();
    expect(mapHivisCamera(opequon, NOW)).toBeNull();
  });

  it('drops rows whose image folder is not the one their id implies', () => {
    expect(mapHivisCamera({ ...lickCreek, smallDir: 'https://evil.example/720/IL_Lick_Creek_near_Woodside/' }, NOW)).toBeNull();
    expect(mapHivisCamera({ ...lickCreek, smallDir: null }, NOW)).toBeNull();
    expect(mapHivisCamera({ ...lickCreek, camId: '../IL_Lick_Creek_near_Woodside' }, NOW)).toBeNull();
    expect(mapHivisCamera({ ...lickCreek, camId: null }, NOW)).toBeNull();
  });

  it('drops unusable coordinates', () => {
    expect(mapHivisCamera({ ...lickCreek, lat: '' }, NOW)).toBeNull();
    expect(mapHivisCamera({ ...lickCreek, lat: '0.0000', lng: '0.0000' }, NOW)).toBeNull();
    // Verbatim: a Guam camera, across the antimeridian.
    expect(mapHivisCamera({ ...lickCreek, lat: '13.48073628', lng: '144.7289428' }, NOW)).toBeNull();
    // Verbatim: a row with latitude and longitude swapped.
    expect(mapHivisCamera({ ...lickCreek, lat: '-88', lng: '45' }, NOW)).toBeNull();
  });
});

describe('fetchHivisCameras', () => {
  it('keeps the visible, reporting cameras once each', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([lickCreek, kilaueaHidden, sandKey, glacierCreek, lickCreek]), { status: 200 })));
    try {
      expect((await fetchHivisCameras()).map(c => c.id)).toEqual([
        'hivis-IL_Lick_Creek_near_Woodside', 'hivis-AK_Glacier_Creek_at_Alyeska_Highway_at_Girdwood_Approach',
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('throws on an HTTP error or a non-list body', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
    await expect(fetchHivisCameras()).rejects.toThrow(/HTTP 503/);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"message":"error"}', { status: 200 })));
    await expect(fetchHivisCameras()).rejects.toThrow(/unexpected response/);
  });
});

const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('fetchHivisCameras (live)', () => {
  liveIt('fetches the reporting cameras', async () => {
    const cams = await fetchHivisCameras();
    expect(cams.length).toBeGreaterThan(500);
    expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
    const b = HIVIS_BOUNDS;
    for (const c of cams) {
      expect(c.lat >= b.minLat && c.lat <= b.maxLat && c.lng >= b.minLng && c.lng <= b.maxLng).toBe(true);
      expect(c.feed_url).toMatch(/^https:\/\/usgs-nims-images\.s3\.amazonaws\.com\/720\/[\w().-]+\/[\w().-]+_newest\.jpg$/);
    }
  }, 20000);
});
