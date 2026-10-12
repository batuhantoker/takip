import { describe, it, expect } from 'vitest';
import { mapAustinCamera, fetchAustinCameras, AUSTIN_BOUNDS, type AustinCamera } from './austin';

// Verbatim from data.austintexas.gov/resource/b4k4-adkb.json (Socrata's computed_region columns dropped).
const on = {
  camera_id: '674', location_name: ' CESAR CHAVEZ ST / 35 SVRD', camera_status: 'TURNED_ON',
  turn_on_date: '2020-03-19T05:00:00.000Z', camera_mfg: 'Wisenet', atd_location_id: 'LOC16-000675',
  signal_eng_area: 'CENTRAL', council_district: '3', jurisdiction_label: 'AUSTIN FULL PURPOSE', location_type: 'ROADWAY',
  primary_st_block: '800', primary_st: ' CESAR CHAVEZ ST', cross_st_block: '100', cross_st: 'IH 35 SVRD',
  coa_intersection_id: '5158088', modified_date: '2026-09-24T21:58:00.000Z',
  screenshot_address: 'https://cctv.austinmobility.io/image/674.jpg', funding: 'None Identified',
  id: '5d40501e9442f20010304da5', location: { type: 'Point', coordinates: [-97.735786, 30.260996] },
} as AustinCamera;

// A planned camera: its still answers 403.
const desired = {
  camera_id: '670', location_name: ' BRODIE LN / ERNEST ROBLES WAY', camera_status: 'DESIRED',
  atd_location_id: 'LOC16-002075', signal_eng_area: 'SOUTH', council_district: '', jurisdiction_label: 'AUSTIN FULL PURPOSE',
  location_type: 'ROADWAY', primary_st_block: '5300', primary_st: ' BRODIE LN', cross_st_block: '4100',
  cross_st: ' ERNEST ROBLES WAY', coa_intersection_id: '5148691', modified_date: '2023-11-30T21:40:00.000Z',
  screenshot_address: 'https://cctv.austinmobility.io/image/670.jpg', funding: 'None Identified',
  id: '5d404639d6d40500152e5c43', location: { type: 'Point', coordinates: [-97.820351, 30.229502] },
} as AustinCamera;

describe('mapAustinCamera', () => {
  it('maps a working camera to its still', () => {
    expect(mapAustinCamera(on)).toEqual({
      id: 'austin-674',
      lat: 30.260996,
      lng: -97.735786,
      name: 'CESAR CHAVEZ ST / 35 SVRD',
      city: 'Austin',
      country: 'US',
      feed_url: 'https://cctv.austinmobility.io/image/674.jpg',
      stream_type: 'jpg',
      source: 'City of Austin',
    });
  });

  it('drops cameras that are not turned on', () => {
    expect(mapAustinCamera(desired)).toBeNull();
    expect(mapAustinCamera({ ...on, camera_status: 'REMOVED' })).toBeNull();
  });

  it('drops coordinates outside Austin', () => {
    expect(mapAustinCamera({ ...on, location: { coordinates: [0, 0] } })).toBeNull();
    expect(mapAustinCamera({ ...on, location: null })).toBeNull();
  });

  it('drops rows without an id or an https still', () => {
    expect(mapAustinCamera({ ...on, camera_id: null })).toBeNull();
    expect(mapAustinCamera({ ...on, screenshot_address: 'http://cctv.austinmobility.io/image/674.jpg' })).toBeNull();
    expect(mapAustinCamera({ ...on, screenshot_address: null })).toBeNull();
    expect(mapAustinCamera(null)).toBeNull();
  });

  it('falls back to a default name', () => {
    expect(mapAustinCamera({ ...on, location_name: ' ' })?.name).toBe('Austin Camera 674');
  });
});

// Live integration test — opt in with RUN_LIVE_TESTS=1.
const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('fetchAustinCameras (live)', () => {
  liveIt('fetches the working cameras', async () => {
    const cams = await fetchAustinCameras();
    expect(cams.length).toBeGreaterThan(500);
    expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
    const b = AUSTIN_BOUNDS;
    for (const c of cams) {
      expect(c.id).toMatch(/^austin-\d+$/);
      expect(c.lat > b.minLat && c.lat < b.maxLat && c.lng > b.minLng && c.lng < b.maxLng).toBe(true);
      expect(c.feed_url).toMatch(/^https:\/\/cctv\.austinmobility\.io\/image\/\d+\.jpg$/);
    }
  }, 20_000);
});
