import { describe, it, expect } from 'vitest';
import { mapVdotCamera, fetchVdotCameras, VDOT_BOUNDS, type VdotFeature } from './vdot';

// Verbatim from 511.vdot.virginia.gov/services/511/map/layers/map/cams.
const feature = {
  properties: {
    deviceid: 0, problem_stream: false, description: 'University Drive and Sager Avenue',
    clsps_url: 'clsps://media-sfs7.vdotcameras.com/0i6a7bfbs60yq2lbgivq0b8xk3scij3c', active: true, distance: null,
    guid: '9abf486c0af547aab109c34c', route: '', direction: '',
    image_url: 'https://snapshot.vdotcameras.com/thumbs/0i6a7bfbs60yq2lbgivq0b8xk3scij3c.flv.png',
    id: '3958', name: '0i6a7bfbs60yq2lbgivq0b8xk3scij3c', mrm: 0,
    rtmp_url: 'rtmp://media-sfs7.vdotcameras.com:1935/rtplive/0i6a7bfbs60yq2lbgivq0b8xk3scij3c',
    preroll_url: 'https://media-sfs7.vdotcameras.com/preroll/0i6a7bfbs60yq2lbgivq0b8xk3scij3c/playlist.m3u8',
    ios_url: 'https://media-sfs7.vdotcameras.com/rtplive/0i6a7bfbs60yq2lbgivq0b8xk3scij3c/playlist_sfm4s.m3u8',
    jurisdiction: 'City of Fairfax',
    rtsp_url: 'rtsp://media-sfs7.vdotcameras.com:554/rtplive/0i6a7bfbs60yq2lbgivq0b8xk3scij3c',
    https_url: 'https://media-sfs7.vdotcameras.com/rtplive/0i6a7bfbs60yq2lbgivq0b8xk3scij3c/playlist.m3u8',
  },
  geometry: { coordinates: [-77.3055, 38.84519] },
} as VdotFeature;

// Verbatim too: upstream drops the sign on this one's longitude.
const flipped: VdotFeature = {
  properties: {
    id: '3656', description: 'I66 @ VA-243 S', jurisdiction: 'Fairfax', active: true, problem_stream: false,
    image_url: 'https://snapshot.vdotcameras.com/thumbs/NOVACCTVI66F00007VA243S.flv.png',
    https_url: 'https://media-sfs8.vdotcameras.com/rtplive/NOVACCTVI66F00007VA243S/playlist.m3u8',
  },
  geometry: { coordinates: [77.266727, 38.880113] },
};

const withProps = (patch: Record<string, unknown>): VdotFeature =>
  ({ ...feature, properties: { ...feature.properties, ...patch } });

describe('mapVdotCamera', () => {
  it('maps a camera to its HLS stream and still', () => {
    expect(mapVdotCamera(feature)).toEqual({
      id: 'vdot-3958',
      lat: 38.84519,
      lng: -77.3055,
      name: 'University Drive and Sager Avenue',
      city: 'City of Fairfax',
      country: 'US',
      feed_url: 'https://snapshot.vdotcameras.com/thumbs/0i6a7bfbs60yq2lbgivq0b8xk3scij3c.flv.png',
      stream_url: 'https://media-sfs7.vdotcameras.com/rtplive/0i6a7bfbs60yq2lbgivq0b8xk3scij3c/playlist.m3u8',
      stream_type: 'hls',
      source: 'VDOT',
    });
  });

  it('drops inactive cameras and problem streams', () => {
    expect(mapVdotCamera(withProps({ active: false }))).toBeNull();
    expect(mapVdotCamera(withProps({ problem_stream: true }))).toBeNull();
  });

  it('drops coordinates outside Virginia', () => {
    expect(mapVdotCamera(flipped)).toBeNull();
    expect(mapVdotCamera({ ...feature, geometry: { coordinates: [0, 0] } })).toBeNull();
    expect(mapVdotCamera({ ...feature, geometry: null })).toBeNull();
  });

  it('drops rows without a usable id or any https media', () => {
    expect(mapVdotCamera(withProps({ id: null }))).toBeNull();
    expect(mapVdotCamera(withProps({ id: '../3958' }))).toBeNull();
    expect(mapVdotCamera(withProps({ https_url: 'http://x/playlist.m3u8', image_url: null }))).toBeNull();
    expect(mapVdotCamera(null)).toBeNull();
  });

  it('keeps a camera keyed by its guid', () => {
    expect(mapVdotCamera(withProps({ id: 'f96b1708380844238d3db6e4' }))?.id).toBe('vdot-f96b1708380844238d3db6e4');
  });

  it('falls back to a still when there is no https stream', () => {
    const cam = mapVdotCamera(withProps({ https_url: null }));
    expect(cam?.stream_url).toBeUndefined();
    expect(cam?.stream_type).toBe('jpg');
    expect(cam?.feed_url).toMatch(/^https:\/\/snapshot\.vdotcameras\.com\//);
  });
});

// Live integration test — opt in with RUN_LIVE_TESTS=1.
const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('fetchVdotCameras (live)', () => {
  liveIt('fetches the statewide set', async () => {
    const cams = await fetchVdotCameras();
    expect(cams.length).toBeGreaterThan(1000);
    expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
    const b = VDOT_BOUNDS;
    for (const c of cams) {
      expect(c.id).toMatch(/^vdot-[\w-]+$/);
      expect(c.lat > b.minLat && c.lat < b.maxLat && c.lng > b.minLng && c.lng < b.maxLng).toBe(true);
      expect(c.stream_url ?? c.feed_url).toMatch(/^https:\/\//);
    }
    console.log(`VDOT live: ${cams.length}, hls ${cams.filter(c => c.stream_type === 'hls').length}`);
  }, 20_000);
});
