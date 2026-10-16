import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cityName, fetchOkTrafficCameras, mapOkTrafficCamera, OKTRAFFIC_BOUNDS, type OkTrafficCamera,
} from './oktraffic';

// Verbatim from oktraffic.org/api/CameraPoles (pole 3, "I-44 & I-240").
const camera = {
  latitude: '35.39637', longitude: '-97.57406', location: 'I-44 & I-240 N', port: 6969, cameraId: 0,
  model: 'P1347', make: 'Axis', type: 'Web', videoChannel: 0, acquiredStatus: 'N', decoderType: 10,
  status: 'Free', id: 1103130967, userPort: 0, direction: 'N', workzoneId: 0, recordTime: '2026-10-12 12:20:42',
  holdIncident: 0, blockAtis: '0', city: 'Oklahoma City', incidentHoldTime: '0000-00-00-00:00:00', videoPort: 0,
  urlVar: 'axis-media/media.amp?resolution=800x600&camera=2', videoProfile: 1, needsTimeoutPlayer: false,
  streamDictionary: {
    streamKey: 'a055fe234967b032.stream', streamName: 'I-44 & I-240 N',
    streamSrc: 'https://stream.oktraffic.org/delay-stream/a055fe234967b032.stream/playlist.m3u8',
    streamingServer: 'wowza', id: 1639337, mapCameraId: 1103130967,
  },
} as OkTrafficCamera;

// Verbatim from the same feed (pole 39, "I-40 & Douglas"); its playlist 404s.
const construction = {
  latitude: '35.43234', longitude: '-97.37056', location: 'I-40 & Douglas S', port: 6969, cameraId: 0,
  model: 'P1455', make: 'Axis', type: 'Web', videoChannel: 0, acquiredStatus: 'N', decoderType: 10,
  status: 'Construction', id: 42, userPort: 0, direction: 'S', workzoneId: 0, recordTime: '2026-10-12 12:20:44',
  holdIncident: 0, blockAtis: '0', city: 'Midwest City', incidentHoldTime: '0000-00-00-00:00:00', videoPort: 0,
  urlVar: 'axis-media/media.amp?resolution=800x600&camera=2', videoProfile: 1, needsTimeoutPlayer: false,
  streamDictionary: {
    streamKey: '7349571a48d445cc.stream', streamName: 'I-40 & Douglas S',
    streamSrc: 'https://stream.oktraffic.org/delay-stream/7349571a48d445cc.stream/playlist.m3u8',
    streamingServer: 'wowza', id: 1639315, mapCameraId: 42,
  },
} as OkTrafficCamera;

const src = (streamSrc: string | null) => ({ streamDictionary: { streamSrc } });

describe('mapOkTrafficCamera', () => {
  it('maps a public camera to its HLS stream, with no still', () => {
    expect(mapOkTrafficCamera(camera, 'I-44 & I-240')).toEqual({
      id: 'okdot-1103130967',
      lat: 35.39637,
      lng: -97.57406,
      name: 'I-44 & I-240 N',
      city: 'Oklahoma City',
      country: 'US',
      stream_url: 'https://stream.oktraffic.org/delay-stream/a055fe234967b032.stream/playlist.m3u8',
      stream_type: 'hls',
      source: 'ODOT Oklahoma',
    });
  });

  it('drops cameras that are not public web cameras in service', () => {
    expect(mapOkTrafficCamera(construction)).toBeNull();
    expect(mapOkTrafficCamera({ ...camera, status: 'Out Of Service' })).toBeNull();
    expect(mapOkTrafficCamera({ ...camera, status: null })).toBeNull();
    expect(mapOkTrafficCamera({ ...camera, blockAtis: '1' })).toBeNull();
    expect(mapOkTrafficCamera({ ...camera, blockAtis: null })).toBeNull();
    expect(mapOkTrafficCamera({ ...camera, type: 'CCTV' })).toBeNull();
    expect(mapOkTrafficCamera({ ...camera, type: 'Security' })).toBeNull();
    expect(mapOkTrafficCamera(null)).toBeNull();
  });

  it('drops streams that are not https on stream.oktraffic.org', () => {
    const https = camera.streamDictionary!.streamSrc!;
    expect(mapOkTrafficCamera({ ...camera, ...src(https.replace('https:', 'http:')) })).toBeNull();
    expect(mapOkTrafficCamera({ ...camera, ...src(https.replace('stream.oktraffic.org', 'stream.oktraffic.org.evil.com')) })).toBeNull();
    expect(mapOkTrafficCamera({ ...camera, ...src(https.replace('stream.oktraffic.org', 'stream.oktraffic.org:8443')) })).toBeNull();
    expect(mapOkTrafficCamera({ ...camera, ...src('delay-stream/a055fe234967b032.stream/playlist.m3u8') })).toBeNull();
    expect(mapOkTrafficCamera({ ...camera, ...src(null) })).toBeNull();
    expect(mapOkTrafficCamera({ ...camera, streamDictionary: null })).toBeNull();
  });

  it('drops rows without a numeric id or inside-Oklahoma coordinates', () => {
    expect(mapOkTrafficCamera({ ...camera, id: null })).toBeNull();
    expect(mapOkTrafficCamera({ ...camera, id: '1103130967' as unknown as number })).toBeNull();
    expect(mapOkTrafficCamera({ ...camera, id: 1.5 })).toBeNull();
    expect(mapOkTrafficCamera({ ...camera, latitude: '0', longitude: '0' })).toBeNull();
    expect(mapOkTrafficCamera({ ...camera, latitude: '' })).toBeNull();
    expect(mapOkTrafficCamera({ ...camera, longitude: '97.57406' })).toBeNull();
  });

  it('falls back to the pole name and direction, then the id', () => {
    expect(mapOkTrafficCamera({ ...camera, location: ' ' }, 'I-44 & I-240')?.name).toBe('I-44 & I-240 N');
    expect(mapOkTrafficCamera({ ...camera, location: null, direction: null })?.name).toBe('ODOT Camera 1103130967');
    expect(mapOkTrafficCamera({ ...camera, location: 'JKT & SH-66 ' })?.name).toBe('JKT & SH-66');
  });
});

