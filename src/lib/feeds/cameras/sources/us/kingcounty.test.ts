import { afterEach, describe, it, expect, vi } from 'vitest';
import { mapKingCountyCamera, fetchKingCountyCameras, type KingCountyFeature } from './kingcounty';

afterEach(() => vi.unstubAllGlobals());

// Trimmed from TRAFFICCAMERA_POINT_2029/FeatureServer/0/query?outSR=4326 (2026-10-13).
const whiteCenter: KingCountyFeature = {
  attributes: {
    AssetID: 14, Location: '16th Ave SW at SW 107th St', Owner: 'King County', CurrentStatus: 'Active', Live: 1,
    ImageURL: 'http://info.kingcounty.gov/transportation/kcdot/Roads/TrafficCameras/ImageHandler/Handler.ashx?id=16SW_107.jpg',
  },
  geometry: { x: -122.35527661244028, y: 47.5069864992859 },
};
const withAttrs = (a: Partial<NonNullable<KingCountyFeature['attributes']>>): KingCountyFeature =>
  ({ ...whiteCenter, attributes: { ...whiteCenter.attributes, ...a } });

describe('mapKingCountyCamera', () => {
  it('maps a camera to its still over https, keeping the id query', () => {
    expect(mapKingCountyCamera(whiteCenter)).toEqual({
      id: 'kingcounty-14',
      lat: 47.5069864992859,
      lng: -122.35527661244028,
      name: '16th Ave SW at SW 107th St',
      city: 'King County',
      country: 'US',
      feed_url: 'https://info.kingcounty.gov/transportation/kcdot/Roads/TrafficCameras/ImageHandler/Handler.ashx?id=16SW_107.jpg',
      stream_type: 'jpg',
      source: 'King County Roads',
    });
  });

  it('tolerates the trailing newline some rows carry', () => {
    expect(mapKingCountyCamera(withAttrs({ ImageURL: `${whiteCenter.attributes!.ImageURL}\n` }))?.feed_url).toMatch(/16SW_107\.jpg$/);
  });

  it("drops retired and offline rows, and Redmond's cameras", () => {
    expect(mapKingCountyCamera(withAttrs({ CurrentStatus: 'Retired' }))).toBeNull();
    expect(mapKingCountyCamera(withAttrs({ Live: 0 }))).toBeNull();
    expect(mapKingCountyCamera(withAttrs({ Owner: 'City of Redmond', ImageURL: 'http://gis.redmond.gov/traffic/tcimages/30.jpg' }))).toBeNull();
    expect(mapKingCountyCamera(withAttrs({ ImageURL: 'https://info.kingcounty.gov/transportation/kcdot/Roads/TrafficCameras/ImageHandler/Handler.ashx' }))).toBeNull();
    expect(mapKingCountyCamera({ ...whiteCenter, geometry: { x: 0, y: 0 } })).toBeNull();
  });
});

describe('fetchKingCountyCameras', () => {
  it('maps the response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ features: [whiteCenter, whiteCenter] })));
    expect((await fetchKingCountyCameras()).map(c => c.id)).toEqual(['kingcounty-14']);
  });
});
