import { afterEach, describe, it, expect, vi } from 'vitest';
import { mapRedmondCamera, fetchRedmondCameras, type RedmondFeature } from './redmond';

afterEach(() => vi.unstubAllGlobals());

// Verbatim from gis.redmond.gov/…/Traffic/Cameras/MapServer/0/query?outSR=4326 (2026-10-13).
const block: RedmondFeature = {
  attributes: {
    d_CameraStatus: 'Enabled', d_Published: 'Yes',
    ImagePath: 'https://gis.redmond.gov/traffic/tcimages/16.jpg', Description: '2600 Block of 152nd Ave NE', TCID: 16,
  },
  geometry: { x: -122.13770933633947, y: 47.633154570383375 },
};
const withAttrs = (a: Partial<NonNullable<RedmondFeature['attributes']>>): RedmondFeature =>
  ({ ...block, attributes: { ...block.attributes, ...a } });

describe('mapRedmondCamera', () => {
  it('maps a camera to its still', () => {
    expect(mapRedmondCamera(block)).toEqual({
      id: 'redmond-16',
      lat: 47.633154570383375,
      lng: -122.13770933633947,
      name: '2600 Block of 152nd Ave NE',
      city: 'Redmond',
      country: 'US',
      feed_url: 'https://gis.redmond.gov/traffic/tcimages/16.jpg',
      stream_type: 'jpg',
      source: 'City of Redmond',
    });
  });

  it('upgrades http stills to https', () => {
    expect(mapRedmondCamera(withAttrs({ ImagePath: 'http://gis.redmond.gov/traffic/tcimages/16.jpg' }))?.feed_url)
      .toBe('https://gis.redmond.gov/traffic/tcimages/16.jpg');
  });

  it('drops disabled, unpublished and foreign rows', () => {
    expect(mapRedmondCamera(withAttrs({ d_CameraStatus: 'Disabled' }))).toBeNull();
    expect(mapRedmondCamera(withAttrs({ d_Published: 'No' }))).toBeNull();
    expect(mapRedmondCamera(withAttrs({ ImagePath: 'https://example.com/16.jpg' }))).toBeNull();
    expect(mapRedmondCamera(withAttrs({ TCID: null }))).toBeNull();
    expect(mapRedmondCamera({ ...block, geometry: null })).toBeNull();
  });
});

describe('fetchRedmondCameras', () => {
  it('throws on an ArcGIS error body', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: { code: 400, message: 'Invalid query' } })));
    await expect(fetchRedmondCameras()).rejects.toThrow('Invalid query');
  });
});
