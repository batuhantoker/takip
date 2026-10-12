import { afterEach, describe, it, expect, vi } from 'vitest';
import { mapArdotCamera, fetchArdotCameras, ARDOT_BOUNDS, type ArdotFeature } from './ardot';

afterEach(() => vi.unstubAllGlobals());

// Verbatim from layers.idrivearkansas.com/cameras.geojson.
const redRiver = {
  type: 'Feature',
  properties: {
    id: 457, status: 'online', name: 'I-30 @ Red River', description: '@ Red River', layer_id: 'cameras',
    route_type: 'Interstate', route_type_abbr: 'Interstate', route: '30', default_direction: 'E', direction_name: 'East',
    camera: 'AXIS P5655-E PTZ', ahtd_camera_number: '3012', inventory_location_code: '46011', event_color: '',
    sister_north: null, sister_south: null, sister_east: null, sister_west: null,
    hls_stream_protected: 'https://cdn.idrivearkansas.com/live/idrive_457_base.stream/playlist.m3u8',
    elevation: '263.78', primary: true, camera_type_name: 'Traffic',
  },
  geometry: { type: 'Point', coordinates: [-93.815969, 33.605106] },
} as ArdotFeature;
const stateLine = {
  type: 'Feature',
  properties: {
    id: 861, status: 'online', name: 'US 425 at Louisiana State Line ', description: 'Louisiana State Line ', layer_id: 'cameras',
    route_type: 'U.S. Highway', route_type_abbr: 'US', route: '425', default_direction: 'N', direction_name: 'North',
    camera: '', ahtd_camera_number: '2024', inventory_location_code: '02002', event_color: '',
    sister_north: null, sister_south: null, sister_east: null, sister_west: null,
    hls_stream_protected: 'https://cdn.idrivearkansas.com/live/idrive_861_base.stream/playlist.m3u8',
    elevation: '155.12', primary: true, camera_type_name: 'Traffic',
  },
  geometry: { type: 'Point', coordinates: [-91.855722, 33.008472] },
} as ArdotFeature;
// A TDOT camera ARDOT relays; its still has not changed for weeks.
const tdot = {
  type: 'Feature',
  properties: {
    id: 50, status: 'online', name: 'I-40 W. of State Hwy. 191 (Exit 278)', description: 'West of State Highway 191 (Exit 278)',
    layer_id: 'cameras', route_type: 'Interstate', route_type_abbr: 'Interstate', route: '40', default_direction: 'E',
    direction_name: 'East', camera: 'Tennessee: 344', ahtd_camera_number: 'TN344', inventory_location_code: '', event_color: '',
    sister_north: null, sister_south: null, sister_east: null, sister_west: null,
    hls_stream_protected: 'https://actis.idrivearkansas.com/index.php/api/cameras/feed/50.m3u8',
    elevation: '222.04', primary: true, camera_type_name: 'Traffic',
  },
  geometry: { type: 'Point', coordinates: [-90.182105, 35.167258] },
} as ArdotFeature;
// An MDOT camera ARDOT relays; its still is MDOT's "temporarily unavailable" card.
const mdot = {
  type: 'Feature',
  properties: {
    id: 101, status: 'online', name: 'U.S. 49 E. of Helena Bridge', description: 'East of the Helena Bridge', layer_id: 'cameras',
    route_type: 'U.S. Highway', route_type_abbr: 'US', route: '49', default_direction: 'W', direction_name: 'West',
    camera: 'Mississippi: 150103', ahtd_camera_number: 'MS150103', inventory_location_code: '', event_color: '',
    sister_north: null, sister_south: null, sister_east: 99, sister_west: null,
    hls_stream_protected: 'https://cdn.idrivearkansas.com/live/idrive_101_base.stream/playlist.m3u8',
    elevation: '210.50', primary: false, camera_type_name: 'Traffic',
  },
  geometry: { type: 'Point', coordinates: [-90.580014, 34.494902] },
} as ArdotFeature;

const withProps = (f: ArdotFeature, props: NonNullable<ArdotFeature['properties']>): ArdotFeature =>
  ({ ...f, properties: { ...f.properties, ...props } });

