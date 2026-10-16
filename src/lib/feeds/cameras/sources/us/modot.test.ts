import { describe, it, expect } from 'vitest';
import { fetchModotCameras, mapModotCamera, modotStream, MODOT_BOUNDS, type ModotCamera } from './modot';

// Verbatim from traveler.modot.org/timconfig/feed/desktop/StreamingCams2.json.
const camera: ModotCamera = {
  location: '141 AT 21, MM 27.1', x: -90.424496, y: 38.4623, rtmp: null,
  html: 'https://sfs02-traveler.modot.mo.gov/rtplive/MODOT_CAM_209/playlist.m3u8',
} as ModotCamera;

const ozarks = {
  location: '7TH AND MO 249', x: -94.423841, y: 37.083421, rtmp: null,
  html: 'https://s2.ozarkstrafficoneview.com/rtplive/CAM1045/playlist.m3u8',
} as ModotCamera;

const kcScout = {
  location: 'I-29 NB At 64th St', x: -94.634608, y: 39.206444, rtmp: null,
  html: 'https://traveler.modot.org/tisvc/api/Tms/CameraStream/M029NBC-07-LQ',
} as ModotCamera;

describe('mapModotCamera', () => {
  it('maps a MoDOT camera to its HLS playlist, keyed by stream name', () => {
    expect(mapModotCamera(camera)).toEqual({
      id: 'modot-MODOT_CAM_209',
      lat: 38.4623,
      lng: -90.424496,
      name: '141 AT 21, MM 27.1',
      city: 'Missouri',
      country: 'US',
      stream_url: 'https://sfs02-traveler.modot.mo.gov/rtplive/MODOT_CAM_209/playlist.m3u8',
      stream_type: 'hls',
      source: 'MoDOT',
    });
  });

  it('labels the Springfield cameras as Ozarks Traffic', () => {
    expect(mapModotCamera(ozarks)).toMatchObject({ id: 'modot-CAM1045', source: 'Ozarks Traffic', city: 'Springfield area' });
    // The feed spells this host in capitals on a few rows.
    expect(mapModotCamera({ ...ozarks, html: 'https://S2.ozarkstrafficoneview.com/rtplive/CAM137/playlist.m3u8' })?.stream_url)
      .toBe('https://s2.ozarkstrafficoneview.com/rtplive/CAM137/playlist.m3u8');
  });

  it('drops KC Scout rows, whose streams are tokenized', () => {
    expect(mapModotCamera(kcScout)).toBeNull();
  });

  it('drops coordinates outside Missouri', () => {
    expect(mapModotCamera({ ...camera, x: 0, y: 0 })).toBeNull();
    expect(mapModotCamera({ ...camera, y: null })).toBeNull();
  });

  it('falls back when the location is blank', () => {
    expect(mapModotCamera({ ...camera, location: ' ' })?.name).toBe('MoDOT Camera MODOT_CAM_209');
    expect(mapModotCamera(null)).toBeNull();
  });
});

describe('modotStream', () => {
  it('normalises an explicit :443', () => {
    expect(modotStream('https://sfs07-traveler.modot.mo.gov:443/rtplive/MODOT_CAM_399/playlist.m3u8'))
      .toEqual({ url: 'https://sfs07-traveler.modot.mo.gov/rtplive/MODOT_CAM_399/playlist.m3u8', name: 'MODOT_CAM_399', ozarks: false });
  });

  it('rejects other hosts, plain http and odd paths', () => {
    expect(modotStream('http://sfs02-traveler.modot.mo.gov/rtplive/MODOT_CAM_209/playlist.m3u8')).toBeNull();
    expect(modotStream('https://evil.example.com/rtplive/MODOT_CAM_209/playlist.m3u8')).toBeNull();
    expect(modotStream('https://sfs02-traveler.modot.mo.gov/rtplive/../playlist.m3u8')).toBeNull();
    expect(modotStream(null)).toBeNull();
  });
});

const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('fetchModotCameras (live)', () => {
  liveIt('fetches the streaming cameras', async () => {
    const cams = await fetchModotCameras();
    expect(cams.length).toBeGreaterThan(440);
    expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
    const b = MODOT_BOUNDS;
    for (const c of cams) {
      expect(c.id).toMatch(/^modot-[\w-]+$/);
      expect(c.lat > b.minLat && c.lat < b.maxLat && c.lng > b.minLng && c.lng < b.maxLng).toBe(true);
      expect(c.stream_url).toMatch(/^https:\/\/(sfs\d+-traveler\.modot\.mo\.gov|s2\.ozarkstrafficoneview\.com)\/rtplive\/[\w-]+\/playlist\.m3u8$/);
      expect(c.feed_url).toBeUndefined();
    }
  }, 20_000);
});
