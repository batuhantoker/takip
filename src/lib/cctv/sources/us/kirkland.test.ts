import { afterEach, describe, it, expect, vi } from 'vitest';
import { mapKirklandCamera, fetchKirklandCameras, type KirklandFeature } from './kirkland';

afterEach(() => vi.unstubAllGlobals());

// Trimmed from TRN_TrafficCams_10032022/FeatureServer/0/query?outSR=4326 (2026-10-13).
const juanita: KirklandFeature = {
  attributes: {
    LOCATION: '100th Ave. N.E. and N.E. 132nd St.', OWNER: 'CoK',
    IMAGE_: 'https://its.kirklandwa.gov/CamView/100thAve132ndStPTZ.jpg',
  },
  geometry: { x: -122.20774859423562, y: 47.71846551937438 },
};
const withAttrs = (a: Partial<NonNullable<KirklandFeature['attributes']>>): KirklandFeature =>
  ({ ...juanita, attributes: { ...juanita.attributes, ...a } });

describe('mapKirklandCamera', () => {
  it('maps a camera to its still, id from the file name', () => {
    expect(mapKirklandCamera(juanita)).toEqual({
      id: 'kirkland-100thAve132ndStPTZ',
      lat: 47.71846551937438,
      lng: -122.20774859423562,
      name: '100th Ave. N.E. and N.E. 132nd St.',
      city: 'Kirkland',
      country: 'US',
      feed_url: 'https://its.kirklandwa.gov/CamView/100thAve132ndStPTZ.jpg',
      stream_type: 'jpg',
      source: 'City of Kirkland',
    });
  });

  it('reads the geometry, not the swapped LAT/LON columns', () => {
    const swapped = { ...juanita, attributes: { ...juanita.attributes, LAT: -122.20773369, LON: 47.71845988 } } as KirklandFeature;
    expect(mapKirklandCamera(swapped)?.lat).toBeCloseTo(47.718, 3);
  });

  it("drops other agencies' rows and bad stills", () => {
    expect(mapKirklandCamera(withAttrs({ OWNER: 'WSDOT', IMAGE_: 'http://images.wsdot.wa.gov/nw/405vc02095.jpg' }))).toBeNull();
    expect(mapKirklandCamera(withAttrs({ OWNER: 'CoB' }))).toBeNull();
    expect(mapKirklandCamera(withAttrs({ IMAGE_: 'http://its.kirklandwa.gov/CamView/100thAve132ndStPTZ.jpg' }))).toBeNull();
    expect(mapKirklandCamera(withAttrs({ IMAGE_: null }))).toBeNull();
    expect(mapKirklandCamera({ ...juanita, geometry: { x: 0, y: 0 } })).toBeNull();
  });
});

describe('fetchKirklandCameras', () => {
  it('maps the response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ features: [juanita, juanita] })));
    expect((await fetchKirklandCameras()).map(c => c.id)).toEqual(['kirkland-100thAve132ndStPTZ']);
  });
});
