import { afterEach, describe, it, expect, vi } from 'vitest';
import { mapSurreyCamera, fetchSurreyCameras, SURREY_BOUNDS, type SurreyFeature } from './surrey';

afterEach(() => vi.unstubAllGlobals());

// Trimmed from gisservices.surrey.ca/…/Transportation/MapServer/2/query?outSR=4326 (2026-10-13).
const cam = (location: string | null, image: string | null, x = -122.83443996879859, y = 49.15452843247758): SurreyFeature =>
  ({ attributes: { LOCATION: location, IMAGE: image }, geometry: { x, y } });
const blob = (path: string) => `https://stcameleonprod.blob.core.windows.net/prodcameleon-blob/${path}`;
const main = cam('83A Ave & 140 St', blob('TMCNVR02/enc_83A_140_cam1.jpg'));

describe('mapSurreyCamera', () => {
  it('maps a camera to its still', () => {
    expect(mapSurreyCamera(main)).toEqual({
      id: 'surrey-83A_140_cam1',
      lat: 49.15452843247758,
      lng: -122.83443996879859,
      name: '83A Ave & 140 St',
      city: 'Surrey',
      country: 'Canada',
      feed_url: blob('TMCNVR02/enc_83A_140_cam1.jpg'),
      stream_type: 'jpg',
      source: 'City of Surrey',
    });
  });

  it('labels the second view at an intersection', () => {
    expect(mapSurreyCamera(cam('86 Ave & 152 St', blob('TMCNVR05/enc_86_152_pano.jpg')))?.name).toBe('86 Ave & 152 St (pano)');
    expect(mapSurreyCamera(cam('Fraser Hwy & 184 St', blob('TMCNVR07/enc_fraser_184_cam2.jpg')))?.name).toBe('Fraser Hwy & 184 St (cam2)');
  });

  it("drops DriveBC's cameras and the dead cosmos stills", () => {
    expect(mapSurreyCamera(cam('Hwy 1 at 152 St', 'https://www.drivebc.ca/bchighwaycam/pub/cameras/7.jpg'))).toBeNull();
    expect(mapSurreyCamera(cam('104 Ave & King George', 'https://cosmos.surrey.ca/trafficcams/enc_104_kgbv_cam1.jpg'))).toBeNull();
    expect(mapSurreyCamera(cam(null, null))).toBeNull();
  });

  it('drops rows outside Surrey', () => {
    expect(mapSurreyCamera({ ...main, geometry: { x: 0, y: 0 } })).toBeNull();
    expect(mapSurreyCamera({ ...main, geometry: null })).toBeNull();
    const b = SURREY_BOUNDS;
    expect(mapSurreyCamera({ ...main, geometry: { x: b.minLng - 0.01, y: 49.1 } })).toBeNull();
  });

  it('falls back to the view id without a location', () => {
    expect(mapSurreyCamera(cam(null, blob('TMCNVR02/enc_83A_140_cam1.jpg')))?.name).toBe('Surrey Camera 83A_140_cam1');
  });
});

describe('fetchSurreyCameras', () => {
  it('keeps one camera per still and refuses a short read', async () => {
    const many = Array.from({ length: 520 }, (_, i) => cam(`${i} Ave`, blob(`TMCNVR01/enc_${i}_cam1.jpg`)));
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ features: [...many, main, main] })));
    expect(await fetchSurreyCameras()).toHaveLength(521);

    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ features: [main] })));
    await expect(fetchSurreyCameras()).rejects.toThrow('short read');
  });

  it('throws on an ArcGIS error body', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: { code: 400, message: 'Invalid query' } })));
    await expect(fetchSurreyCameras()).rejects.toThrow('Invalid query');
  });
});

const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;

liveIt('fetches Surrey cameras', async () => {
  const cams = await fetchSurreyCameras();
  expect(cams.length).toBeGreaterThan(500);
  expect(new Set(cams.map(c => c.id)).size).toBe(cams.length);
});
