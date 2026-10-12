import { afterEach, describe, it, expect, vi } from 'vitest';
import {
  mapIbbCamera, parseIbbCameras, fetchIstanbulIbbCameras, ISTANBUL_IBB_BOUNDS, type IbbCamera,
} from './istanbul-ibb';

afterEach(() => vi.unstubAllGlobals());

// Verbatim from https://tkmservices.ibb.gov.tr/web/api/IntensityMap/v1/Camera.
const SAMPLE = `[{"Group":[],"ID":4,"Name":"ALİBEYKÖY MEYDANI","XCoord":"28.94778426","YCoord":"41.07454609","VideoURL":"https://hls.ibb.gov.tr/tkm2/hls/4.stream/playlist.m3u8","VideoURL_SSL":"https://hls.ibb.gov.tr/tkm2/hls/4.stream/playlist.m3u8","GroupId":0,"Images":["https://tkmservices.ibb.gov.tr/web/Handlers/CameraImage.ashx?pno=0&cno=4","https://tkmservices.ibb.gov.tr/web/Handlers/CameraImage.ashx?pno=1&cno=4","https://tkmservices.ibb.gov.tr/web/Handlers/CameraImage.ashx?pno=2&cno=4"]},{"Group":[{"ID":59,"Name":"B.DERE CD. MASLAK 1","XCoord":"29.02054036","YCoord":"41.10843362","VideoURL":"","VideoURL_SSL":"","GroupId":58,"Images":["https://tkmservices.ibb.gov.tr/web/Handlers/CameraImage.ashx?pno=0&cno=59","https://tkmservices.ibb.gov.tr/web/Handlers/CameraImage.ashx?pno=1&cno=59","https://tkmservices.ibb.gov.tr/web/Handlers/CameraImage.ashx?pno=2&cno=59"]}],"ID":58,"Name":"B.DERE CD. MASLAK","XCoord":"29.02054036","YCoord":"41.10843362","VideoURL":"https://hls.ibb.gov.tr/tkm2/hls/58.stream/playlist.m3u8","VideoURL_SSL":"https://hls.ibb.gov.tr/tkm2/hls/58.stream/playlist.m3u8","GroupId":0,"Images":["https://tkmservices.ibb.gov.tr/web/Handlers/CameraImage.ashx?pno=0&cno=58","https://tkmservices.ibb.gov.tr/web/Handlers/CameraImage.ashx?pno=1&cno=58","https://tkmservices.ibb.gov.tr/web/Handlers/CameraImage.ashx?pno=2&cno=58"]}]`;

const rows = (): IbbCamera[] => JSON.parse(SAMPLE);
const alibeykoy = (): IbbCamera => rows()[0];

describe('mapIbbCamera', () => {
  it('maps a camera to its HLS stream', () => {
    expect(mapIbbCamera(alibeykoy())).toEqual({
      id: 'tr-ibb-4',
      lat: 41.07454609,
      lng: 28.94778426,
      name: 'ALİBEYKÖY MEYDANI',
      city: 'Istanbul',
      country: 'Turkey',
      stream_url: 'https://hls.ibb.gov.tr/tkm2/hls/4.stream/playlist.m3u8',
      stream_type: 'hls',
      external_url: 'https://uym.ibb.gov.tr/yharita6/',
      source: 'İBB',
    });
  });

  it('reads YCoord as latitude and XCoord as longitude', () => {
    const cam = mapIbbCamera(alibeykoy());
    expect(cam?.lat).toBeCloseTo(41.07, 2);
    expect(cam?.lng).toBeCloseTo(28.95, 2);
    expect(mapIbbCamera({ ...alibeykoy(), XCoord: '41.07454609', YCoord: '28.94778426' })).toBeNull();
  });

  it('drops coordinates outside İstanbul', () => {
    expect(mapIbbCamera({ ...alibeykoy(), XCoord: '0', YCoord: '0' })).toBeNull();
    expect(mapIbbCamera({ ...alibeykoy(), XCoord: '', YCoord: '' })).toBeNull();
    expect(mapIbbCamera({ ...alibeykoy(), YCoord: null })).toBeNull();
  });

  it('drops cameras without a usable https stream', () => {
    expect(mapIbbCamera({ ...alibeykoy(), VideoURL_SSL: '' })).toBeNull();
    expect(mapIbbCamera({ ...alibeykoy(), VideoURL_SSL: 'http://hls.ibb.gov.tr/tkm2/hls/4.stream/playlist.m3u8' })).toBeNull();
    expect(mapIbbCamera({ ...alibeykoy(), VideoURL_SSL: 'https://tkmservices.ibb.gov.tr/web/Handlers/CameraImage.ashx?pno=0&cno=4' })).toBeNull();
  });

  it('trims the stray semicolon some stream URLs end in', () => {
    // Verbatim row from the same response.
    const row: IbbCamera = JSON.parse(`{"Group":[],"ID":663,"Name":"04077 BAĞCILAR","XCoord":"28.846809","YCoord":"41.028243","VideoURL":"https://hls.ibb.gov.tr/tkm2/hls/663.stream/playlist.m3u8;","VideoURL_SSL":"https://hls.ibb.gov.tr/tkm2/hls/663.stream/playlist.m3u8;","GroupId":0,"Images":["https://tkmservices.ibb.gov.tr/web/Handlers/CameraImage.ashx?pno=0&cno=663","https://tkmservices.ibb.gov.tr/web/Handlers/CameraImage.ashx?pno=1&cno=663","https://tkmservices.ibb.gov.tr/web/Handlers/CameraImage.ashx?pno=2&cno=663"]}`);
    expect(mapIbbCamera(row)?.stream_url).toBe('https://hls.ibb.gov.tr/tkm2/hls/663.stream/playlist.m3u8');
  });

  it('drops rows without an id', () => {
    expect(mapIbbCamera({ ...alibeykoy(), ID: null })).toBeNull();
    expect(mapIbbCamera({ ...alibeykoy(), ID: 0 })).toBeNull();
    expect(mapIbbCamera(null)).toBeNull();
  });

  it('normalises whitespace in names and falls back to a default', () => {
    expect(mapIbbCamera({ ...alibeykoy(), Name: '  ALİBEYKÖY   MEYDANI ' })?.name).toBe('ALİBEYKÖY MEYDANI');
    expect(mapIbbCamera({ ...alibeykoy(), Name: ' ' })?.name).toBe('İBB Camera 4');
  });
});

