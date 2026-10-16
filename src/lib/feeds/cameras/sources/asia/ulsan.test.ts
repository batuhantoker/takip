import { afterEach, describe, it, expect, vi } from 'vitest';
import { mapUlsanCamera, fetchUlsanCameras, ULSAN_BOUNDS, type UlsanCamera } from './ulsan';

afterEach(() => vi.unstubAllGlobals());

// Trimmed from POST https://its.ulsan.kr/mpng/getList.json (cctvService.getGridList, 2026-10-12).
const ROWS = `[{"cdId":315,"cdNm":"C1020","cdArea":"남구","xCrdn":129.306778,"yCrdn":35.531957,"addr":"https://webcctv.its.ulsan.kr:7083/server2/live/T2134_02/visumy.m3u8"},{"cdId":322,"cdNm":"KT남울산","cdArea":"남구","xCrdn":129.334228,"yCrdn":35.522613,"addr":"https://webcctv.its.ulsan.kr:7083/server2/live/T2167_02/visumy.m3u8"}]`;

const rows = (): UlsanCamera[] => JSON.parse(ROWS);
const ktNamUlsan = (): UlsanCamera => rows()[1];
const envelope = (r: unknown[], totalCnt = r.length) =>
  JSON.stringify({ totalCnt, totalPage: 0, resultCode: '200', resultMsg: '데이터를 조회하는데 성공하였습니다.', rows: r });

describe('mapUlsanCamera', () => {
  it('maps a camera to its HLS stream', () => {
    expect(mapUlsanCamera(ktNamUlsan())).toEqual({
      id: 'kr-ulsan-322',
      lat: 35.522613,
      lng: 129.334228,
      name: 'KT남울산',
      city: 'Ulsan',
      country: 'South Korea',
      stream_url: 'https://webcctv.its.ulsan.kr:7083/server2/live/T2167_02/visumy.m3u8',
      stream_type: 'hls',
      external_url: 'https://its.ulsan.kr/traffic/cctv.do',
      source: 'Ulsan ITS',
    });
  });

  it('reads yCrdn as latitude and xCrdn as longitude', () => {
    expect(mapUlsanCamera({ ...ktNamUlsan(), xCrdn: 35.522613, yCrdn: 129.334228 })).toBeNull();
  });

  it('drops missing, zero and out-of-bounds coordinates', () => {
    expect(mapUlsanCamera({ ...ktNamUlsan(), yCrdn: null })).toBeNull();
    expect(mapUlsanCamera({ ...ktNamUlsan(), xCrdn: 0, yCrdn: 0 })).toBeNull();
    // Busan, outside Ulsan.
    expect(mapUlsanCamera({ ...ktNamUlsan(), xCrdn: 128.999656, yCrdn: 35.089513 })).toBeNull();
  });

  it('drops cameras without a usable https stream on the ITS host', () => {
    const url = ktNamUlsan().addr!;
    expect(mapUlsanCamera({ ...ktNamUlsan(), addr: url.replace('https:', 'http:') })).toBeNull();
    expect(mapUlsanCamera({ ...ktNamUlsan(), addr: url.replace('webcctv.its.ulsan.kr', 'evil.example') })).toBeNull();
    expect(mapUlsanCamera({ ...ktNamUlsan(), addr: '' })).toBeNull();
  });

  it('drops rows without an id', () => {
    expect(mapUlsanCamera({ ...ktNamUlsan(), cdId: null })).toBeNull();
    expect(mapUlsanCamera({ ...ktNamUlsan(), cdId: 0 })).toBeNull();
    expect(mapUlsanCamera(null)).toBeNull();
  });

  it('keeps code-only names and falls back to a default', () => {
    expect(mapUlsanCamera(rows()[0])?.name).toBe('C1020');
    expect(mapUlsanCamera({ ...ktNamUlsan(), cdNm: ' ' })?.name).toBe('Ulsan Camera 322');
  });
});

describe('fetchUlsanCameras', () => {
  it('posts the map query and maps the list', async () => {
    const fetchMock = vi.fn(async () => new Response(envelope([...rows(), ktNamUlsan()], 3), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    expect((await fetchUlsanCameras()).map(c => c.id)).toEqual(['kr-ulsan-315', 'kr-ulsan-322']);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://its.ulsan.kr/mpng/getList.json');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ postData: { serviceName: 'cctvService', methodName: 'getGridList', paging: false } });
  });

  it('throws on an HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
    await expect(fetchUlsanCameras()).rejects.toThrow(/HTTP 503/);
  });

  it('throws on an error envelope, a short read or an empty list', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"resultCode":"300","rows":[]}', { status: 200 })));
    await expect(fetchUlsanCameras()).rejects.toThrow(/unexpected response/);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(envelope(rows(), 232), { status: 200 })));
    await expect(fetchUlsanCameras()).rejects.toThrow(/short read/);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(envelope([]), { status: 200 })));
    await expect(fetchUlsanCameras()).rejects.toThrow(/no playable cameras/);
  });
});

// Live integration test — opt in with RUN_LIVE_TESTS=1.
const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('fetchUlsanCameras (live)', () => {
  liveIt('fetches the Ulsan ITS camera list', async () => {
    const cams = await fetchUlsanCameras();
    expect(cams.length).toBeGreaterThan(180);
    expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
    const b = ULSAN_BOUNDS;
    for (const c of cams) {
      expect(c.id).toMatch(/^kr-ulsan-\d+$/);
      expect(c.lat > b.minLat && c.lat < b.maxLat && c.lng > b.minLng && c.lng < b.maxLng).toBe(true);
      expect(c.stream_url).toMatch(/^https:\/\/webcctv\.its\.ulsan\.kr:7083\/server\d+\/live\/[\w-]+\/visumy\.m3u8$/);
    }
  }, 20_000);
});
