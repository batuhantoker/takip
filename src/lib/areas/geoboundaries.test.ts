import { describe, it, expect, vi, afterEach } from 'vitest';
import { creditLine, featuresInCell, loadFineSet, slimFeatures } from './geoboundaries';

const square = (w: number, s: number, e: number, n: number) => [[w, s], [e, s], [e, n], [w, n], [w, s]];

/** A wiggly edge, so simplification has something to remove. */
const wiggly = (w: number, s: number, e: number, n: number) => {
  const ring: number[][] = [];
  for (let i = 0; i <= 100; i++) ring.push([w + ((e - w) * i) / 100, s + (i % 2) * 1e-6]);
  ring.push([e, n], [w, n], [w, s]);
  return ring;
};

const GB = {
  features: [
    { type: 'Feature', properties: { shapeName: ' Elbeyli ', shapeID: 'T-1', shapeISO: '', shapeGroup: 'TUR' }, geometry: { type: 'Polygon', coordinates: [wiggly(0, 0, 1, 1)] } },
    { type: 'Feature', properties: { shapeName: 'Islands', shapeID: 'T-2' }, geometry: { type: 'MultiPolygon', coordinates: [[square(4, 0, 5, 1)], [square(8.5, 0, 9, 1)]] } },
    { type: 'Feature', properties: { shapeName: 'Nameless', shapeID: '' }, geometry: { type: 'Polygon', coordinates: [square(0, 0, 1, 1)] } },
    { type: 'Feature', properties: { shapeName: 'Speck', shapeID: 'T-3' }, geometry: { type: 'Polygon', coordinates: [[[0, 0], [0.00001, 0], [0, 0.00001], [0, 0]]] } },
    { type: 'Feature', properties: { shapeName: 'Point', shapeID: 'T-4' }, geometry: { type: 'Point', coordinates: [0, 0] } },
  ],
} as unknown as { features: GeoJSON.Feature[] };

describe('slimFeatures', () => {
  const slim = slimFeatures(GB);

  it('keeps only id and name, trimmed', () => {
    expect(slim.map(f => f.feature.properties)).toEqual([{ id: 'T-1', name: 'Elbeyli' }, { id: 'T-2', name: 'Islands' }]);
  });

  it('simplifies and rounds the outline', () => {
    const ring = (slim[0].feature.geometry as GeoJSON.Polygon).coordinates[0];
    expect(ring.length).toBeLessThan(10);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });

  it('drops features with no id, no area, or nothing left after simplifying', () => {
    expect(slim.find(f => f.feature.properties.id === 'T-3')).toBeUndefined();
  });

  it('keeps every part of a multipolygon', () => {
    expect(slim[1].feature.geometry.type).toBe('MultiPolygon');
    expect(slim[1].parts).toHaveLength(2);
  });
});

describe('featuresInCell', () => {
  const set = { source: 's', features: slimFeatures(GB) };

  it('returns what overlaps the cell, including a feature with only one part there', () => {
    // Cell 0_0 is 0–4°, cell 2_0 is 8–12°.
    expect(featuresInCell(set, '0_0').map(f => f.properties.id)).toEqual(['T-1', 'T-2']);
    expect(featuresInCell(set, '2_0').map(f => f.properties.id)).toEqual(['T-2']);
    expect(featuresInCell(set, '10_10')).toEqual([]);
  });

  it('returns nothing for a malformed cell', () => {
    expect(featuresInCell(set, 'nope')).toEqual([]);
  });
});

describe('creditLine', () => {
  it('credits geoBoundaries, then the source and licence it reports', () => {
    expect(creditLine({ boundarySource: 'ONS', boundaryLicense: 'Open Government Licence v3.0' })).toBe('geoBoundaries · ONS · Open Government Licence v3.0');
    expect(creditLine({ boundarySource: ' ' })).toBe('geoBoundaries');
  });
});

describe('loadFineSet', () => {
  afterEach(() => vi.unstubAllGlobals());

  const respond = (url: string, status: number, body: unknown = null) =>
    ({ ok: status < 400, status, url, json: async () => body, body: { cancel: async () => {} } });

  it('fetches the API, then the geometry it points to, once per country and level', async () => {
    const geomUrl = 'https://github.com/wmgeolab/geoBoundaries/raw/x/AAA-ADM2_simplified.geojson';
    const fetchMock = vi.fn(async (url: string) => url.includes('geoboundaries.org')
      ? respond(url, 200, { simplifiedGeometryGeoJSON: geomUrl, boundarySource: 'Src', boundaryLicense: 'PD' })
      : respond('https://media.githubusercontent.com/media/x.geojson', 200, GB));
    vi.stubGlobal('fetch', fetchMock);
    const set = await loadFineSet('AAA', 'admin2');
    await loadFineSet('AAA', 'admin2');
    expect(set?.source).toBe('geoBoundaries · Src · PD');
    expect(set?.features).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe('https://www.geoboundaries.org/api/current/gbOpen/AAA/ADM2/');
  });

  it('answers null when geoBoundaries has no such level for the country', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => respond(url, 404)));
    expect(await loadFineSet('BBB', 'admin3')).toBeNull();
  });

  it('refuses a geometry link or redirect off GitHub, and retries after a failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.includes('geoboundaries.org')
      ? respond(url, 200, { simplifiedGeometryGeoJSON: 'https://evil.example/x.geojson' })
      : respond(url, 200, GB)));
    await expect(loadFineSet('CCC', 'admin2')).rejects.toThrow(/Refusing/);

    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.includes('geoboundaries.org')
      ? respond(url, 200, { simplifiedGeometryGeoJSON: 'https://github.com/x.geojson' })
      : respond('https://evil.example/x.geojson', 200, GB)));
    await expect(loadFineSet('CCC', 'admin2')).rejects.toThrow(/Redirected/);
  });
});
