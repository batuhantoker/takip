import { afterEach, describe, it, expect, vi } from 'vitest';
import { mapAlgoCamera, fetchAlgoCameras, ALGO_BOUNDS, type AlgoCamera } from './algotraffic';

afterEach(() => vi.unstubAllGlobals());

// Trimmed rows from api.algotraffic.com/v4.0/Cameras (2026-10-12).
const mcdonald = {
  id: 1845,
  location: {
    latitude: 30.535104999999998, longitude: -88.23953, city: 'Mobile', county: 'Mobile',
    displayRouteDesignator: 'I-10', routeDesignator: 'I-10', displayCrossStreet: 'McDonald Rd', crossStreet: '',
    direction: 'East', linearReference: 10.5,
  },
  responsibleRegion: 'Southwest',
  playbackUrls: {
    hls: 'https://cdn3.wowza.com/5/b3FOYzhMRS9aVlI1/mobile-fastly/mob-cam-c095.stream/playlist.m3u8',
    dash: 'https://cdn3.wowza.com/5/b3FOYzhMRS9aVlI1/mobile-fastly/mob-cam-c095.stream/manifest.mpd',
  },
  accessLevel: 'Public', mapLayer: 'Camera',
  permLink: 'https://www.algotraffic.com?cameraId=1845',
  snapshotImageUrl: 'https://api.algotraffic.com/v4/Cameras/1845/snapshot.jpg',
  mapImageUrl: 'https://api.algotraffic.com/v4/Cameras/1845/map@1x.jpg',
} as AlgoCamera;
// Hidden from the public map.
const firstResponder = {
  id: 1189,
  location: {
    latitude: 33.506299999999996, longitude: -86.887924, city: 'Birmingham', county: 'Jefferson',
    displayRouteDesignator: 'I-20/59', routeDesignator: 'I-20/I-59', displayCrossStreet: '20th St. Ens.', crossStreet: '',
    direction: 'East', linearReference: 121.0,
  },
  playbackUrls: {
    hls: 'https://cdn3.wowza.com/5/a1dpQ3BEeW15ZE1l/bhm-fastly/bhm-cam-2059-121.stream/playlist.m3u8',
  },
  accessLevel: 'FirstResponder',
  permLink: 'https://www.algotraffic.com?cameraId=1189',
  snapshotImageUrl: 'https://api.algotraffic.com/v4/Cameras/1189/snapshot.jpg',
} as AlgoCamera;
const panning = {
  id: 1153,
  location: {
    latitude: 30.639999999999997, longitude: -88.08919999999999, city: 'Mobile', county: 'Mobile',
    displayRouteDesignator: 'I-10', displayCrossStreet: 'Dauphin Island Parkway', direction: 'Any',
  },
  playbackUrls: { hls: 'https://cdn3.wowza.com/5/b3FOYzhMRS9aVlI1/mobile-fastly/mob-cam-c079.stream/playlist.m3u8' },
  accessLevel: 'Public',
  permLink: 'https://www.algotraffic.com?cameraId=1153',
  snapshotImageUrl: 'https://api.algotraffic.com/v4/Cameras/1153/snapshot.jpg',
} as AlgoCamera;
const noCrossStreet = {
  id: 1983,
  location: {
    latitude: 30.675635999999997, longitude: -88.04414, city: 'Mobile', county: 'Mobile',
    displayRouteDesignator: 'I-10', displayCrossStreet: '', direction: 'East',
  },
  playbackUrls: { hls: 'https://cdn3.wowza.com/5/b3FOYzhMRS9aVlI1/mobile-fastly/mob-cam-c074.stream/playlist.m3u8' },
  accessLevel: 'Public',
  permLink: 'https://www.algotraffic.com?cameraId=1983',
  snapshotImageUrl: 'https://api.algotraffic.com/v4/Cameras/1983/snapshot.jpg',
} as AlgoCamera;