describe('mapArdotCamera', () => {
  it('maps a camera to its public still', () => {
    expect(mapArdotCamera(redRiver)).toEqual({
      id: 'ardot-457',
      lat: 33.605106,
      lng: -93.815969,
      name: 'I-30 @ Red River - East',
      city: 'Arkansas',
      country: 'US',
      feed_url: 'https://layers.idrivearkansas.com/cameras/457.jpg',
      stream_type: 'jpg',
      source: 'ARDOT',
    });
  });

  it('keeps a camera on the state line and tidies its name', () => {
    expect(mapArdotCamera(stateLine)?.id).toBe('ardot-861');
    expect(mapArdotCamera(stateLine)?.name).toBe('US 425 at Louisiana State Line - North');
    expect(mapArdotCamera(withProps(redRiver, { name: ' I-49  mm70 @ Don Tyson' }))?.name).toBe('I-49 mm70 @ Don Tyson - East');
  });

  it("drops neighbouring agencies' cameras that ARDOT relays", () => {
    expect(mapArdotCamera(tdot)).toBeNull();
    expect(mapArdotCamera(mdot)).toBeNull();
    expect(mapArdotCamera(withProps(redRiver, { ahtd_camera_number: 'OK1201' }))).toBeNull();
    expect(mapArdotCamera(withProps(redRiver, { camera: 'Missouri: 12' }))).toBeNull();
  });

  it("keeps ARDOT's own lettered camera numbers", () => {
    expect(mapArdotCamera(withProps(redRiver, { ahtd_camera_number: 'MH001' }))?.id).toBe('ardot-457');
    expect(mapArdotCamera(withProps(redRiver, { ahtd_camera_number: 'CA0604-35S' }))?.id).toBe('ardot-457');
    expect(mapArdotCamera(withProps(redRiver, { ahtd_camera_number: 6050 }))?.id).toBe('ardot-457');
  });

  it('drops a camera that is not online or has no usable id', () => {
    expect(mapArdotCamera(withProps(redRiver, { status: 'offline' }))).toBeNull();
    expect(mapArdotCamera(withProps(redRiver, { status: null }))).toBeNull();
    expect(mapArdotCamera(withProps(redRiver, { id: null }))).toBeNull();
    expect(mapArdotCamera(withProps(redRiver, { id: 4.5 }))).toBeNull();
    expect(mapArdotCamera({ ...redRiver, properties: null })).toBeNull();
    expect(mapArdotCamera(null)).toBeNull();
  });

  it('drops coordinates outside Arkansas', () => {
    expect(mapArdotCamera({ ...redRiver, geometry: { coordinates: [0, 0] } })).toBeNull();
    expect(mapArdotCamera({ ...redRiver, geometry: { coordinates: [-97.5, 35.47] } })).toBeNull();
    expect(mapArdotCamera({ ...redRiver, geometry: { coordinates: [-93.815969, null] } })).toBeNull();
    expect(mapArdotCamera({ ...redRiver, geometry: null })).toBeNull();
  });

  it('falls back when the name or direction is missing', () => {
    expect(mapArdotCamera(withProps(redRiver, { name: ' ' }))?.name).toBe('ARDOT Camera 457');
    expect(mapArdotCamera(withProps(redRiver, { direction_name: null }))?.name).toBe('I-30 @ Red River');
  });
});

describe('fetchArdotCameras', () => {
  it('throws on an HTTP error, a bad shape or a short read', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
    await expect(fetchArdotCameras()).rejects.toThrow('HTTP 503');
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ type: 'FeatureCollection' })));
    await expect(fetchArdotCameras()).rejects.toThrow('no features');
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ type: 'FeatureCollection', features: [redRiver, stateLine, tdot, mdot] })));
    await expect(fetchArdotCameras()).rejects.toThrow('short read: 2');
  });
});

const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

liveIt('fetches a large set of well-formed ARDOT cameras', async () => {
  const cams = await fetchArdotCameras();
  expect(cams.length).toBeGreaterThan(410);
  expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
  const ids = new Set(cams.map(c => c.id));
  expect(ids.has('ardot-747')).toBe(true);
  expect(ids.has('ardot-861')).toBe(true);
  const b = ARDOT_BOUNDS;
  for (const c of cams) {
    expect(c.id).toMatch(/^ardot-\d+$/);
    expect(c.source).toBe('ARDOT');
    expect(c.feed_url).toBe(`https://layers.idrivearkansas.com/cameras/${c.id.slice('ardot-'.length)}.jpg`);
    expect(c.lat > b.minLat && c.lat < b.maxLat && c.lng > b.minLng && c.lng < b.maxLng).toBe(true);
  }
}, 20_000);
