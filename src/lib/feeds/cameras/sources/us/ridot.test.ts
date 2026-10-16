import { afterEach, describe, it, expect, vi } from 'vitest';
import { mapRidotCamera, ridotCameraName, fetchRidotCameras, RIDOT_BOUNDS, type RidotCamera } from './ridot';

afterEach(() => vi.unstubAllGlobals());

// Verbatim from risegis.ri.gov/hosting/rest/services/RIDOT/Rhodeways/MapServer/6/query (feature attributes).
const camera = {
  OBJECTID: 19436, EquipmentID: 24, Description: '95_42.4_N_CAM - Broadway (Pawt)', Latitude: 41.88116, Longitude: -71.37709,
  TypeID: 1, Category: 'Field Equipment - Closed Circuit Video Equipment', Enabled: 1, Direction: 'NB', AimetisID: '57',
  CCVEWebURL: 'https://www.dot.ri.gov/img/travel/camimages/95_42.4_N_CAM - Broadway (Pawt).jpg',
  CCVE_GUID: 'F46BC27C-4A63-4FFD-816E-EF53180E87DE', Device: 'CCVE', EndofLifeDate: '2030-01-24', Cost: 40000,
} as RidotCamera;

const httpWithTab = {
  OBJECTID: 19437, EquipmentID: 31, Description: '1-10 Rt 1 N @ Rt 78 Westerly', Latitude: 41.357122, Longitude: -71.807857,
  TypeID: 1, Category: 'Field Equipment - Closed Circuit Video Equipment', Enabled: 1, Direction: 'NB', AimetisID: '43',
  CCVEWebURL: 'http://www.dot.ri.gov/img/travel/camimages/1-10 Rt 1 N @ Rt 78 Westerly.jpg\t',
  CCVE_GUID: '8BFAFD73-C53B-45CE-BEA2-909670DC8D26', Device: 'CCVE', EndofLifeDate: '2026-03-24', Cost: 40000,
} as RidotCamera;

const tmcSecurity = {
  OBJECTID: 19503, EquipmentID: 191, Description: 'RIDOT TMC Entrance Security Camera', Latitude: 41.83222, Longitude: -71.41462,
  TypeID: 1, Category: 'Field Equipment - Closed Circuit Video Equipment', Enabled: 1, Direction: 'EB', AimetisID: null,
  CCVEWebURL: null, CCVE_GUID: null, Device: 'CCVE', EndofLifeDate: '2028-07-12', Cost: 3500,
} as RidotCamera;

describe('mapRidotCamera', () => {
  it('maps a camera to its percent-encoded still', () => {
    expect(mapRidotCamera(camera)).toEqual({
      id: 'ridot-24',
      lat: 41.88116,
      lng: -71.37709,
      name: 'I-95 N MM 42.4 – Broadway (Pawt)',
      city: 'Rhode Island',
      country: 'US',
      feed_url: 'https://www.dot.ri.gov/img/travel/camimages/95_42.4_N_CAM%20-%20Broadway%20(Pawt).jpg',
      stream_type: 'jpg',
      source: 'RIDOT',
    });
  });

  it('upgrades an http still to https and drops the trailing tab', () => {
    const cam = mapRidotCamera(httpWithTab);
    expect(cam?.feed_url).toBe('https://www.dot.ri.gov/img/travel/camimages/1-10%20Rt%201%20N%20@%20Rt%2078%20Westerly.jpg');
    expect(cam?.name).toBe('Rt 1 N @ Rt 78 Westerly');
  });

  it('drops disabled cameras and the TMC building cameras', () => {
    expect(mapRidotCamera({ ...camera, Enabled: 0 })).toBeNull();
    expect(mapRidotCamera({ ...camera, Enabled: null })).toBeNull();
    expect(mapRidotCamera(tmcSecurity)).toBeNull();
    expect(mapRidotCamera({ ...camera, Description: 'TMC-CCVE' })).toBeNull();
  });

  it('drops coordinates outside Rhode Island', () => {
    expect(mapRidotCamera({ ...camera, Latitude: 0, Longitude: 0 })).toBeNull();
    expect(mapRidotCamera({ ...camera, Latitude: 42.36, Longitude: -71.06 })).toBeNull();
    expect(mapRidotCamera({ ...camera, Latitude: null })).toBeNull();
  });

  it('drops a camera with no id or no https still', () => {
    expect(mapRidotCamera({ ...camera, EquipmentID: null })).toBeNull();
    expect(mapRidotCamera({ ...camera, CCVEWebURL: null })).toBeNull();
    expect(mapRidotCamera({ ...camera, CCVEWebURL: ' ' })).toBeNull();
    expect(mapRidotCamera({ ...camera, CCVEWebURL: 'http://example.com/95_42.4_N_CAM.jpg' })).toBeNull();
    expect(mapRidotCamera(null)).toBeNull();
  });

  it('falls back when the description is missing', () => {
    expect(mapRidotCamera({ ...camera, Description: ' ' })?.name).toBe('RIDOT Camera 24');
  });
});

