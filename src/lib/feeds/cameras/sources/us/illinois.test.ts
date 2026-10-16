import { afterEach, describe, it, expect, vi } from 'vitest';
import { mapIllinoisCamera, fetchIllinoisCameras, ILLINOIS_BOUNDS, type IllinoisCamera } from './illinois';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// Trimmed attributes from IDOT's TrafficCamerasTM_Public FeatureServer/0 (2026-10-12).
const darrellEast = {
  OBJECTID: 376, ImgPath: 'https://travelmidwest.com/showCamera?id=IL-LAKECOUNTY-31475&direction=E',
  CameraLocation: 'Darrell at Roberts (Cell)', CameraDirection: 'E', y: 42.24890899658203, x: -88.1961898803711,
  SnapShot: 'https://www.lakecountypassage.com/snapshots/Darrell_@_Roberts_(Cell)_cctv_East_Leg.jpg',
  WarningAge: 'false', TooOld: 'false', AgeInMinutes: '3',
} as IllinoisCamera;
const darrellNorth = {
  OBJECTID: 377, ImgPath: 'https://travelmidwest.com/showCamera?id=IL-LAKECOUNTY-31475&direction=N',
  CameraLocation: 'Darrell at Roberts (Cell)', CameraDirection: 'N', y: 42.24890899658203, x: -88.1961898803711,
  SnapShot: 'https://www.lakecountypassage.com/snapshots/Darrell_@_Roberts_(Cell)_cctv_North_Leg.jpg',
  WarningAge: 'false', TooOld: 'false', AgeInMinutes: '3',
} as IllinoisCamera;
const sixFlags = {
  OBJECTID: 1784, ImgPath: 'https://travelmidwest.com/showCamera?id=IL-LAKECOUNTY-2583&direction=E',
  CameraLocation: 'IL 132 at Lawson, Six Flags', CameraDirection: 'E', y: 42.37641143798828, x: -87.93328857421875,
  SnapShot: 'https://www.lakecountypassage.com/snapshots/IL_132_@_Lawson,_Six_Flags_cctv_East_Leg.jpg',
  WarningAge: 'false', TooOld: 'false', AgeInMinutes: '3',
} as IllinoisCamera;
const triState = {
  OBJECTID: 396, ImgPath: 'https://travelmidwest.com/showCamera?id=IL-LAKECOUNTY-cam172_30_45_129&direction=E',
  CameraLocation: 'Washington at Tri State', CameraDirection: 'E', y: 42.36391067504883, x: -87.94640350341797,
  SnapShot: 'https://www.lakecountypassage.com/snapshots/Washington_@_Tri_State_cctv_East_Leg.jpg',
  WarningAge: 'false', TooOld: 'false', AgeInMinutes: '4',
} as IllinoisCamera;
// Travel Midwest views: the still host 403s a foreign Referer, so they go through the proxy.
const hillside = {
  OBJECTID: 1, ImgPath: 'https://travelmidwest.com/showCamera?id=IL-IDOTD1-IK14B&direction=NONE',
  CameraLocation: 'Hillside Tower Camera 9', CameraDirection: 'NONE', y: 41.88597, x: -87.91483,
  SnapShot: 'https://cctv.travelmidwest.com/snapshots/IL-IDOTD1_1_Cook_WB_Albin_4188597_-8791483_2_NONE.jpg',
  WarningAge: 'false', TooOld: 'false', AgeInMinutes: '7',
} as IllinoisCamera;
const kirk = {
  OBJECTID: 1520, ImgPath: 'https://travelmidwest.com/showCamera?id=IL-KANECOUNTY-43',
  CameraLocation: 'Kirk Rd at Mesa Ln', CameraDirection: 'NONE', y: 41.817349, x: -88.27953,
  SnapShot: 'https://cctv.travelmidwest.com/snapshots/IL-KANECOUNTY_1_Kane_NB_Kirk_4181735_-8827953_1_NONE.jpg', TooOld: 'false',
} as IllinoisCamera;
const springCreek = {
  OBJECTID: 2950, ImgPath: 'https://travelmidwest.com/showCamera?id=IL-ISTHA-bkWelUZ79reGAKdLMh+MlC6jVSo=&direction=N',
  CameraLocation: 'I-355 at Spring Creek Plaza', CameraDirection: 'N', y: 41.5766, x: -88.0005,
  SnapShot: 'https://cctv.travelmidwest.com/snapshots/IL-ISTHA_1_Will_SEB_I-355-CASH_4157660_-8800050_1_N.jpg', TooOld: 'false',
} as IllinoisCamera;
const metroEast = {
  OBJECTID: 2100, ImgPath: 'https://travelmidwest.com/showCamera?id=IL-IDOTD4-8101&direction=W',
  CameraLocation: 'I-64 at IL 157', CameraDirection: 'W', y: 38.5899, x: -90.0599,
  SnapShot: 'https://cctv.travelmidwest.com/snapshots/IL-IDOTD4_8_St-Clair_SEB_I-64_3858990_-9005990_1_W.jpg', TooOld: 'false',
} as IllinoisCamera;