describe('parseIbbCameras', () => {
  it('keeps grouped cameras with video and drops picture-only ones', () => {
    expect(parseIbbCameras(rows()).map(c => c.id)).toEqual(['tr-ibb-4', 'tr-ibb-58']);
  });

  it('lists each extra direction of a junction as its own camera', () => {
    const [, maslak] = rows();
    maslak.Group![0].VideoURL_SSL = 'https://hls.ibb.gov.tr/tkm2/hls/59.stream/playlist.m3u8';
    const cams = parseIbbCameras([maslak]);
    expect(cams.map(c => [c.id, c.name])).toEqual([
      ['tr-ibb-58', 'B.DERE CD. MASLAK'],
      ['tr-ibb-59', 'B.DERE CD. MASLAK 1'],
    ]);
    expect(cams[1].stream_url).toBe('https://hls.ibb.gov.tr/tkm2/hls/59.stream/playlist.m3u8');
  });

  it('collapses duplicate ids', () => {
    expect(parseIbbCameras([alibeykoy(), alibeykoy(), null]).map(c => c.id)).toEqual(['tr-ibb-4']);
  });

  it('returns nothing for an empty list and rejects a non-list', () => {
    expect(parseIbbCameras([])).toEqual([]);
    expect(() => parseIbbCameras({ Message: 'An error has occurred.' })).toThrow(/unexpected response/);
  });
});

describe('fetchIstanbulIbbCameras', () => {
  it('fetches and maps the list', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(SAMPLE, { status: 200 })));
    expect((await fetchIstanbulIbbCameras()).map(c => c.id)).toEqual(['tr-ibb-4', 'tr-ibb-58']);
  });

  it('throws on an HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
    await expect(fetchIstanbulIbbCameras()).rejects.toThrow(/HTTP 503/);
  });

  it('throws when no camera is playable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('[]', { status: 200 })));
    await expect(fetchIstanbulIbbCameras()).rejects.toThrow(/no playable cameras/);
  });
});

// Live integration test — opt in with RUN_LIVE_TESTS=1.
const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('fetchIstanbulIbbCameras (live)', () => {
  liveIt('fetches the camera list', async () => {
    const cams = await fetchIstanbulIbbCameras();
    expect(cams.length).toBeGreaterThan(500);
    expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
    const b = ISTANBUL_IBB_BOUNDS;
    for (const c of cams) {
      expect(c.id).toMatch(/^tr-ibb-\d+$/);
      expect(c.lat > b.minLat && c.lat < b.maxLat && c.lng > b.minLng && c.lng < b.maxLng).toBe(true);
      expect(c.stream_url).toMatch(/^https:\/\/hls\.ibb\.gov\.tr\/tkm\d+\/hls\/\d+\.stream\/playlist\.m3u8$/);
    }
  }, 20_000);
});
