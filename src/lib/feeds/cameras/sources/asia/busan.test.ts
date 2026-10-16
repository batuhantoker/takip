import { afterEach, describe, it, expect, vi } from 'vitest';
import { mapBusanCamera, fetchBusanCameras, BUSAN_BOUNDS, type BusanCamera } from './busan';

afterEach(() => vi.unstubAllGlobals());

// Trimmed from https://its.busan.go.kr/api-n/v1/bsits/user/cctvs (2026-10-12).
const SAMPLE = `[{"cctvId":"CTV0000103","instlPos":"사하 국민체육센터","instlAddr":"부산광역시 사하구 감천동 729(감천로)","lot":128.999656,"lat":35.089513,"hlsAddr":"https://its-stream4.busan.go.kr:8443/rtplive/cctv_103.stream/playlist.m3u8","distanceMeter":null},{"cctvId":"CTV0000113","instlPos":"사상역","instlAddr":"부산광역시 사상구 괘법동 558(사상로)","lot":128.984689,"lat":35.161973,"hlsAddr":"https://its-stream2.busan.go.kr:8443/rtplive/2026-EC-03-011.stream/playlist.m3u8","distanceMeter":null}]`;

const rows = (): BusanCamera[] => JSON.parse(SAMPLE);
const saha = (): BusanCamera => rows()[0];

describe('mapBusanCamera', () => {
  it('maps a camera to its HLS stream', () => {
    expect(mapBusanCamera(saha())).toEqual({
      id: 'kr-busan-CTV0000103',
      lat: 35.089513,
      lng: 128.999656,
      name: '사하 국민체육센터',
      city: 'Busan',
      country: 'South Korea',
      stream_url: 'https://its-stream4.busan.go.kr:8443/rtplive/cctv_103.stream/playlist.m3u8',
      stream_type: 'hls',
      external_url: 'https://its.busan.go.kr/traffic/cctv',
      source: 'Busan ITS',
    });
  });

  it('keeps stream names that do not follow the cctv_N pattern', () => {
    expect(mapBusanCamera(rows()[1])?.stream_url).toBe('https://its-stream2.busan.go.kr:8443/rtplive/2026-EC-03-011.stream/playlist.m3u8');
  });

  it('drops missing, zero, swapped and out-of-bounds coordinates', () => {
    expect(mapBusanCamera({ ...saha(), lat: null })).toBeNull();
    expect(mapBusanCamera({ ...saha(), lat: 0, lot: 0 })).toBeNull();
    expect(mapBusanCamera({ ...saha(), lat: 128.999656, lot: 35.089513 })).toBeNull();
    // Ulsan, outside Busan.
    expect(mapBusanCamera({ ...saha(), lat: 35.5384, lot: 129.3114 })).toBeNull();
  });

  it('drops cameras without a usable https stream on the ITS hosts', () => {
    const url = saha().hlsAddr!;
    expect(mapBusanCamera({ ...saha(), hlsAddr: url.replace('https:', 'http:') })).toBeNull();
    expect(mapBusanCamera({ ...saha(), hlsAddr: url.replace('its-stream4.busan.go.kr', 'evil.example') })).toBeNull();
    expect(mapBusanCamera({ ...saha(), hlsAddr: url.replace('playlist.m3u8', 'snapshot.jpg') })).toBeNull();
    expect(mapBusanCamera({ ...saha(), hlsAddr: null })).toBeNull();
  });

  it('drops rows without an id', () => {
    expect(mapBusanCamera({ ...saha(), cctvId: null })).toBeNull();
    expect(mapBusanCamera({ ...saha(), cctvId: '../x' })).toBeNull();
    expect(mapBusanCamera(null)).toBeNull();
  });

  it('falls back to a default name', () => {
    expect(mapBusanCamera({ ...saha(), instlPos: ' ' })?.name).toBe('Busan Camera CTV0000103');
  });
});

describe('fetchBusanCameras', () => {
  it('fetches, maps and dedupes the list', async () => {
    const body = JSON.stringify([...rows(), saha(), { ...saha(), cctvId: 'CTV0000999', hlsAddr: '' }]);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status: 200 })));
    expect((await fetchBusanCameras()).map(c => c.id)).toEqual(['kr-busan-CTV0000103', 'kr-busan-CTV0000113']);
  });

  it('throws on an HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
    await expect(fetchBusanCameras()).rejects.toThrow(/HTTP 503/);
  });

  it('throws on a non-list or an empty list', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"status":500}', { status: 200 })));
    await expect(fetchBusanCameras()).rejects.toThrow(/unexpected response/);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('[]', { status: 200 })));
    await expect(fetchBusanCameras()).rejects.toThrow(/no playable cameras/);
  });
});

// Live integration test — opt in with RUN_LIVE_TESTS=1.
const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('fetchBusanCameras (live)', () => {
  liveIt('fetches the Busan ITS camera list', async () => {
    const cams = await fetchBusanCameras();
    expect(cams.length).toBeGreaterThan(280);
    expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
    const b = BUSAN_BOUNDS;
    for (const c of cams) {
      expect(c.id).toMatch(/^kr-busan-[\w-]+$/);
      expect(c.lat > b.minLat && c.lat < b.maxLat && c.lng > b.minLng && c.lng < b.maxLng).toBe(true);
      expect(c.stream_url).toMatch(/^https:\/\/its-stream\d+\.busan\.go\.kr:8443\/rtplive\/[^/]+\/playlist\.m3u8$/);
    }
  }, 20_000);
});