describe('ridotCameraName', () => {
  it('spells out route and mile codes', () => {
    expect(ridotCameraName('95_42.4_N_CAM - Broadway (Pawt)')).toBe('I-95 N MM 42.4 – Broadway (Pawt)');
    expect(ridotCameraName('146_00.0_CAM - Department of Health')).toBe('Rt 146 MM 0.0 – Department of Health');
    expect(ridotCameraName('4_04.6_S_CAM Exit 5 - Rt 102 DMS')).toBe('Rt 4 S MM 4.6 – Exit 5 - Rt 102 DMS');
    expect(ridotCameraName('295_18.4_SM_CAM Exit 18A - Rt 146')).toBe('I-295 MM 18.4 – Exit 18A - Rt 146');
    expect(ridotCameraName('95_22.8_S_CAM')).toBe('I-95 S MM 22.8');
  });

  it('drops the sequence number from Route 1 and I-195 names', () => {
    expect(ridotCameraName('195-8 I-195 W @ Mass State Line')).toBe('I-195 W @ Mass State Line');
    expect(ridotCameraName('1-01 Rt 1 S @ Fourth Ave East Greenwich')).toBe('Rt 1 S @ Fourth Ave East Greenwich');
  });

  it('leaves plain names alone', () => {
    expect(ridotCameraName('Rt 114 Middletown')).toBe('Rt 114 Middletown');
    expect(ridotCameraName('Henderson Bridge Prov 1 ')).toBe('Henderson Bridge Prov 1');
    expect(ridotCameraName(' ')).toBeNull();
    expect(ridotCameraName(null)).toBeNull();
  });
});

describe('fetchRidotCameras', () => {
  it('throws on an HTTP error, an ArcGIS error body, a bad shape or a short read', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
    await expect(fetchRidotCameras()).rejects.toThrow('HTTP 503');
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: { code: 400, message: 'Invalid query' } })));
    await expect(fetchRidotCameras()).rejects.toThrow('Invalid query');
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ fields: [] })));
    await expect(fetchRidotCameras()).rejects.toThrow('no features');
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ features: [{ attributes: camera }, { attributes: camera }] })));
    await expect(fetchRidotCameras()).rejects.toThrow('short read: 1');
  });
});

const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

liveIt('fetches a large set of well-formed RIDOT cameras', async () => {
  const cams = await fetchRidotCameras();
  expect(cams.length).toBeGreaterThan(110);
  expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
  const b = RIDOT_BOUNDS;
  for (const c of cams) {
    expect(c.id).toMatch(/^ridot-\d+$/);
    expect(c.source).toBe('RIDOT');
    expect(c.feed_url).toMatch(/^https:\/\/www\.dot\.ri\.gov\/img\/travel\/camimages\/[^\s?#]+\.jpg$/);
    expect(c.lat > b.minLat && c.lat < b.maxLat && c.lng > b.minLng && c.lng < b.maxLng).toBe(true);
  }
}, 20_000);
