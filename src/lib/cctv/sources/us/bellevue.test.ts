import { afterEach, describe, it, expect, vi } from 'vitest';
import { mapBellevueCamera, fetchBellevueCameras, type BellevueFeature } from './bellevue';

afterEach(() => vi.unstubAllGlobals());

// Trimmed from TrafficCameras_Public_View/FeatureServer/0/query?outSR=4326 (2026-10-13).
const lakemont: BellevueFeature = {
  attributes: {
    ID: 'CCTV218', Address: 'LAKEMONT & CGR MTN WY',
    Display_Address: 'Lakemont Blvd & Cougar Mtn Way                                        ',
    OwnedBy: 'Bellevue', Media: 'Stream',
  },
  geometry: { x: -122.129266, y: 47.546546 },
};
const withAttrs = (a: Partial<NonNullable<BellevueFeature['attributes']>>): BellevueFeature =>
  ({ ...lakemont, attributes: { ...lakemont.attributes, ...a } });

describe('mapBellevueCamera', () => {
  it('maps a camera to its live stream', () => {
    expect(mapBellevueCamera(lakemont)).toEqual({
      id: 'bellevue-CCTV218',
      lat: 47.546546,
      lng: -122.129266,
      name: 'Lakemont Blvd & Cougar Mtn Way',
      city: 'Bellevue',
      country: 'US',
      stream_url: 'https://trafficcams.bellevuewa.gov/traffic-edge/CCTV218L.stream/playlist.m3u8',
      stream_type: 'hls',
      source: 'City of Bellevue',
    });
  });

  it('upper-cases the lower-case ids the layer also has', () => {
    expect(mapBellevueCamera(withAttrs({ ID: 'cctv167' }))?.stream_url)
      .toBe('https://trafficcams.bellevuewa.gov/traffic-edge/CCTV167L.stream/playlist.m3u8');
  });

  it("drops stills, cameras with no media, and WSDOT's and Redmond's rows", () => {
    expect(mapBellevueCamera(withAttrs({ ID: '405VC00926', OwnedBy: 'WSDOT', Media: 'Image' }))).toBeNull();
    expect(mapBellevueCamera(withAttrs({ OwnedBy: 'Redmond' }))).toBeNull();
    expect(mapBellevueCamera(withAttrs({ Media: 'None' }))).toBeNull();
    // `COB` and blank owners are Bellevue's own.
    expect(mapBellevueCamera(withAttrs({ OwnedBy: 'COB' }))).not.toBeNull();
    expect(mapBellevueCamera(withAttrs({ OwnedBy: null }))).not.toBeNull();
  });

  it('drops bad ids and positions', () => {
    expect(mapBellevueCamera(withAttrs({ ID: '../CCTV218' }))).toBeNull();
    expect(mapBellevueCamera({ ...lakemont, geometry: { x: 0, y: 0 } })).toBeNull();
  });

  it('falls back to the short address', () => {
    expect(mapBellevueCamera(withAttrs({ Display_Address: '   ' }))?.name).toBe('LAKEMONT & CGR MTN WY');
  });
});

describe('fetchBellevueCameras', () => {
  it('keeps one camera per id and refuses a short read', async () => {
    const many = Array.from({ length: 170 }, (_, i) => withAttrs({ ID: `CCTV${i}` }));
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ features: [...many, lakemont, lakemont] })));
    expect(await fetchBellevueCameras()).toHaveLength(171);

    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ features: [lakemont] })));
    await expect(fetchBellevueCameras()).rejects.toThrow('short read');
  });
});
