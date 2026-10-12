import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GET } from './route';
import { GET as catalog } from '../route';

const spaceport = (name: string, lng: number, lat: number) =>
  ({ type: 'Feature', properties: { Name: name }, geometry: { type: 'Point', coordinates: [lng, lat] } });

function install(dir: string, id: string, features: object[]) {
  const lines = features.map((f, i) => JSON.stringify(f) + (i < features.length - 1 ? ',' : ''));
  writeFileSync(path.join(dir, `${id}.geojson`), `{"type":"FeatureCollection","features":[\n${lines.join('\n')}\n]}\n`);
}

const get = (id: string, query = '', headers: Record<string, string> = {}) =>
  GET(new Request(`http://localhost/api/reference/${id}${query}`, { headers }), { params: Promise.resolve({ dataset: id }) });

describe('GET /api/reference/{dataset}', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'reference-route-'));
    process.env.REFERENCE_DATA_DIR = dir;
    install(dir, 'spaceports', [spaceport('Cape Canaveral', -80.6, 28.5), spaceport('Kodiak', -152.3, 57.4)]);
  });
  afterEach(() => {
    delete process.env.REFERENCE_DATA_DIR;
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns the features in the box as a FeatureCollection', async () => {
    const res = await get('spaceports', '?bbox=-90,20,-70,35&zoom=4');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.type).toBe('FeatureCollection');
    expect(body.features.map((f: { properties: { Name: string } }) => f.properties.Name)).toEqual(['Cape Canaveral']);
    expect(body).toMatchObject({ matched: 1, truncated: false });
  });

  it('serves the whole dataset when no box is given', async () => {
    expect((await (await get('spaceports')).json()).features).toHaveLength(2);
  });

  it('returns an empty collection with the minZoom below it', async () => {
    const body = await (await get('spaceports', '?zoom=1')).json();
    expect(body).toMatchObject({ features: [], minZoom: 2 });
  });

  it('rejects an unknown dataset, including path tricks', async () => {
    expect((await get('nope')).status).toBe(404);
    expect((await get('..%2F..%2Fpackage')).status).toBe(404);
  });

  it('rejects a malformed box or zoom', async () => {
    expect((await get('spaceports', '?bbox=1,2,3')).status).toBe(400);
    expect((await get('spaceports', '?zoom=99')).status).toBe(400);
    expect((await get('spaceports', '?zoom=abc')).status).toBe(400);
  });

  it('answers 503 for a dataset this server has not installed', async () => {
    expect((await get('dams', '?zoom=10')).status).toBe(503);
  });

  it('lets a client revalidate with the ETag', async () => {
    const first = await get('spaceports');
    const etag = first.headers.get('etag')!;
    expect(etag).toBeTruthy();
    expect(first.headers.get('cache-control')).toContain('max-age=600');
    expect((await get('spaceports', '', { 'if-none-match': etag })).status).toBe(304);
  });
});

describe('GET /api/reference', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'reference-catalog-'));
    process.env.REFERENCE_DATA_DIR = dir;
  });
  afterEach(() => {
    delete process.env.REFERENCE_DATA_DIR;
    rmSync(dir, { recursive: true, force: true });
  });

  it('reports nothing available on a server without the data', async () => {
    const body = await (await catalog()).json();
    expect(body.available).toBe(false);
    expect(body.datasets.every((d: { available: boolean }) => !d.available)).toBe(true);
  });

  it('marks the installed datasets', async () => {
    install(dir, 'spaceports', [spaceport('Cape Canaveral', -80.6, 28.5)]);
    const body = await (await catalog()).json();
    expect(body.available).toBe(true);
    const available = body.datasets.filter((d: { available: boolean }) => d.available).map((d: { id: string }) => d.id);
    expect(available).toEqual(['spaceports']);
  });
});
