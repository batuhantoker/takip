import { afterEach, describe, it, expect, vi } from 'vitest';
import { alertWestPlaces, mapAlertCaCamera, fetchAlertCaCameras, type AlertCaFeature } from './alertcalifornia';

afterEach(() => vi.unstubAllGlobals());

// The moment the fixtures below were fetched.
const NOW = 1791813720;

// Verbatim from all_cameras-v3.json, trimmed to the fields read.
const tam: AlertCaFeature = {
  geometry: { coordinates: [-122.58, 37.93, 741] },
  properties: { id: 'Axis-TamEast', name: 'Mt. Tamalpais East', last_frame_ts: 1791813709 },
};

// Verbatim: a live camera the index publishes with null coordinates and no name.
const longmont: AlertCaFeature = {
  geometry: { coordinates: [null, null, null] },
  properties: { id: 'AXIS-BCPOSLongmont', name: '', last_frame_ts: 1791813717 },
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
    expect(mapAlertCaCamera(longmont, NOW)).toBeNull();
    expect(mapAlertCaCamera({ ...tam, geometry: null }, NOW)).toBeNull();
  });

  it('places and names an unlocated row from ALERTWest', () => {
    expect(mapAlertCaCamera(longmont, NOW, { lat: 40.169895, lng: -105.1668, name: 'BCPOS_Longmont', state: 'CO' })).toEqual({
      id: 'alertca-AXIS-BCPOSLongmont',
      lat: 40.169895,
      lng: -105.1668,
      name: 'BCPOS Longmont',
      city: 'Colorado',
      country: 'US',
      feed_url: 'https://cameras.alertcalifornia.org/public-camera-data/AXIS-BCPOSLongmont/latest-frame.jpg',
      stream_type: 'jpg',
      source: 'ALERTCalifornia | UC San Diego',
    });
    expect(mapAlertCaCamera(longmont, NOW, { lat: 54.77635, lng: -115.280214, name: 'Swan_Dive_1', state: 'AB' })?.country).toBe('Canada');
  });

  it('keeps the index location over ALERTWest when it has one', () => {
    const cam = mapAlertCaCamera(tam, NOW, { lat: 37.9, lng: -122.6, name: 'Tam_East', state: 'CA' });
    expect([cam?.lat, cam?.lng, cam?.name]).toEqual([37.93, -122.58, 'Mt. Tamalpais East']);
  });

  it('keeps cameras outside California only when ALERTWest knows them', () => {
    // Verbatim apart from the timestamp: one of the network's two Wyoming cameras.
    const whitePine: AlertCaFeature = {
      geometry: { coordinates: [-109.75, 42.97, 2845] },
      properties: { id: 'Axis-WhitePine1', name: 'White Pine Resort 1', last_frame_ts: NOW - 60 },
    };
    expect(mapAlertCaCamera(whitePine, NOW)).toBeNull();
    expect(mapAlertCaCamera(whitePine, NOW, { lat: 42.97, lng: -109.75, state: 'WY' })?.city).toBe('Wyoming');
    // Nowhere near the network.
    expect(mapAlertCaCamera(longmont, NOW, { lat: 40.7, lng: -74.0, state: 'NY' })).toBeNull();
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

// Trimmed from api.cdn.prod.alertwest.com/api/getCameraDataByLoc (2026-10-13).
const westMap = {
  code: 1,
  data: {
    locs: { data: [{ id: 28061, lat: '40.169895', lon: '-105.166800', st: 'CO', lp: 0 }, { id: 7, lat: '19.4', lon: '-155.9', st: 'HI' }] },
    cams: {
      data: [
        { id: '9', hn: 'AXIS-BCPOSLongmont', cn: 'BCPOS_Longmont', lid: 28061, st: 'CO', pv: 0, off: 0, pr: 'ALERTWest' },
        { id: '10', hn: 'Axis-Hidden', cn: 'Hidden', lid: 7, st: 'HI', pv: 1 },
        { id: '11', hn: 'Axis-Nowhere', cn: 'Nowhere', lid: 99, st: 'HI', pv: 0 },
      ],
    },
  },
};

describe('alertWestPlaces', () => {
  it('joins each camera to its location, skipping private and unplaced ones', () => {
    const places = alertWestPlaces(westMap);
    expect([...places.keys()]).toEqual(['AXIS-BCPOSLongmont']);
    expect(places.get('AXIS-BCPOSLongmont')).toEqual({ lat: 40.169895, lng: -105.1668, name: 'BCPOS_Longmont', state: 'CO' });
    expect(alertWestPlaces(null).size).toBe(0);
  });
});

describe('fetchAlertCaCameras', () => {
  const stub = (west: () => Response) => vi.stubGlobal('fetch', vi.fn(async (url: string | URL) =>
    String(url).includes('alertwest.com') ? west() : Response.json({ features: [tam, longmont] })));

  it('adds the rows ALERTWest places', async () => {
    vi.useFakeTimers({ now: NOW * 1000, toFake: ['Date'] });
    try {
      stub(() => Response.json(westMap));
      expect((await fetchAlertCaCameras()).map(c => c.id)).toEqual(['alertca-Axis-TamEast', 'alertca-AXIS-BCPOSLongmont']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('still loads California when ALERTWest is down', async () => {
    vi.useFakeTimers({ now: NOW * 1000, toFake: ['Date'] });
    try {
      stub(() => new Response('', { status: 503 }));
      expect((await fetchAlertCaCameras()).map(c => c.id)).toEqual(['alertca-Axis-TamEast']);
    } finally {
      vi.useRealTimers();
    }
  });
});

const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

liveIt('fetches a large set of well-formed western wildfire cameras', async () => {
  const cams = await fetchAlertCaCameras();
  expect(cams.length).toBeGreaterThan(1400);
  expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
  expect(cams.filter(c => c.city === 'Hawaii').length).toBeGreaterThan(100);
  for (const c of cams) {
    expect(c.id).toMatch(/^alertca-[\w-]+$/);
    expect(c.feed_url).toMatch(/^https:\/\/cameras\.alertcalifornia\.org\/public-camera-data\/[\w-]+\/latest-frame\.jpg$/);
    expect(c.lat).toBeGreaterThan(18.5);
    expect(c.lat).toBeLessThan(56);
  }
});
