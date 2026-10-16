import { afterEach, describe, it, expect, vi } from 'vitest';
import { mapDaeguCamera, streamUrl, fetchDaeguCameras, DAEGU_BOUNDS, type DaeguCamera } from './daegu';

afterEach(() => vi.unstubAllGlobals());

// Trimmed from POST https://car.daegu.go.kr/map/ajax/getCCTVList/ with fac_typ_cd=04 (2026-10-12).
// The first and third rows share facSn 6 under different facTypCd.
const ROWS = `[{"facTypCd":"05","facSn":6,"facNm":"대덕문화전당","facStatCd":"01","addressCd":"27200103","useYn":"Y","coordX":128.577858,"coordY":35.831892,"upterSn":4,"uptDate":"20110609000000","cctvNo":"9,6","cctv":271},{"facTypCd":"04","facSn":181,"facNm":"수성의료지구(돔)","facStatCd":"01","addressCd":"2726012700","addrTyp":"N","addr":"882","useYn":"Y","coordX":128.689434,"coordY":35.83911,"upterSn":86,"uptDate":"20251002104841","cctv":179},{"facTypCd":"04","facSn":6,"facNm":"침산교","facStatCd":"01","addressCd":"2723010600","useYn":"Y","coordX":128.592095,"coordY":35.900691,"upterSn":1,"uptDate":"20110609000000","cctvNo":"4,1","cctv":10}]`;

const rows = (): DaeguCamera[] => JSON.parse(ROWS);
const suseong = (): DaeguCamera => rows()[1];

describe('streamUrl', () => {
  it('picks the server by channel range, as the site does', () => {
    expect(streamUrl(10)).toBe('https://carcctv.daegu.go.kr/live1/_definst_/ch10.stream/playlist.m3u8');
    expect(streamUrl(75)).toContain('/live1/');
    expect(streamUrl(76)).toContain('/live2/');
    expect(streamUrl(179)).toBe('https://carcctv.daegu.go.kr/live3/_definst_/ch179.stream/playlist.m3u8');
    expect(streamUrl(271)).toContain('/live4/');
    expect(streamUrl(301)).toContain('/live6/');
  });

  it('rejects channels the site has no server for', () => {
    expect(streamUrl(0)).toBeNull();
    expect(streamUrl(376)).toBeNull();
    expect(streamUrl(1.5)).toBeNull();
    expect(streamUrl(NaN)).toBeNull();
  });
});

describe('mapDaeguCamera', () => {
  it('maps a camera to its HLS stream', () => {
    expect(mapDaeguCamera(suseong())).toEqual({
      id: 'kr-daegu-04-181',
      lat: 35.83911,
      lng: 128.689434,
      name: '수성의료지구(돔)',
      city: 'Daegu',
      country: 'South Korea',
      stream_url: 'https://carcctv.daegu.go.kr/live3/_definst_/ch179.stream/playlist.m3u8',
      stream_type: 'hls',
      external_url: 'https://car.daegu.go.kr/',
      source: 'Daegu Traffic Info',
    });
  });

  it('keeps cameras that share a facSn under different types apart', () => {
    const [daedeok, , chimsan] = rows();
    expect(mapDaeguCamera(daedeok)?.id).toBe('kr-daegu-05-6');
    expect(mapDaeguCamera(chimsan)?.id).toBe('kr-daegu-04-6');
  });

  it('drops cameras out of service', () => {
    expect(mapDaeguCamera({ ...suseong(), facStatCd: '02' })).toBeNull();
    expect(mapDaeguCamera({ ...suseong(), useYn: 'N' })).toBeNull();
  });

  it('drops missing, zero, swapped and out-of-bounds coordinates', () => {
    expect(mapDaeguCamera({ ...suseong(), coordY: null })).toBeNull();
    expect(mapDaeguCamera({ ...suseong(), coordX: 0, coordY: 0 })).toBeNull();
    expect(mapDaeguCamera({ ...suseong(), coordX: 35.83911, coordY: 128.689434 })).toBeNull();
    // Busan, outside Daegu.
    expect(mapDaeguCamera({ ...suseong(), coordX: 128.999656, coordY: 35.089513 })).toBeNull();
  });

  it('drops rows without an id or a playable channel', () => {
    expect(mapDaeguCamera({ ...suseong(), facSn: null })).toBeNull();
    expect(mapDaeguCamera({ ...suseong(), facTypCd: '../' })).toBeNull();
    expect(mapDaeguCamera({ ...suseong(), cctv: null })).toBeNull();
    expect(mapDaeguCamera({ ...suseong(), cctv: 999 })).toBeNull();
    expect(mapDaeguCamera(null)).toBeNull();
  });

  it('falls back to a default name', () => {
    expect(mapDaeguCamera({ ...suseong(), facNm: ' ' })?.name).toBe('Daegu Camera 04-181');
  });
});

describe('fetchDaeguCameras', () => {
  it('posts the map query and maps the list', async () => {
    const body = JSON.stringify({ trafficFacVO: { fac_typ_cd: '04' }, result: [...rows(), suseong()] });
    const fetchMock = vi.fn(async () => new Response(body, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    expect((await fetchDaeguCameras()).map(c => c.id)).toEqual(['kr-daegu-05-6', 'kr-daegu-04-181', 'kr-daegu-04-6']);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://car.daegu.go.kr/map/ajax/getCCTVList/');
    expect(init).toMatchObject({ method: 'POST', body: 'fac_typ_cd=04' });
  });

  it('throws on an HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
    await expect(fetchDaeguCameras()).rejects.toThrow(/HTTP 503/);
  });

  it('throws on a missing or empty list', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"trafficFacVO":{}}', { status: 200 })));
    await expect(fetchDaeguCameras()).rejects.toThrow(/unexpected response/);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"result":[]}', { status: 200 })));
    await expect(fetchDaeguCameras()).rejects.toThrow(/no playable cameras/);
  });
});

// Live integration test — opt in with RUN_LIVE_TESTS=1.
const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('fetchDaeguCameras (live)', () => {
  liveIt('fetches the Daegu camera list', async () => {
    const cams = await fetchDaeguCameras();
    expect(cams.length).toBeGreaterThan(150);
    expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
    const b = DAEGU_BOUNDS;
    for (const c of cams) {
      expect(c.id).toMatch(/^kr-daegu-\d{2}-\d+$/);
      expect(c.lat > b.minLat && c.lat < b.maxLat && c.lng > b.minLng && c.lng < b.maxLng).toBe(true);
      expect(c.stream_url).toMatch(/^https:\/\/carcctv\.daegu\.go\.kr\/live\d\/_definst_\/ch\d+\.stream\/playlist\.m3u8$/);
    }
  }, 20_000);
});