describe('mapIllinoisCamera', () => {
  it('maps a view to its Lake County PASSAGE still', () => {
    expect(mapIllinoisCamera(darrellEast)).toEqual({
      id: 'idot-IL-LAKECOUNTY-31475-E',
      lat: 42.24890899658203,
      lng: -88.1961898803711,
      name: 'Darrell at Roberts (Cell) – East',
      city: 'Lake County, Illinois',
      country: 'US',
      feed_url: 'https://www.lakecountypassage.com/snapshots/Darrell_@_Roberts_(Cell)_cctv_East_Leg.jpg',
      stream_type: 'jpg',
      external_url: 'https://travelmidwest.com/showCamera?id=IL-LAKECOUNTY-31475&direction=E',
      source: 'IDOT / Lake County PASSAGE',
    });
  });

  it('makes one camera per view, keyed by camera id and direction', () => {
    expect(mapIllinoisCamera(darrellNorth)?.id).toBe('idot-IL-LAKECOUNTY-31475-N');
    expect(mapIllinoisCamera(triState)?.id).toBe('idot-IL-LAKECOUNTY-cam172_30_45_129-E');
    expect(mapIllinoisCamera(sixFlags)?.feed_url).toBe(
      'https://www.lakecountypassage.com/snapshots/IL_132_@_Lawson,_Six_Flags_cctv_East_Leg.jpg',
    );
  });

  it('serves a Travel Midwest view through the proxy, credited to its agency', () => {
    expect(mapIllinoisCamera(hillside)).toEqual({
      id: 'idot-IL-IDOTD1-IK14B',
      lat: 41.88597,
      lng: -87.91483,
      name: 'Hillside Tower Camera 9',
      city: 'Cook County, Illinois',
      country: 'US',
      feed_url: `/api/cctv/proxy?url=${encodeURIComponent(hillside.SnapShot!)}`,
      stream_type: 'jpg',
      external_url: hillside.ImgPath,
      source: 'IDOT',
    });
    expect(mapIllinoisCamera(metroEast)).toMatchObject({ city: 'St. Clair County, Illinois', name: 'I-64 at IL 157 – West' });
  });

  it('reads a missing page direction from the row', () => {
    expect(mapIllinoisCamera(kirk)).toMatchObject({ id: 'idot-IL-KANECOUNTY-43', name: 'Kirk Rd at Mesa Ln', source: 'Kane County DOT' });
  });

  it('turns a Tollway base64 id into a safe one', () => {
    expect(mapIllinoisCamera(springCreek)).toMatchObject({
      id: 'idot-IL-ISTHA-bkWelUZ79reGAKdLMh_MlC6jVSo_-N', source: 'Illinois Tollway', city: 'Will County, Illinois',
    });
  });

  it('drops other hosts', () => {
    expect(mapIllinoisCamera({ ...hillside, SnapShot: 'https://cctv.example.com/snapshots/x.jpg' })).toBeNull();
    expect(mapIllinoisCamera({ ...darrellEast, SnapShot: 'http://www.lakecountypassage.com/snapshots/x.jpg' })).toBeNull();
    expect(mapIllinoisCamera({ ...darrellEast, SnapShot: null })).toBeNull();
  });

  it('drops stale stills', () => {
    expect(mapIllinoisCamera({ ...darrellEast, TooOld: 'true' })).toBeNull();
  });

  it('drops a view without a usable id or direction', () => {
    expect(mapIllinoisCamera({ ...darrellEast, ImgPath: 'https://travelmidwest.com/showCamera?direction=E' })).toBeNull();
    expect(mapIllinoisCamera({ ...darrellEast, ImgPath: 'https://travelmidwest.com/showCamera?id=IL-LAKECOUNTY-31475&direction=UP' })).toBeNull();
    expect(mapIllinoisCamera({ ...darrellEast, ImgPath: 'https://travelmidwest.com/showCamera?id=IL-LAKECOUNTY-31475&direction=constructor' })).toBeNull();
    expect(mapIllinoisCamera({ ...darrellEast, ImgPath: 'https://travelmidwest.com/showCamera?id=../x&direction=E' })).toBeNull();
    expect(mapIllinoisCamera({ ...darrellEast, ImgPath: null })).toBeNull();
  });

  it('names an undirected view by its location alone', () => {
    const cam = mapIllinoisCamera({ ...darrellEast, ImgPath: 'https://travelmidwest.com/showCamera?id=IL-LAKECOUNTY-31475&direction=NONE' });
    expect(cam).toMatchObject({ id: 'idot-IL-LAKECOUNTY-31475', name: 'Darrell at Roberts (Cell)' });
  });

  it('tidies the location and falls back to the camera id', () => {
    expect(mapIllinoisCamera({ ...darrellEast, CameraLocation: 'Sheridan at Washington Ave  (Cell)' })?.name)
      .toBe('Sheridan at Washington Ave (Cell) – East');
    expect(mapIllinoisCamera({ ...darrellEast, CameraLocation: ' ' })?.name).toBe('IL-LAKECOUNTY-31475 – East');
  });

  it('drops unusable coordinates', () => {
    expect(mapIllinoisCamera({ ...darrellEast, y: 0, x: 0 })).toBeNull();
    expect(mapIllinoisCamera({ ...darrellEast, y: null })).toBeNull();
    expect(mapIllinoisCamera({ ...darrellEast, y: 43.07, x: -89.4 })).toBeNull();
    expect(mapIllinoisCamera(null)).toBeNull();
  });
});

