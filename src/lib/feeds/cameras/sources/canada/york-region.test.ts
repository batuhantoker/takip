import { afterEach, describe, it, expect, vi } from 'vitest';
import { mapYorkRegionCamera, fetchYorkRegionCameras, YORK_REGION_BOUNDS, type YorkRegionFeature } from './york-region';

afterEach(() => vi.unstubAllGlobals());

// Trimmed features from ww8.yorkmaps.ca/arcgis/rest/services/OpenData/Traffic/MapServer/0/query?outSR=4326 (2026-10-12).
const leslie = {
  attributes: {
    FACILITYID: '21', LATITUDE: 4855860.16, LONGITUDE: 630036.43,
    photo: 'https://ww5.yorkmaps.ca/webtrafficimages/loc21.jpg',
    photoreference: 'https://ww5.yorkmaps.ca/webtrafficimages/loc21R.jpg',
    url: 'https://ww5.yorkmaps.ca/webtrafficimages/location21.html',
    cameralocation: 'Highway 7 and Leslie Street', ESRI_OID: 1,
  },
  geometry: { x: -79.38230940047303, y: 43.84438561894178 },
} as YorkRegionFeature;
const jane = {
  attributes: {
    FACILITYID: '37',
    photo: 'https://ww5.yorkmaps.ca/webtrafficimages/loc37.jpg',
    url: 'https://ww5.yorkmaps.ca/webtraffic/location37.html',
    cameralocation: 'Jane Street and Major Mackenzie Drive',
  },
  geometry: { x: -79.53663944990073, y: 43.84951461300264 },
} as YorkRegionFeature;

describe('mapYorkRegionCamera', () => {
  it('maps a camera to its still and viewer page', () => {
    expect(mapYorkRegionCamera(leslie)).toEqual({
      id: 'yorkregion-21',
      lat: 43.84438561894178,
      lng: -79.38230940047303,
      name: 'Highway 7 and Leslie Street',
      city: 'York Region',
      country: 'Canada',
      feed_url: 'https://ww5.yorkmaps.ca/webtrafficimages/loc21.jpg',
      stream_type: 'jpg',
      external_url: 'https://ww5.yorkmaps.ca/webtrafficimages/location21.html',
      source: 'York Region',
    });
  });

  it('keeps the camera when only the viewer link is unusable', () => {
    const cam = mapYorkRegionCamera({ ...jane, attributes: { ...jane.attributes, url: 'http://ww5.yorkmaps.ca/webtraffic/location37.html' } });
    expect(cam?.id).toBe('yorkregion-37');
    expect(cam?.external_url).toBeUndefined();
  });

  it('drops stills that are not https jpgs on yorkmaps.ca', () => {
    expect(mapYorkRegionCamera({ ...leslie, attributes: { ...leslie.attributes, photo: 'http://ww5.yorkmaps.ca/webtrafficimages/loc21.jpg' } })).toBeNull();
    expect(mapYorkRegionCamera({ ...leslie, attributes: { ...leslie.attributes, photo: 'https://example.com/loc21.jpg' } })).toBeNull();
    expect(mapYorkRegionCamera({ ...leslie, attributes: { ...leslie.attributes, photo: null } })).toBeNull();
  });

  it('drops rows with a bad id or unusable coordinates', () => {
    expect(mapYorkRegionCamera({ ...leslie, attributes: { ...leslie.attributes, FACILITYID: null } })).toBeNull();
    expect(mapYorkRegionCamera({ ...leslie, attributes: { ...leslie.attributes, FACILITYID: '21a' } })).toBeNull();
    expect(mapYorkRegionCamera({ ...leslie, geometry: { x: 0, y: 0 } })).toBeNull();
    expect(mapYorkRegionCamera({ ...leslie, geometry: null })).toBeNull();
    // The projected LATITUDE/LONGITUDE pair, mistaken for degrees.
    expect(mapYorkRegionCamera({ ...leslie, geometry: { x: 630036.43, y: 4855860.16 } })).toBeNull();
    expect(mapYorkRegionCamera(null)).toBeNull();
  });
});

describe('fetchYorkRegionCameras', () => {
  it('maps and dedupes the layer features', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ features: [leslie, jane, leslie] })));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const cams = await fetchYorkRegionCameras();
    expect(cams.map(c => c.id)).toEqual(['yorkregion-21', 'yorkregion-37']);
  });

  it('throws on an HTTP error or an ArcGIS error body', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 502 })));
    await expect(fetchYorkRegionCameras()).rejects.toThrow('HTTP 502');
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: { code: 400, message: 'Invalid query' } })));
    await expect(fetchYorkRegionCameras()).rejects.toThrow('Invalid query');
  });
});

// Live integration test — opt in with RUN_LIVE_TESTS=1.
const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

describe('fetchYorkRegionCameras (live)', () => {
  liveIt('fetches the York Region cameras', async () => {
    const cams = await fetchYorkRegionCameras();
    expect(cams.length).toBeGreaterThan(300);
    const b = YORK_REGION_BOUNDS;
    for (const c of cams) {
      expect(c.lat > b.minLat && c.lat < b.maxLat && c.lng > b.minLng && c.lng < b.maxLng).toBe(true);
      expect(c.feed_url).toMatch(/^https:\/\/ww\d+\.yorkmaps\.ca\/webtrafficimages\/loc\d+\.jpg$/);
    }
  }, 20_000);
});
