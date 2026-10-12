import { describe, it, expect } from 'vitest';
import { mapIterisView, fetchSddotCameras, fetchMdtCameras, SDDOT, MDT, type IterisSite } from './iteris';

// Verbatim from sd.cdn.iteris-atis.com icons.cameras.geojson, trimmed to two views.
const watertown: IterisSite = {
  id: 'CSDATY',
  geometry: { coordinates: [-97.06, 44.95] },
  properties: {
    name: 'Watertown North',
    cameras: [
      { name: 'Camera Looking South', id: '1', description: 'Watertown-north of town along I-29 @ MP 179 looking south', image: 'https://sd.cdn.iteris-atis.com/camera_images/CSDATY/1/latest.jpg' },
      { name: 'Road Surface View', id: '4', description: 'Watertown-north of town along I-29 @ MP 179 road surface', image: 'https://sd.cdn.iteris-atis.com/camera_images/CSDATY/4/latest.jpg' },
    ],
  },
};

// Verbatim: a view SDDOT points at its shared placeholder.
const keystone: IterisSite = {
  id: 'CSDKY2',
  geometry: { coordinates: [-103.42556371, 43.89351545] },
  properties: {
    name: 'Keystone',
    cameras: [{ id: '1', name: 'Camera Looking South', description: 'Keystone-Junction US-16A & SD-40 looking south', image: 'https://sd.cdn.iteris-atis.com/camera_images/camera_unavailable.jpg' }],
  },
};

// Verbatim from sd icons.rwis.geojson: a view with no description.
const alsville: IterisSite = {
  id: 'CSDALS',
  geometry: { coordinates: [-97.12775701, 44.58672465] },
  properties: {
    name: 'Alsville',
    description: 'US-81',
    cameras: [{ image: 'https://sd.cdn.iteris-atis.com/camera_images/CSDALS/0/latest.jpg', description: null, name: 'Camera Looking North', id: '0' }],
  },
};

// Verbatim from mt.cdn.iteris-atis.com icons.rwis.geojson, trimmed to one view.
const savage: IterisSite = {
  id: '302007',
  geometry: { coordinates: [-104.37, 47.426] },
  properties: {
    id: '302007',
    name: 'Savage',
    description: 'MT-16 MP 29.5',
    cameras: [{ description: 'North Elev 2015', id: '302070-00-01', image: 'https://mt.cdn.iteris-atis.com/rwis_images/302070-00-01.jpg', name: 'Savage - North Elev 2015' }],
  },
};

const view = (s: IterisSite, i = 0) => s.properties!.cameras![i];

describe('mapIterisView', () => {
  it('maps an SDDOT view, keyed by site and view', () => {
    expect(mapIterisView(watertown, view(watertown), SDDOT)).toEqual({
      id: 'sddot-CSDATY-1',
      lat: 44.95,
      lng: -97.06,
      name: 'Watertown North: Camera Looking South',
      city: 'South Dakota',
      country: 'US',
      feed_url: 'https://sd.cdn.iteris-atis.com/camera_images/CSDATY/1/latest.jpg',
      stream_type: 'jpg',
      source: 'SDDOT',
    });
    expect(mapIterisView(watertown, view(watertown, 1), SDDOT)?.id).toBe('sddot-CSDATY-4');
  });

  it('maps an MDT weather-station view', () => {
    expect(mapIterisView(savage, view(savage), MDT)).toEqual({
      id: 'mdt-302007-302070-00-01',
      lat: 47.426,
      lng: -104.37,
      name: 'Savage: North Elev 2015',
      city: 'Montana',
      country: 'US',
      feed_url: 'https://mt.cdn.iteris-atis.com/rwis_images/302070-00-01.jpg',
      stream_type: 'jpg',
      source: 'MDT',
    });
  });

  it('labels a view from whichever field it has', () => {
    expect(mapIterisView(alsville, view(alsville), SDDOT)?.name).toBe('Alsville: Camera Looking North');
    expect(mapIterisView(alsville, { ...view(alsville), name: null, description: null }, SDDOT)?.name).toBe('Alsville');
  });

  it('drops the placeholder frame', () => {
    expect(mapIterisView(keystone, view(keystone), SDDOT)).toBeNull();
  });

  it('drops views outside the state or without coordinates', () => {
    // Verbatim: MDT's neighbour layer lists Gillette, WY.
    const gillette = { ...savage, geometry: { coordinates: [-105.467089, 44.29024] } };
    expect(mapIterisView(gillette, view(savage), MDT)).toBeNull();
    expect(mapIterisView(savage, view(savage), SDDOT)).toBeNull();
    expect(mapIterisView({ ...savage, geometry: { coordinates: [null, null] } }, view(savage), MDT)).toBeNull();
    expect(mapIterisView({ ...savage, geometry: null }, view(savage), MDT)).toBeNull();
  });

  it('drops views with no id, no https image, or an unsafe id', () => {
    expect(mapIterisView(savage, { ...view(savage), id: null }, MDT)).toBeNull();
    expect(mapIterisView({ ...savage, id: null, properties: { ...savage.properties, id: null } }, view(savage), MDT)).toBeNull();
    expect(mapIterisView(savage, { ...view(savage), id: '../x' }, MDT)).toBeNull();
    expect(mapIterisView(savage, { ...view(savage), image: 'http://mt.cdn.iteris-atis.com/rwis_images/302070-00-01.jpg' }, MDT)).toBeNull();
    expect(mapIterisView(savage, { ...view(savage), image: null }, MDT)).toBeNull();
  });
});

const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe.each([
  ['SDDOT', SDDOT, fetchSddotCameras, 500],
  ['MDT', MDT, fetchMdtCameras, 300],
] as const)('%s (live)', (_, cfg, fetchCameras, min) => {
  liveIt('fetches a large set of well-formed views', async () => {
    const cams = await fetchCameras();
    expect(cams.length).toBeGreaterThan(min);
    expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
    for (const c of cams) {
      expect(c.id).toMatch(new RegExp(`^${cfg.idPrefix}-[\\w-]+$`));
      expect(c.feed_url).toMatch(new RegExp(`^https://${cfg.st}\\.cdn\\.iteris-atis\\.com/`));
      expect(c.feed_url).not.toMatch(/camera_unavailable/);
      expect(c.lat).toBeGreaterThan(cfg.bounds.minLat);
      expect(c.lat).toBeLessThan(cfg.bounds.maxLat);
      expect(c.lng).toBeGreaterThan(cfg.bounds.minLng);
      expect(c.lng).toBeLessThan(cfg.bounds.maxLng);
    }
  });
});