describe('fetchIllinoisCameras', () => {
  const views = (n: number, from = 0) => Array.from({ length: n }, (_, i) => ({
    attributes: { ...darrellEast, ImgPath: `https://travelmidwest.com/showCamera?id=IL-LAKECOUNTY-${from + i}&direction=E` },
  }));

  it('pages the layer, filters to the two still hosts server-side and dedupes', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.json({ features: views(1000) }))
      .mockResolvedValueOnce(Response.json({ features: views(1000, 1000) }))
      .mockResolvedValueOnce(Response.json({ features: [...views(12, 2000), ...views(1), { attributes: hillside }] }));
    vi.stubGlobal('fetch', fetch);
    vi.spyOn(console, 'log').mockImplementation(() => {});

    const cams = await fetchIllinoisCameras();

    expect(cams).toHaveLength(2013);
    expect(fetch).toHaveBeenCalledTimes(3);
    const third = new URL(String(fetch.mock.calls[2][0]));
    expect(third.searchParams.get('resultOffset')).toBe('2000');
    expect(third.searchParams.get('where'))
      .toBe("SnapShot LIKE 'https://www.lakecountypassage.com/%' OR SnapShot LIKE 'https://cctv.travelmidwest.com/%'");
  });

  it('throws on an HTTP error, an ArcGIS error body or a short read', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })));
    await expect(fetchIllinoisCameras()).rejects.toThrow('HTTP 500');
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: { code: 400, message: 'Invalid query' } })));
    await expect(fetchIllinoisCameras()).rejects.toThrow('Invalid query');
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ features: [{ attributes: darrellEast }] })));
    await expect(fetchIllinoisCameras()).rejects.toThrow('short read: 1');
  });
});

// Live integration test — opt in with RUN_LIVE_TESTS=1.
const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('fetchIllinoisCameras (live)', () => {
  liveIt('fetches the Lake County PASSAGE and Travel Midwest views', async () => {
    const cams = await fetchIllinoisCameras();
    expect(cams.length).toBeGreaterThan(2400);
    expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
    const b = ILLINOIS_BOUNDS;
    for (const c of cams) {
      expect(c.lat > b.minLat && c.lat < b.maxLat && c.lng > b.minLng && c.lng < b.maxLng).toBe(true);
      expect(c.feed_url).toMatch(/^(https:\/\/www\.lakecountypassage\.com\/snapshots\/|\/api\/cctv\/proxy\?url=https%3A%2F%2Fcctv\.travelmidwest\.com%2F)/);
    }
  }, 30_000);
});