describe('mapAlgoCamera', () => {
  it('maps a public camera to its still, HLS stream and map link', () => {
    expect(mapAlgoCamera(mcdonald)).toEqual({
      id: 'aldot-1845',
      lat: 30.535104999999998,
      lng: -88.23953,
      name: 'I-10 at McDonald Rd (East)',
      city: 'Mobile',
      country: 'US',
      feed_url: 'https://api.algotraffic.com/v4/Cameras/1845/snapshot.jpg',
      stream_url: 'https://cdn3.wowza.com/5/b3FOYzhMRS9aVlI1/mobile-fastly/mob-cam-c095.stream/playlist.m3u8',
      stream_type: 'hls',
      external_url: 'https://www.algotraffic.com/?cameraId=1845',
      source: 'ALGO Traffic',
    });
  });

  it('names panning cameras and cameras with no cross street', () => {
    expect(mapAlgoCamera(panning)?.name).toBe('I-10 at Dauphin Island Parkway');
    expect(mapAlgoCamera(noCrossStreet)?.name).toBe('I-10 (East)');
  });

  it('drops cameras the public map hides', () => {
    expect(mapAlgoCamera(firstResponder)).toBeNull();
    expect(mapAlgoCamera({ ...mcdonald, accessLevel: 'ALDOT' })).toBeNull();
    expect(mapAlgoCamera({ ...mcdonald, accessLevel: null })).toBeNull();
  });

  it('drops rows with no id, no media or unusable coordinates', () => {
    expect(mapAlgoCamera({ ...mcdonald, id: null })).toBeNull();
    expect(mapAlgoCamera({ ...mcdonald, snapshotImageUrl: null, playbackUrls: null })).toBeNull();
    expect(mapAlgoCamera({ ...mcdonald, location: { ...mcdonald.location, latitude: 0, longitude: 0 } })).toBeNull();
    expect(mapAlgoCamera({ ...mcdonald, location: { ...mcdonald.location, latitude: null } })).toBeNull();
    expect(mapAlgoCamera({ ...mcdonald, location: { ...mcdonald.location, latitude: 36.16, longitude: -86.78 } })).toBeNull();
    expect(mapAlgoCamera({ ...mcdonald, location: null })).toBeNull();
    expect(mapAlgoCamera(null)).toBeNull();
  });

  it('keeps only https media', () => {
    const cam = mapAlgoCamera({ ...mcdonald, playbackUrls: { hls: 'http://cdn3.wowza.com/x.stream/playlist.m3u8' } });
    expect(cam).toMatchObject({ stream_type: 'jpg', feed_url: 'https://api.algotraffic.com/v4/Cameras/1845/snapshot.jpg' });
    expect(cam?.stream_url).toBeUndefined();
  });

  it('falls back to the county, then the state, for the city', () => {
    expect(mapAlgoCamera({ ...mcdonald, location: { ...mcdonald.location, city: ' ' } })?.city).toBe('Mobile County');
    expect(mapAlgoCamera({ ...mcdonald, location: { ...mcdonald.location, city: null, county: null } })?.city).toBe('Alabama');
  });
});

describe('fetchAlgoCameras', () => {
  it('keeps the public cameras once each', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json([mcdonald, firstResponder, panning, mcdonald])));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const cams = await fetchAlgoCameras();
    expect(cams.map(c => c.id)).toEqual(['aldot-1845', 'aldot-1153']);
  });

  it('throws on an HTTP error or an unexpected body', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
    await expect(fetchAlgoCameras()).rejects.toThrow('HTTP 503');
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ message: 'x' })));
    await expect(fetchAlgoCameras()).rejects.toThrow('unexpected response');
  });
});

// Live integration test — opt in with RUN_LIVE_TESTS=1.
const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('fetchAlgoCameras (live)', () => {
  liveIt('fetches the public Alabama cameras', async () => {
    const cams = await fetchAlgoCameras();
    expect(cams.length).toBeGreaterThan(450);
    const b = ALGO_BOUNDS;
    for (const c of cams) {
      expect(c.id).toMatch(/^aldot-\d+$/);
      expect(c.lat > b.minLat && c.lat < b.maxLat && c.lng > b.minLng && c.lng < b.maxLng).toBe(true);
    }
  }, 20_000);
});
