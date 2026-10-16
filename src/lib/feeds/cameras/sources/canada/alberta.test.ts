import { describe, it, expect } from 'vitest';
import type { CctvCamera } from '@/lib/feeds/cameras/types';
import { mapIbi511Record, type Ibi511Record } from '@/lib/feeds/cameras/sources/platforms/ibi511';
import { albertaSource, intersectionKey } from './alberta';

const city = (id: string, name: string, lat: number, lng: number): CctvCamera =>
  ({ id, name, lat, lng, city: 'Calgary', country: 'Canada', source: 'City of Calgary' });

const row = (id: number, source: string, location: string, lat: number, lng: number): Ibi511Record => ({
  id, source, location,
  latLng: { geography: { wellKnownText: `POINT (${lng} ${lat})` } },
  images: [{ imageUrl: `/map/Cctv/${id}` }],
});

// Pairs measured 2026-10-13: the first two served byte-identical frames, the RWIS mast a different view.
const CITY = [
  city('calgary-loc172', 'Airport Tr / Deerfoot Tr NE', 51.13897, -114.0219),
  city('calgary-loc6', 'Glenmore Trail / Elbow Drive SW (East)', 50.98668, -114.07946),
  city('calgary-loc200', 'Stoney Tr / Macleod Tr S', 50.8951, -114.0622),
];

describe('intersectionKey', () => {
  it('reads the two agencies’ spellings of one corner alike', () => {
    expect(intersectionKey('162 Avenue / James McKevitt Road SW')).toBe(intersectionKey('162 Ave  / James Mckevitt Rd SW'));
    expect(intersectionKey('90 Ave / Stoney Tr SW')).toBe(intersectionKey('90 Ave and Stoney Trail SW'));
  });
});

describe('albertaSource', () => {
  const cfg = albertaSource(CITY);

  it('drops a row sitting on a city camera', () => {
    expect(mapIbi511Record(row(498, 'Alberta511', 'Airport Tr / Deerfoot Tr NE', 51.13898, -114.02191), cfg)).toBeNull();
  });

  it('drops a same-named row placed a few hundred metres off', () => {
    expect(mapIbi511Record(row(468, 'Calgary', 'Glenmore Trail / Elbow Drive SW (East)', 50.98668, -114.075), cfg)).toBeNull();
  });

  it('keeps provincial road-weather cameras that stand at a city interchange', () => {
    expect(mapIbi511Record(row(24, 'WOOD', 'Stoney Trail and Macleod Trail', 50.8952, -114.0624), cfg)?.id).toBe('ab-24');
  });

  it('keeps provincial cameras the city does not run', () => {
    expect(mapIbi511Record(row(182, 'USER', 'Hwy 2: North of Balzac Overpass south of Airdrie', 51.25, -114.0), cfg)?.id).toBe('ab-182');
  });

  it('keeps everything when the city list is unavailable', () => {
    expect(mapIbi511Record(row(498, 'Alberta511', 'Airport Tr / Deerfoot Tr NE', 51.13898, -114.02191), albertaSource([]))?.id)
      .toBe('ab-498');
  });
});
