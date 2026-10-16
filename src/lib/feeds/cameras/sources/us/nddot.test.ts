import { afterEach, describe, it, expect, vi } from 'vitest';
import { mapNddotCamera, fetchNddotCameras, NDDOT_BOUNDS, type NddotSite } from './nddot';

afterEach(() => vi.unstubAllGlobals());

// Verbatim from travelfiles.dot.nd.gov/geojson/cameras/cameras.json.
const views = [
  { Description: 'Ray - West (US 2 MP 51.3) - NDDOT', LinkPath: 'https://www.dot.nd.gov/travel-info/cameras/US2RP51Raywest.jpg', FullPath: 'https://www.dot.nd.gov/travel-info/cameras/US2RP51Raywest.jpg', Direction: 'West' },
  { Description: 'Ray - North (US 2 MP 51.3) - NDDOT', LinkPath: 'https://www.dot.nd.gov/travel-info/cameras/US2RP51Raycenter.jpg', FullPath: 'https://www.dot.nd.gov/travel-info/cameras/US2RP51Raycenter.jpg', Direction: 'North' },
  { Description: 'Ray - East (US 2 MP 51.3) - NDDOT', LinkPath: 'https://www.dot.nd.gov/travel-info/cameras/US2RP51Rayeast.jpg', FullPath: 'https://www.dot.nd.gov/travel-info/cameras/US2RP51Rayeast.jpg', Direction: 'East' },
  { Description: 'Ray - Pavement (US 2 MP 51.3) - NDDOT', LinkPath: 'https://www.dot.nd.gov/travel-info/cameras/US2RP51Raypavement.jpg', FullPath: 'https://www.dot.nd.gov/travel-info/cameras/US2RP51Raypavement.jpg', Direction: 'Pavement' },
];
const site = {
  type: 'Feature', id: '1',
  geometry: { type: 'Point', coordinates: [-103.21688, 48.34177] },
  properties: {
    ObjectID: 1, Region: 'Williston Area', Cameras: views,
    CRouteIDs: [{ CRouteID: '8' }, { CRouteID: '17' }],
    Highways: [{ HwyNum: 2, Direction: 'E', MPFrom: 51.3, HwyDesc: 'US 2', TypeDesc: 'US', Type: 'U', HwyTypeSort: 2 }],
  },
} as NddotSite;
const view = views[0];

// Verbatim views from the same file: padded LinkPaths, a FullPath typo and an `@` in the file name.
const paddedFront = {
  Description: 'Fargo - Pavement (I 29 MP 68.237) - NDDOT',
  LinkPath: ' https://www.dot.nd.gov/travel-info/cameras/I29RP68.237Fargo19th40thAveNPavement.jpg',
  FullPath: ' https://www.dot.nd.gov/travel-info/cameras/I29RP68.237Fargo19th&40thAveNPavement.jpg',
  Direction: 'Pavement',
};
const paddedCrlf = {
  Description: 'Fargo - East (I 29 MP 64.725) - NDDOT',
  LinkPath: 'https://www.dot.nd.gov/travel-info/cameras/I29RP64.725FargoNorthof9thAveEast.jpg\r\n\r\n',
  FullPath: 'https://www.dot.nd.gov/travel-info/cameras/I29RP64.725FargoNorthof9thAveEast.jpg\r\n\r\n',
  Direction: 'East',
};
const withAt = {
  Description: 'Fort Yates - North (ND1806 MP 22.81) - NDDOT',
  LinkPath: 'https://www.dot.nd.gov/travel-info/cameras/ND1806@RP22.81FortYatesNorth.jpg',
  FullPath: 'https://www.dot.nd.gov/travel-info/cameras/ND1806@RP22.81FortYatesNorth.jpg',
  Direction: 'North',
};