describe('cityName', () => {
  it('trims and normalises the city', () => {
    expect(cityName('Oklahoma City ')).toBe('Oklahoma City');
    expect(cityName('Moore ')).toBe('Moore');
    expect(cityName('OKC')).toBe('Oklahoma City');
    expect(cityName('Oklahoma city')).toBe('Oklahoma City');
    expect(cityName('Kay')).toBe('Kay County');
  });

  it('falls back to the state for placeholders', () => {
    expect(cityName('N/A')).toBe('Oklahoma');
    expect(cityName('POE')).toBe('Oklahoma');
    expect(cityName(' ')).toBe('Oklahoma');
    expect(cityName(null)).toBe('Oklahoma');
    expect(cityName('constructor')).toBe('constructor');
  });
});

describe('fetchOkTrafficCameras (mocked network)', () => {
  beforeEach(() => { vi.spyOn(console, 'log').mockImplementation(() => {}); });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('sends the public-camera filter, maps every pole and dedupes by id', async () => {
    const poles = [
      { id: 3, name: 'I-44 & I-240', mapCameras: [camera, construction, null] },
      { id: 4, name: 'dup', mapCameras: [camera, { ...camera, id: 7 }] },
      { id: 5, name: 'empty', mapCameras: [] },
      { id: 6, name: 'none' },
      null,
    ];
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json(poles));
    vi.stubGlobal('fetch', fetchMock);

    expect((await fetchOkTrafficCameras()).map(c => c.id)).toEqual(['okdot-1103130967', 'okdot-7']);
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.origin + url.pathname).toBe('https://oktraffic.org/api/CameraPoles');
    expect(JSON.parse(url.searchParams.get('filter')!)).toEqual({
      include: [{
        relation: 'mapCameras',
        scope: { include: 'streamDictionary', where: { status: { neq: 'Out Of Service' }, type: 'Web', blockAtis: { neq: '1' } } },
      }],
    });
  });

  it('throws on an HTTP error, a challenge page or no usable cameras', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 403 })));
    await expect(fetchOkTrafficCameras()).rejects.toThrow('HTTP 403');

    vi.stubGlobal('fetch', vi.fn(async () => new Response('<!DOCTYPE html><title>Just a moment...</title>')));
    await expect(fetchOkTrafficCameras()).rejects.toThrow('unexpected response');

    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: { statusCode: 500 } })));
    await expect(fetchOkTrafficCameras()).rejects.toThrow('unexpected response');

    vi.stubGlobal('fetch', vi.fn(async () => Response.json([{ name: 'x', mapCameras: [construction] }])));
    await expect(fetchOkTrafficCameras()).rejects.toThrow('none usable of 1');
  });
});

// Live integration test — opt in with RUN_LIVE_TESTS=1.
const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('fetchOkTrafficCameras (live)', () => {
  liveIt('fetches the public cameras', async () => {
    const cams = await fetchOkTrafficCameras();
    expect(cams.length).toBeGreaterThan(365);
    expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
    const b = OKTRAFFIC_BOUNDS;
    for (const c of cams) {
      expect(c.id).toMatch(/^okdot-\d+$/);
      expect(c.source).toBe('ODOT Oklahoma');
      expect(c.lat > b.minLat && c.lat < b.maxLat && c.lng > b.minLng && c.lng < b.maxLng).toBe(true);
      expect(c.stream_type).toBe('hls');
      expect(c.stream_url).toMatch(/^https:\/\/stream\.oktraffic\.org\/delay-stream\/[\w-]+\.stream\/playlist\.m3u8$/);
      expect(c.feed_url).toBeUndefined();
      expect(c.city).toBe(c.city.trim());
      expect(c.city).not.toBe('OKC');
    }
  }, 20_000);
});
