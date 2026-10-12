import { describe, it, expect } from 'vitest';
import { mapAlertCaCamera, fetchAlertCaCameras, type AlertCaFeature } from './alertcalifornia';

// The moment the fixtures below were fetched.
const NOW = 1791813720;

// Verbatim from all_cameras-v3.json, trimmed to the fields read.
const tam: AlertCaFeature = {
  geometry: { coordinates: [-122.58, 37.93, 741] },
  properties: { id: 'Axis-TamEast', name: 'Mt. Tamalpais East', last_frame_ts: 1791813709 },
};

const withProps = (p: Partial<NonNullable<AlertCaFeature['properties']>>): AlertCaFeature =>
  ({ ...tam, properties: { ...tam.properties, ...p } });

describe('mapAlertCaCamera', () => {
  it('maps a camera to its latest frame, credited as required', () => {
    expect(mapAlertCaCamera(tam, NOW)).toEqual({
      id: 'alertca-Axis-TamEast',
      lat: 37.93,
      lng: -122.58,
      name: 'Mt. Tamalpais East',
      city: 'California',
      country: 'US',
      feed_url: 'https://cameras.alertcalifornia.org/public-camera-data/Axis-TamEast/latest-frame.jpg',
      stream_type: 'jpg',
      source: 'ALERTCalifornia | UC San Diego',
    });
  });

  it('drops the rows published without a location', () => {
    // Verbatim: a live camera with null coordinates and no name.
    expect(mapAlertCaCamera({
      geometry: { coordinates: [null, null, null] },
      properties: { id: 'AXIS-BCPOSLongmont', name: '', last_frame_ts: 1791813717 },
    }, NOW)).toBeNull();
    expect(mapAlertCaCamera({ ...tam, geometry: null }, NOW)).toBeNull();
  });

  it('drops cameras outside California', () => {
    // Verbatim: the network's two Wyoming cameras.
    expect(mapAlertCaCamera({
      geometry: { coordinates: [-109.75, 42.97, 2845] },
      properties: { id: 'Axis-WhitePine1', name: 'White Pine Resort 1', last_frame_ts: 1791705903 },
    }, NOW)).toBeNull();
  });

  it('drops cameras whose last frame is stale or missing', () => {
    // Verbatim: Foor 1 last reported 41 days earlier; Corral Canyon never has.
    expect(mapAlertCaCamera(withProps({ id: 'Axis-Foor1', last_frame_ts: 1788202691 }), NOW)).toBeNull();
    expect(mapAlertCaCamera(withProps({ id: 'Axis-CorralCanyon1', last_frame_ts: 0 }), NOW)).toBeNull();
    expect(mapAlertCaCamera(withProps({ last_frame_ts: null }), NOW)).toBeNull();
    expect(mapAlertCaCamera(withProps({ last_frame_ts: NOW - 23 * 3600 }), NOW)).not.toBeNull();
  });

  it('drops rows without a usable id', () => {
    expect(mapAlertCaCamera(withProps({ id: null }), NOW)).toBeNull();
    expect(mapAlertCaCamera(withProps({ id: '../Axis-TamEast' }), NOW)).toBeNull();
  });

  it('falls back to the id when the name is blank', () => {
    expect(mapAlertCaCamera(withProps({ name: ' ' }), NOW)?.name).toBe('ALERTCalifornia Axis-TamEast');
  });
});

const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

liveIt('fetches a large set of well-formed ALERTCalifornia cameras', async () => {
  const cams = await fetchAlertCaCameras();
  expect(cams.length).toBeGreaterThan(1000);
  expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
  for (const c of cams) {
    expect(c.id).toMatch(/^alertca-[\w-]+$/);
    expect(c.feed_url).toMatch(/^https:\/\/cameras\.alertcalifornia\.org\/public-camera-data\/[\w-]+\/latest-frame\.jpg$/);
    expect(c.lat).toBeGreaterThan(32.5);
    expect(c.lat).toBeLessThan(42.1);
  }
});