describe('mapNddotCamera', () => {
  it('maps a view to its still, captioned by region', () => {
    expect(mapNddotCamera(site, view)).toEqual({
      id: 'nddot-US2RP51Raywest',
      lat: 48.34177,
      lng: -103.21688,
      name: 'Ray - West (US 2 MP 51.3)',
      city: 'Williston Area',
      country: 'US',
      feed_url: 'https://www.dot.nd.gov/travel-info/cameras/US2RP51Raywest.jpg',
      stream_type: 'jpg',
      source: 'NDDOT',
    });
  });

  it('makes one camera per view, keyed by the file name', () => {
    expect(views.map(v => mapNddotCamera(site, v)?.id)).toEqual([
      'nddot-US2RP51Raywest', 'nddot-US2RP51Raycenter', 'nddot-US2RP51Rayeast', 'nddot-US2RP51Raypavement',
    ]);
  });

  it('trims padded LinkPaths and ignores FullPath', () => {
    expect(mapNddotCamera(site, paddedFront)?.feed_url).toBe('https://www.dot.nd.gov/travel-info/cameras/I29RP68.237Fargo19th40thAveNPavement.jpg');
    expect(mapNddotCamera(site, paddedCrlf)?.id).toBe('nddot-I29RP64.725FargoNorthof9thAveEast');
    expect(mapNddotCamera(site, paddedCrlf)?.feed_url).toBe('https://www.dot.nd.gov/travel-info/cameras/I29RP64.725FargoNorthof9thAveEast.jpg');
  });

  it('keeps an `@` in the file name', () => {
    const cam = mapNddotCamera(site, withAt);
    expect(cam?.id).toBe('nddot-ND1806@RP22.81FortYatesNorth');
    expect(cam?.feed_url).toBe('https://www.dot.nd.gov/travel-info/cameras/ND1806@RP22.81FortYatesNorth.jpg');
  });

  it('drops coordinates outside North Dakota', () => {
    expect(mapNddotCamera({ ...site, geometry: { coordinates: [0, 0] } }, view)).toBeNull();
    expect(mapNddotCamera({ ...site, geometry: { coordinates: [-93.26, 44.98] } }, view)).toBeNull();
    expect(mapNddotCamera({ ...site, geometry: { coordinates: [-103.21688, null] } }, view)).toBeNull();
    expect(mapNddotCamera({ ...site, geometry: null }, view)).toBeNull();
  });

  it('drops a view with no still, an http still or an unusable file name', () => {
    expect(mapNddotCamera(site, { ...view, LinkPath: null })).toBeNull();
    expect(mapNddotCamera(site, { ...view, LinkPath: 'US2RP51Raywest.jpg' })).toBeNull();
    expect(mapNddotCamera(site, { ...view, LinkPath: 'http://www.dot.nd.gov/travel-info/cameras/US2RP51Raywest.jpg' })).toBeNull();
    expect(mapNddotCamera(site, { ...view, LinkPath: 'https://www.dot.nd.gov/travel-info/cameras/' })).toBeNull();
    expect(mapNddotCamera(site, { ...view, LinkPath: 'https://www.dot.nd.gov/travel-info/cameras/US2 RP51.jpg' })).toBeNull();
    expect(mapNddotCamera(site, null)).toBeNull();
    expect(mapNddotCamera(null, view)).toBeNull();
  });

  it('falls back when the description or region is missing', () => {
    const cam = mapNddotCamera({ ...site, properties: { Region: ' ' } }, { ...view, Description: null });
    expect(cam?.name).toBe('NDDOT Camera US2RP51Raywest');
    expect(cam?.city).toBe('North Dakota');
  });

  it('tidies the description', () => {
    expect(mapNddotCamera(site, { Description: 'Fargo -  West (I 29 MP 64.725) - NDDOT', LinkPath: view.LinkPath })?.name)
      .toBe('Fargo - West (I 29 MP 64.725)');
    expect(mapNddotCamera(site, { Description: 'Verona - North (ND 13 MP 308)', LinkPath: view.LinkPath })?.name)
      .toBe('Verona - North (ND 13 MP 308)');
  });
});

describe('fetchNddotCameras', () => {
  it('throws on an HTTP error, a bad shape or a short read', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
    await expect(fetchNddotCameras()).rejects.toThrow('HTTP 503');
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ type: 'FeatureCollection' })));
    await expect(fetchNddotCameras()).rejects.toThrow('no features');
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ type: 'FeatureCollection', features: [site] })));
    await expect(fetchNddotCameras()).rejects.toThrow('short read: 4');
  });
});

const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

liveIt('fetches a large set of well-formed NDDOT cameras', async () => {
  const cams = await fetchNddotCameras();
  expect(cams.length).toBeGreaterThan(650);
  expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
  const b = NDDOT_BOUNDS;
  for (const c of cams) {
    expect(c.id).toMatch(/^nddot-[\w.@-]+$/);
    expect(c.source).toBe('NDDOT');
    expect(c.feed_url).toBe(`https://www.dot.nd.gov/travel-info/cameras/${c.id.slice('nddot-'.length)}.jpg`);
    expect(c.lat > b.minLat && c.lat < b.maxLat && c.lng > b.minLng && c.lng < b.maxLng).toBe(true);
  }
}, 20_000);
