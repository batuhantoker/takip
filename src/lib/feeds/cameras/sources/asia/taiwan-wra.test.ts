import { afterEach, describe, it, expect, vi } from 'vitest';
import { mapWraCamera, fetchTaiwanWraCameras, TAIWAN_WRA_BOUNDS, type WraCamera } from './taiwan-wra';

afterEach(() => vi.unstubAllGlobals());

// Trimmed from opendata.wra.gov.tw/api/v2/f71b74eb-cbe5-42c6-8be5-7500450e7db0?format=JSON (2026-10-12).
const SAMPLE = `[{"administrativedistrictwherethemonitoringpointislocated":"大湖鄉","basinname":"後龍溪","cameraid":"1609","cameraname":"大湖南湖二橋(固定)","coordinate":"WGS84","countiesandcitieswherethemonitoringpointsarelocated":"苗栗縣","imageformat":"JPG","imageurl":"https:\\/\\/fmg.wra.gov.tw\\/109wraweb\\/getImage.aspx?mode=getNewImageS&CCTV_SN=0x0200000084473ABE0819D3A38A0C15886487261EEF4B92DF77533E2F9D166BF8C222CE887A6F5F143A3D9DC64FBC14D38D9A4319","latitude_4326":"24.398625","longitude_4326":"120.868575","rivercode":"135000","status":"1","tributary":"南湖溪","videosurveillancestationname":"大湖南湖二橋"},{"administrativedistrictwherethemonitoringpointislocated":"吉安鄉","basinname":"花蓮溪","cameraid":"1864","cameraname":"南濱守望哨(旋轉)","coordinate":"WGS84","countiesandcitieswherethemonitoringpointsarelocated":"花蓮縣","imageformat":"JPG","imageurl":"https:\\/\\/fmg.wra.gov.tw\\/109wraweb\\/getImage.aspx?mode=getNewImageS&CCTV_SN=0x02000000C27F995008D66AF59DAEB1E0E0DFC2723CBC3F4A54A6A4BDF0CB14FFA3323E8F3AA1275E121C1B7B83A161FFDED4DC5E","latitude_4326":"23.962397","longitude_4326":"121.60695","rivercode":"242000","status":"1","tributary":"聯合排水","videosurveillancestationname":"南濱守望哨"}]`;

const rows = (): WraCamera[] => JSON.parse(SAMPLE);
const dahu = (): WraCamera => rows()[0];

describe('mapWraCamera', () => {
  it('maps a camera to its still', () => {
    expect(mapWraCamera(dahu())).toEqual({
      id: 'tw-wra-1609',
      lat: 24.398625,
      lng: 120.868575,
      name: '大湖南湖二橋(固定)',
      city: '苗栗縣',
      country: 'Taiwan',
      feed_url: 'https://fmg.wra.gov.tw/109wraweb/getImage.aspx?mode=getNewImageS&CCTV_SN=0x0200000084473ABE0819D3A38A0C15886487261EEF4B92DF77533E2F9D166BF8C222CE887A6F5F143A3D9DC64FBC14D38D9A4319',
      stream_type: 'jpg',
      external_url: 'https://fhy.wra.gov.tw/fhyv2/monitor/cctv',
      source: 'WRA',
    });
  });

  it('drops cameras out of service or without a numeric id', () => {
    expect(mapWraCamera({ ...dahu(), status: '0' })).toBeNull();
    expect(mapWraCamera({ ...dahu(), status: null })).toBeNull();
    expect(mapWraCamera({ ...dahu(), cameraid: '' })).toBeNull();
    expect(mapWraCamera({ ...dahu(), cameraid: '16/09' })).toBeNull();
    expect(mapWraCamera(null)).toBeNull();
  });

  it('drops missing, zero, swapped and out-of-bounds coordinates', () => {
    expect(mapWraCamera({ ...dahu(), latitude_4326: '', longitude_4326: '' })).toBeNull();
    expect(mapWraCamera({ ...dahu(), latitude_4326: null })).toBeNull();
    expect(mapWraCamera({ ...dahu(), latitude_4326: '0', longitude_4326: '0' })).toBeNull();
    expect(mapWraCamera({ ...dahu(), latitude_4326: '120.868575', longitude_4326: '24.398625' })).toBeNull();
    // Kinmen sits outside the box.
    expect(mapWraCamera({ ...dahu(), latitude_4326: '24.43', longitude_4326: '118.32' })).toBeNull();
  });

  it('only accepts https stills on the WRA image host', () => {
    const url = dahu().imageurl!;
    expect(mapWraCamera({ ...dahu(), imageurl: url.replace('https:', 'http:') })).toBeNull();
    expect(mapWraCamera({ ...dahu(), imageurl: url.replace('fmg.wra.gov.tw', 'evil.example') })).toBeNull();
    expect(mapWraCamera({ ...dahu(), imageurl: '' })).toBeNull();
    expect(mapWraCamera({ ...dahu(), imageurl: null })).toBeNull();
  });

  it('falls back to the station name, then a default', () => {
    expect(mapWraCamera({ ...dahu(), cameraname: ' ' })?.name).toBe('大湖南湖二橋');
    expect(mapWraCamera({ ...dahu(), cameraname: null, videosurveillancestationname: null })?.name).toBe('WRA Camera 1609');
  });
});

describe('fetchTaiwanWraCameras', () => {
  it('fetches, maps and dedupes the list', async () => {
    const body = JSON.stringify([...rows(), dahu(), { ...dahu(), cameraid: '9', status: '0' }]);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status: 200 })));
    expect((await fetchTaiwanWraCameras()).map(c => c.id)).toEqual(['tw-wra-1609', 'tw-wra-1864']);
  });

  it('throws on an HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
    await expect(fetchTaiwanWraCameras()).rejects.toThrow(/HTTP 503/);
  });

  it('throws on a non-list or an empty list', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"message":"error"}', { status: 200 })));
    await expect(fetchTaiwanWraCameras()).rejects.toThrow(/unexpected response/);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('[]', { status: 200 })));
    await expect(fetchTaiwanWraCameras()).rejects.toThrow(/no cameras/);
  });
});

// Live integration test — opt in with RUN_LIVE_TESTS=1.
const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('fetchTaiwanWraCameras (live)', () => {
  liveIt('fetches the WRA camera list', async () => {
    const cams = await fetchTaiwanWraCameras();
    expect(cams.length).toBeGreaterThan(100);
    expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
    const b = TAIWAN_WRA_BOUNDS;
    for (const c of cams) {
      expect(c.id).toMatch(/^tw-wra-\d+$/);
      expect(c.lat > b.minLat && c.lat < b.maxLat && c.lng > b.minLng && c.lng < b.maxLng).toBe(true);
      expect(c.feed_url).toMatch(/^https:\/\/fmg\.wra\.gov\.tw\/109wraweb\/getImage\.aspx\?/);
    }
  }, 20_000);
});
