import { afterEach, describe, it, expect, vi } from 'vitest';
import { mapNmdotCamera, fetchNmdotCameras, NMDOT_BOUNDS, type NmdotCamera } from './nmdot';

afterEach(() => vi.unstubAllGlobals());

// Verbatim from servicev5.nmroads.com/RealMapWAR/GetCameraInfo.
const camera = {
  sdpFileMedRes: '', mobile: false, videoServer: 'rtmp://video.nmroads.com/nmroads', lon: -106.244, sdpFileLowRes: '',
  title: 'I-25 @ Lower La Bajada', message: '', sdpFileHighRes: 'i25_lowerlabajada.stream', grouping: 'Santa Fe Area',
  demo: null, resolution: 'D1', cameraType: 'iDome', enabled: true,
  snapshotFile: 'http://ss.nmroads.com/snapshots/i25_lowerlabajada.jpg', stream: true, district: 5, sortOrder: 32170,
  name: 'I-25@La_Bajada_Lower', lat: 35.506001,
} as NmdotCamera;

const slashed = {
  sdpFileMedRes: '', mobile: false, videoServer: 'rtmp://video.nmroads.com/nmroads', lon: -106.628156, sdpFileLowRes: '',
  title: 'I-25 @ N of Big I', message: '', sdpFileHighRes: 'i-25n_bigi.stream', grouping: 'Albuquerque Area',
  demo: null, resolution: 'D1', cameraType: 'iDome', enabled: true,
  snapshotFile: 'http://ss.nmroads.com/snapshots/i-25n_bigi.jpg', stream: true, district: 0, sortOrder: 30500,
  name: 'I-25NB/Gore', lat: 35.107995,
} as NmdotCamera;

const statewide = {
  sdpFileMedRes: '', mobile: false, videoServer: 'rtmp://video.nmroads.com/nmroads', lon: -105.188957, sdpFileLowRes: '',
  title: 'Vaughn', message: '', sdpFileHighRes: 'vaughn.stream', grouping: 'Statewide',
  demo: null, resolution: '4CIF', cameraType: 'iDome', enabled: true,
  snapshotFile: 'http://ss.nmroads.com/snapshots/vaughn.jpg', stream: true, district: 2, sortOrder: 0,
  name: 'Vaughn', lat: 34.593368,
} as NmdotCamera;

describe('mapNmdotCamera', () => {
  it('maps a camera to its https still, not the http snapshotFile', () => {
    expect(mapNmdotCamera(camera)).toEqual({
      id: 'nmdot-I-25%40La_Bajada_Lower',
      lat: 35.506001,
      lng: -106.244,
      name: 'I-25 @ Lower La Bajada',
      city: 'Santa Fe Area',
      country: 'US',
      feed_url: 'https://servicev5.nmroads.com/RealMapWAR/GetCameraImage?cameraName=I-25%40La_Bajada_Lower',
      stream_type: 'jpg',
      source: 'NMDOT',
    });
  });

  it('keeps the native id recoverable and URL-safe', () => {
    for (const name of ['I-25NB/Gore', 'I-25 SB @ Comanche On Ramp', 'I-25@La_Bajada_Lower']) {
      const cam = mapNmdotCamera({ ...camera, name });
      const native = cam!.id.slice('nmdot-'.length);
      expect(native).toMatch(/^[\w.!~*'()%-]+$/);
      expect(decodeURIComponent(native)).toBe(name);
      expect(cam!.feed_url).toBe(`https://servicev5.nmroads.com/RealMapWAR/GetCameraImage?cameraName=${native}`);
    }
    expect(mapNmdotCamera(slashed)?.id).toBe('nmdot-I-25NB%2FGore');
  });

  it('drops disabled cameras', () => {
    expect(mapNmdotCamera({ ...camera, enabled: false })).toBeNull();
  });

  it('drops coordinates outside New Mexico', () => {
    expect(mapNmdotCamera({ ...camera, lat: 0, lon: 0 })).toBeNull();
    expect(mapNmdotCamera({ ...camera, lat: 39.74, lon: -104.99 })).toBeNull();
    expect(mapNmdotCamera({ ...camera, lat: null })).toBeNull();
    expect(mapNmdotCamera({ ...camera, lon: undefined })).toBeNull();
  });

  it('drops a camera with no name', () => {
    expect(mapNmdotCamera({ ...camera, name: null })).toBeNull();
    expect(mapNmdotCamera({ ...camera, name: ' ' })).toBeNull();
    expect(mapNmdotCamera(null)).toBeNull();
  });

  it('falls back when the title or grouping is missing, or the grouping is not a place', () => {
    const cam = mapNmdotCamera({ ...slashed, title: ' ', grouping: null });
    expect(cam?.name).toBe('NMDOT Camera I-25NB/Gore');
    expect(cam?.city).toBe('New Mexico');
    expect(mapNmdotCamera(statewide)?.city).toBe('New Mexico');
  });
});

describe('fetchNmdotCameras', () => {
  it('throws on an HTTP error, a bad shape or a short read', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
    await expect(fetchNmdotCameras()).rejects.toThrow('HTTP 503');
    vi.stubGlobal('fetch', vi.fn(async () => Response.json([camera])));
    await expect(fetchNmdotCameras()).rejects.toThrow('no cameraInfo');
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ cameraInfo: [camera, slashed, camera] })));
    await expect(fetchNmdotCameras()).rejects.toThrow('short read: 2');
  });
});

const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

liveIt('fetches a large set of well-formed NMDOT cameras', async () => {
  const cams = await fetchNmdotCameras();
  expect(cams.length).toBeGreaterThan(148);
  expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
  const b = NMDOT_BOUNDS;
  for (const c of cams) {
    expect(c.id).toMatch(/^nmdot-[\w.!~*'()%-]+$/);
    const native = c.id.slice('nmdot-'.length);
    expect(encodeURIComponent(decodeURIComponent(native))).toBe(native);
    expect(c.source).toBe('NMDOT');
    expect(c.feed_url).toBe(`https://servicev5.nmroads.com/RealMapWAR/GetCameraImage?cameraName=${native}`);
    expect(c.lat > b.minLat && c.lat < b.maxLat && c.lng > b.minLng && c.lng < b.maxLng).toBe(true);
  }
}, 20_000);
