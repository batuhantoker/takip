import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ReferenceDataset } from './catalog';
import { createFileStore } from './file-store';

/** Writes features the way tools/slim-geodata.py does: one per line, comma-terminated except the last. */
function writeCollection(file: string, features: object[]) {
  const lines = features.map((f, i) => JSON.stringify(f) + (i < features.length - 1 ? ',' : ''));
  writeFileSync(file, `{"type":"FeatureCollection","features":[\n${lines.join('\n')}\n]}\n`);
}

const point = (name: string, lng: number, lat: number, extra: object = {}) =>
  ({ type: 'Feature', properties: { name, ...extra }, geometry: { type: 'Point', coordinates: [lng, lat] } });

const dataset = (over: Partial<ReferenceDataset> = {}): ReferenceDataset => ({
  id: 'places', key: 'ref_places', label: 'Places', description: '', group: 'sites', geometry: 'point',
  color: '#fff', minZoom: 0, titleProp: 'name', attribution: 'test', ...over,
});

describe('createFileStore', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(path.join(tmpdir(), 'reference-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('reports a dataset that is not installed', async () => {
    expect(await createFileStore(dir).stat('places')).toBeNull();
  });

  it('returns the features in the box, byte for byte as stored, even after non-ASCII names', async () => {
    const features = [point('Zürich — Kloten', 8.55, 47.46), point('İstanbul', 28.8, 41.26), point('Ankara', 32.99, 40.12)];
    writeCollection(path.join(dir, 'places.geojson'), features);
    const store = createFileStore(dir);

    const r = await store.query(dataset(), { boxes: [[25, 38, 35, 42]], zoom: 5, limit: 100 });
    expect(r.matched).toBe(2);
    expect(r.features).toEqual([JSON.stringify(features[1]), JSON.stringify(features[2])]);
  });

  it('counts every match but returns no more than the limit', async () => {
    writeCollection(path.join(dir, 'places.geojson'), Array.from({ length: 10 }, (_, i) => point(`p${i}`, i, 0.5)));
    const r = await createFileStore(dir).query(dataset(), { boxes: [[-180, -90, 180, 90]], zoom: 5, limit: 3 });
    expect(r.matched).toBe(10);
    expect(r.features).toHaveLength(3);
  });

  it('serves only the tier values below the tier zoom', async () => {
    writeCollection(path.join(dir, 'places.geojson'), [
      point('big', 1, 1, { type: 'large_airport' }),
      point('small', 2, 2, { type: 'small_airport' }),
    ]);
    const tiered = dataset({ tiers: [{ belowZoom: 6, property: 'type', values: ['large_airport'] }] });
    const store = createFileStore(dir);
    const names = async (zoom: number) =>
      (await store.query(tiered, { boxes: [[-180, -90, 180, 90]], zoom, limit: 10 })).features.map(f => JSON.parse(f).properties.name);

    expect(await names(4)).toEqual(['big']);
    expect(await names(6)).toEqual(['big', 'small']);
  });

  it('picks up a refreshed file instead of serving the old index', async () => {
    const file = path.join(dir, 'places.geojson');
    writeCollection(file, [point('old', 1, 1)]);
    const store = createFileStore(dir);
    const all = { boxes: [[-180, -90, 180, 90]] as [number, number, number, number][], zoom: 5, limit: 10 };
    expect((await store.query(dataset(), all)).matched).toBe(1);

    writeCollection(file, [point('new one', 1, 1), point('new two', 2, 2)]);
    const later = new Date(Date.now() + 5_000);
    (await import('node:fs')).utimesSync(file, later, later);
    expect((await store.query(dataset(), all)).matched).toBe(2);
  });

  it('cuts clipped lines to the box and thins them when zoomed out', async () => {
    const route = { type: 'Feature', properties: { name: 'cross-country' }, geometry: { type: 'LineString',
      coordinates: Array.from({ length: 101 }, (_, i) => [-120 + i * 0.5, 40 + (i % 2) * 0.0001]) } };
    writeCollection(path.join(dir, 'places.geojson'), [route]);
    const lines = dataset({ geometry: 'line', clip: true });

    const r = await createFileStore(dir).query(lines, { boxes: [[-100, 35, -90, 45]], zoom: 6, limit: 10 });
    const coords = JSON.parse(r.features[0]).geometry.coordinates as number[][];
    expect(coords[0][0]).toBe(-100);
    expect(coords[coords.length - 1][0]).toBe(-90);
    // The 11 m wiggle is far below a pixel at zoom 6, so only the ends survive.
    expect(coords).toHaveLength(2);
  });
});
