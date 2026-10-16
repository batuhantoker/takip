import { describe, it, expect } from 'vitest';
import { mapDeldotCamera, fetchDeldotCameras, DELDOT_BOUNDS, type DeldotCamera } from './deldot';

// Verbatim from tmc.deldot.gov/json/videocamera.json.
const camera = {
  urls: {
    rtmp: 'rtmpt://video.deldot.gov:80/live/KCAM001.stream',
    f4m: 'http://video.deldot.gov:1935/live/KCAM001.stream/manifest.f4m',
    m3u8: 'http://video.deldot.gov:1935/live/KCAM001.stream/playlist.m3u8',
    m3u8s: 'https://video.deldot.gov:443/live/KCAM001.stream/playlist.m3u8',
    mssmooth: 'http://video.deldot.gov:1935/live/KCAM001.stream/Manifest',
  },
  id: 'KCAM001', title: 'DE 1 @ MILFORD NECK ROAD (NORTH OFF)', county: 'Kent',
  lat: 38.990931, lon: -75.448625, hash: '1760142867', enabled: true, status: 'Active',
} as DeldotCamera;

const unavailable = {
  urls: {
    rtmp: 'rtmpt://video.deldot.gov:80/live/KCAM102.stream',
    f4m: 'http://video.deldot.gov:1935/live/KCAM102.stream/manifest.f4m',
    m3u8: 'http://video.deldot.gov:1935/live/KCAM102.stream/playlist.m3u8',
    m3u8s: 'https://video.deldot.gov:443/live/KCAM102.stream/playlist.m3u8',
    mssmooth: 'http://video.deldot.gov:1935/live/KCAM102.stream/Manifest',
  },
  id: 'KCAM102', title: 'US 13 SB @ DE 14', county: 'Kent',
  lat: 38.923876, lon: -75.567883, hash: '667852728', enabled: true, status: 'Unavailable',
} as DeldotCamera;

describe('mapDeldotCamera', () => {
  it('maps a camera to its https HLS stream, with no still', () => {
    expect(mapDeldotCamera(camera)).toEqual({
      id: 'deldot-KCAM001',
      lat: 38.990931,
      lng: -75.448625,
      name: 'DE 1 @ MILFORD NECK ROAD (NORTH OFF)',
      city: 'Kent County',
      country: 'US',
      stream_url: 'https://video.deldot.gov/live/KCAM001.stream/playlist.m3u8',
      stream_type: 'hls',
      source: 'DelDOT',
    });
  });

  it('keeps unavailable or disabled cameras, as long as the stream is https', () => {
    expect(mapDeldotCamera(unavailable)?.id).toBe('deldot-KCAM102');
    expect(mapDeldotCamera({ ...camera, enabled: false })?.id).toBe('deldot-KCAM001');
  });

  it('drops coordinates outside Delaware', () => {
    expect(mapDeldotCamera({ ...camera, lat: 0, lon: 0 })).toBeNull();
    expect(mapDeldotCamera({ ...camera, lat: null })).toBeNull();
  });

  it('drops rows without an id or an https stream', () => {
    expect(mapDeldotCamera({ ...camera, id: null })).toBeNull();
    expect(mapDeldotCamera({ ...camera, urls: { m3u8s: 'http://video.deldot.gov:1935/live/KCAM001.stream/playlist.m3u8' } })).toBeNull();
    expect(mapDeldotCamera({ ...camera, urls: null })).toBeNull();
    expect(mapDeldotCamera(null)).toBeNull();
  });

  it('falls back when the title or county is missing', () => {
    const cam = mapDeldotCamera({ ...camera, title: ' ', county: null });
    expect(cam?.name).toBe('DelDOT Camera KCAM001');
    expect(cam?.city).toBe('Delaware');
  });
});

// Live integration test — opt in with RUN_LIVE_TESTS=1.
const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('fetchDeldotCameras (live)', () => {
  liveIt('fetches the active cameras', async () => {
    const cams = await fetchDeldotCameras();
    expect(cams.length).toBeGreaterThan(250);
    expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
    const b = DELDOT_BOUNDS;
    for (const c of cams) {
      expect(c.id).toMatch(/^deldot-[A-Z]+\d+$/);
      expect(c.lat > b.minLat && c.lat < b.maxLat && c.lng > b.minLng && c.lng < b.maxLng).toBe(true);
      expect(c.stream_type).toBe('hls');
      expect(c.stream_url).toMatch(/^https:\/\/video\.deldot\.gov\/live\/.+\/playlist\.m3u8$/);
      expect(c.feed_url).toBeUndefined();
    }
  }, 20_000);
});
