import { afterEach, describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/stealthFetch', () => ({ stealthFetch: vi.fn() }));

import { stealthFetch } from '@/lib/stealthFetch';
import { mapFeature, fetchCaltransCameras, type CaltransFeature } from './caltrans';

const sample: CaltransFeature = {
  attributes: {
    OBJECTID: 42,
    latitude: 34.0522,
    longitude: -118.2437,
    currentImageURL: 'https://cwwp2.dot.ca.gov/data/d7/cctv/image/example/example.jpg',
    locationName: 'I-110 at 4th St',
    nearbyPlace: 'Los Angeles',
    county: 'Los Angeles',
  },
};

const feature = (id: number): CaltransFeature => ({ attributes: { ...sample.attributes, OBJECTID: id } });
const page = (from: number, count: number) => ({
  ok: true,
  json: async () => ({ features: Array.from({ length: count }, (_, i) => feature(from + i)) }),
});

afterEach(() => vi.mocked(stealthFetch).mockReset());

describe('mapFeature', () => {
  it('maps a feature to a camera', () => {
    expect(mapFeature(sample)).toEqual({
      id: 'cal-42',
      lat: 34.0522,
      lng: -118.2437,
      name: 'I-110 at 4th St',
      city: 'Los Angeles',
      country: 'US',
      feed_url: 'https://cwwp2.dot.ca.gov/data/d7/cctv/image/example/example.jpg',
      source: 'Caltrans',
    });
  });

  it('skips features without coordinates or an image', () => {
    expect(mapFeature({ attributes: { ...sample.attributes, latitude: undefined } })).toBeNull();
    expect(mapFeature({ attributes: { ...sample.attributes, currentImageURL: null } })).toBeNull();
    expect(mapFeature({})).toBeNull();
  });
});

describe('fetchCaltransCameras', () => {
  it('pages past the layer’s 2,000-record limit', async () => {
    vi.mocked(stealthFetch)
      .mockResolvedValueOnce(page(0, 2000) as unknown as Response)
      .mockResolvedValueOnce(page(2000, 936) as unknown as Response);

    const cams = await fetchCaltransCameras();

    expect(cams).toHaveLength(2936);
    expect(vi.mocked(stealthFetch)).toHaveBeenCalledTimes(2);
    expect(String(vi.mocked(stealthFetch).mock.calls[1][0])).toContain('resultOffset=2000');
  });

  it('keeps what it has when a later page fails', async () => {
    vi.mocked(stealthFetch)
      .mockResolvedValueOnce(page(0, 2000) as unknown as Response)
      .mockResolvedValueOnce({ ok: false, status: 503 } as unknown as Response);

    expect(await fetchCaltransCameras()).toHaveLength(2000);
  });
});
