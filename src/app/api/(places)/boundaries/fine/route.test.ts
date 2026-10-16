import { describe, it, expect, vi, beforeEach } from 'vitest';

let upstream: () => Promise<unknown> = async () => null;
const calls: unknown[][] = [];
vi.mock('@/lib/places/areas/geoboundaries', async (orig) => ({
  ...(await orig<typeof import('@/lib/places/areas/geoboundaries')>()),
  loadFineSet: (...args: unknown[]) => { calls.push(args); return upstream(); },
}));

import { GET } from './route';
import { slimFeatures } from '@/lib/places/areas/geoboundaries';

const get = (query: string) => GET(new Request(`http://localhost/api/boundaries/fine?${query}`));

const SET = {
  source: 'geoBoundaries · Src · PD',
  features: slimFeatures({
    features: [{ type: 'Feature', properties: { shapeID: 'A-1', shapeName: 'One' }, geometry: { type: 'Polygon', coordinates: [[[1, 1], [2, 1], [2, 2], [1, 2], [1, 1]]] } }],
  } as unknown as { features: GeoJSON.Feature[] }),
};

describe('GET /api/boundaries/fine', () => {
  beforeEach(() => { calls.length = 0; });

  it('rejects anything but a strict ISO code, level and cell, without going upstream', async () => {
    for (const q of ['iso3=deu&level=admin2&cell=0_0', 'iso3=DEU&level=admin1&cell=0_0', 'iso3=DEU&level=admin2&cell=../0', 'iso3=DE/U&level=admin2&cell=0_0', 'level=admin2&cell=0_0']) {
      expect((await get(q)).status).toBe(400);
    }
    expect(calls).toEqual([]);
  });

  it('serves the cell with its credit line, cacheably', async () => {
    upstream = async () => SET;
    const res = await get('iso3=AAA&level=admin2&cell=0_0');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('s-maxage');
    const body = await res.json();
    expect(body.source).toBe(SET.source);
    expect(body.features.map((f: GeoJSON.Feature) => f.properties?.id)).toEqual(['A-1']);
    expect(calls).toEqual([['AAA', 'admin2']]);
  });

  it('answers a cacheable 404 when the level is not offered', async () => {
    upstream = async () => null;
    const res = await get('iso3=AAA&level=admin3&cell=0_0');
    expect(res.status).toBe(404);
    expect(res.headers.get('cache-control')).toContain('s-maxage');
  });

  it('answers an uncached 502 when the upstream fails', async () => {
    upstream = async () => { throw new Error('boom'); };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await get('iso3=AAA&level=admin2&cell=0_0');
    expect(res.status).toBe(502);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});
