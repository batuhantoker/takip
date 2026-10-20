import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OPEN_HI, Prec } from '@takip/core/time';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fromWkb, fromWkt, toWkb, type Geometry, vertexCount } from './geo/geometry';
import { simplify, subdivide } from './geo/generalize';
import { GeoPrec, type EventInput } from './history-stores';
import { dataLayout } from './layout';
import { type Db, openWriter } from './open';
import { SqliteEventStore } from './sqlite/event-store';
import { GeoLayerWriter, geoLayers, SqliteFeatureStore } from './sqlite/feature-store';
import { SqliteSeriesStore } from './sqlite/series-store';

const Y = (y: number) => Date.UTC(y, 0, 1);
let dir: string;
let history: Db;
let events: SqliteEventStore;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'hist-'));
  history = openWriter(join(dir, 'history.db'), 'history');
  events = new SqliteEventStore(history);
  events.ensureKinds([
    { code: 'war', family: 'conflict' },
    { code: 'war.interstate', family: 'conflict', parent: 'war' },
    { code: 'attack.terror', family: 'terror' },
  ]);
  events.ensureRoles(['participant', 'side_a']);
});
afterEach(() => {
  history.close();
  rmSync(dir, { recursive: true, force: true });
});

const war = (over: Partial<EventInput> = {}): EventInput => ({
  kind: 'war.interstate',
  sourceId: 1,
  datasetId: 1,
  sourceRecordId: 'w1',
  title: 'A war',
  tStart: Date.UTC(1914, 6, 28),
  tStartPrec: Prec.day,
  tEnd: Date.UTC(1918, 10, 11),
  tEndPrec: Prec.day,
  lon: 5,
  lat: 49,
  geoPrec: GeoPrec.approximate,
  magnitude: 100,
  attrs: { a: 1 },
  entities: [{ entityId: 7, role: 'side_a', side: 1 }],
  ...over,
});

describe('EventStore', () => {
  it('upserts by (source, record): unchanged rows are skipped, changes bump rev and keep history', () => {
    expect(events.upsertEvents([war()])).toEqual({ inserted: 1, changed: 0, unchanged: 0 });
    expect(events.upsertEvents([war({ datasetId: 2 })])).toEqual({ inserted: 0, changed: 0, unchanged: 1 });
    expect(events.upsertEvents([war({ entities: [{ entityId: 8, role: 'side_a', side: 1 }] })])).toEqual({ inserted: 0, changed: 1, unchanged: 0 });
    const id = events.eventId(1, 'w1')!;
    expect(history.prepare('SELECT rev, canonical_id FROM ev_event WHERE event_id = ?').get(id)).toEqual({ rev: 2, canonical_id: id });
    expect(history.prepare('SELECT count(*) FROM ev_event_history').pluck().get()).toBe(1);
    expect(events.event(id)!.entities).toEqual([{ entityId: 8, role: 'side_a', side: 1, spell: 1, tLo: null, tHi: null, attrs: {} }]);
  });

  it('expands stated times by precision and keeps ongoing open', () => {
    events.upsertEvents([war({ tStart: Date.UTC(1917, 4, 1), tStartPrec: Prec.month, tEnd: null, tEndPrec: null }), war({ sourceRecordId: 'w2', ongoing: true })]);
    const rows = history.prepare('SELECT source_record_id AS k, t_lo, t_hi FROM ev_event ORDER BY k').all();
    expect(rows).toEqual([
      { k: 'w1', t_lo: Date.UTC(1917, 4, 1), t_hi: Date.UTC(1917, 5, 1) },
      { k: 'w2', t_lo: Date.UTC(1914, 6, 28), t_hi: OPEN_HI },
    ]);
  });

  it('finds candidates by box, time window, source and canonical, and hides retracted rows', () => {
    events.upsertEvents([
      war(),
      war({ sourceRecordId: 'far', lon: 120, lat: 10 }),
      war({ sourceRecordId: 'late', tStart: Y(1950), tStartPrec: Prec.year, tEnd: null }),
      war({ sourceRecordId: 'other', sourceId: 2 }),
      war({ sourceRecordId: 'dup', sourceId: 3 }),
    ]);
    events.relate(events.eventId(3, 'dup')!, 'same_as', events.eventId(1, 'w1')!);
    events.resolveCanonical([1, 3]);
    const q = { bbox: { w: 0, s: 40, e: 20, n: 60 }, tLo: Y(1916), tHi: Y(1917), sourceIds: new Set([1, 3]) };
    expect(events.candidates(q).map(c => c.id)).toEqual([events.eventId(1, 'w1')]);
    expect(events.retractMissing(1, new Set(['far', 'late']))).toBe(1);
    expect(events.candidates(q)).toEqual([]);
    expect(events.upsertEvents([war()])).toMatchObject({ changed: 1 });
    expect(events.candidates(q)).toHaveLength(1);
    expect(events.retract(1, ['w1', 'missing'])).toBe(1);
    expect(events.retract(1, ['w1'])).toBe(0);
    expect(events.retract(2, ['far'])).toBe(0);
    expect(events.candidates(q)).toEqual([]);
    expect(events.candidates({ ...q, bbox: { w: 100, s: 0, e: 130, n: 20 } })).toHaveLength(1);
  });

  it('draws a story told in several languages once, in the reader\'s language, else the base one', () => {
    const EN = 10;
    const TR = 11;
    const DE = 12;
    const row = (sourceId: number, sourceRecordId: string) => war({ sourceId, sourceRecordId, title: sourceRecordId });
    events.upsertEvents([
      row(1, 'war'), row(EN, 'en-a'), row(TR, 'tr-a'), row(EN, 'en-b'), row(TR, 'tr-c'), row(DE, 'de-d'),
      row(DE, 'de-e'), row(TR, 'tr-e'), row(TR, 'tr-g'), row(TR, 'tr-f'),
    ]);
    const twin = (a: [number, string], b: [number, string]) => events.relate(events.eventId(...a)!, 'same_as', events.eventId(...b)!);
    twin([TR, 'tr-a'], [EN, 'en-a']);
    twin([TR, 'tr-e'], [DE, 'de-e']);
    twin([TR, 'tr-f'], [TR, 'tr-g']);
    events.resolveCanonical([EN, DE, TR]);
    const q = { bbox: { w: 0, s: 40, e: 20, n: 60 }, tLo: Y(1916), tHi: Y(1917), sourceIds: new Set([1, EN, TR, DE]) };
    const titles = (languages?: { sources: number[]; base: number; prefer: number | null }) =>
      events.candidates({ ...q, languages }).map(c => c.title).sort();

    expect(titles()).toEqual(['de-d', 'de-e', 'en-a', 'en-b', 'tr-c', 'tr-g', 'war']);
    expect(titles({ sources: [EN, TR, DE], base: EN, prefer: TR })).toEqual(['en-b', 'tr-a', 'tr-c', 'tr-e', 'tr-g', 'war']);
    expect(titles({ sources: [EN, TR, DE], base: EN, prefer: null })).toEqual(['en-a', 'en-b', 'war']);
  });

  it('links children to parents loaded earlier and refuses unknown parents', () => {
    events.upsertEvents([war({ sourceRecordId: 'claim' })]);
    events.upsertEvents([war({ sourceRecordId: 'dyad', parentRecordId: 'claim' })]);
    expect(events.event(events.eventId(1, 'dyad')!)!.parentId).toBe(events.eventId(1, 'claim'));
    expect(() => events.upsertEvents([war({ sourceRecordId: 'x', parentRecordId: 'missing' })])).toThrow(/not loaded/);
  });

  it('bins the timeline per family', () => {
    events.upsertEvents([war(), war({ sourceRecordId: 'w2', tStart: Date.UTC(1916, 1, 1) }), war({ sourceRecordId: 't', kind: 'attack.terror' })]);
    events.rebuildTimeline(['conflict', 'terror']);
    expect(events.timeline(['conflict'], 'year', Y(1900), Y(2000), new Set([1]))).toEqual([
      { layer: 'conflict', sourceId: 1, unit: 'year', bin: Y(1914), n: 1, magSum: 100 },
      { layer: 'conflict', sourceId: 1, unit: 'year', bin: Y(1916), n: 1, magSum: 100 },
    ]);
  });
});

describe('SeriesStore', () => {
  it('replaces a series on rewrite and gates points by source', () => {
    const s = new SqliteSeriesStore(history);
    const m = s.ensureMetric({ code: 'x:pop', name: 'Population', granularity: 'year' });
    const id = s.writeSeries({ metricId: m, subjectType: 'entity', subjectId: 5, sourceId: 1, datasetId: 1, points: [{ t: Y(2000), v: 1 }, { t: Y(2001), v: 2 }] });
    s.writeSeries({ metricId: m, subjectType: 'entity', subjectId: 5, sourceId: 1, datasetId: 2, points: [{ t: Y(2001), v: 3 }] });
    s.writeSeries({ metricId: m, subjectType: 'entity', subjectId: 6, sourceId: 2, datasetId: 2, points: [{ t: Y(2001), v: 9 }] });
    expect(s.points('x:pop', new Set([1])).map(p => [p.seriesId, p.v])).toEqual([[id, 3]]);
    expect(s.dropMissing(2, new Set())).toBe(1);
    expect(s.points('x:pop', new Set([1, 2]))).toHaveLength(1);
  });
});

describe('geometry', () => {
  const square: Geometry = { type: 'Polygon', coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]] };

  it('round-trips WKB and parses WKT', () => {
    const multi = fromWkt('MULTIPOLYGON (((0 0, 1 0, 1 1, 0 0)), ((5 5, 6 5, 6 6, 5 5), (5.2 5.1, 5.5 5.1, 5.5 5.4, 5.2 5.1)))');
    expect(fromWkb(toWkb(multi))).toEqual(multi);
    expect(fromWkb(toWkb({ type: 'Point', coordinates: [1.5, -2] }))).toEqual({ type: 'Point', coordinates: [1.5, -2] });
  });

  it('subdivides into pieces of at most the vertex limit', () => {
    const ring = Array.from({ length: 2000 }, (_, i) => [Math.cos((i / 2000) * 2 * Math.PI) * 10, Math.sin((i / 2000) * 2 * Math.PI) * 10] as [number, number]);
    const pieces = subdivide({ type: 'Polygon', coordinates: [[...ring, ring[0]]] }, 256);
    expect(pieces.length).toBeGreaterThan(4);
    for (const p of pieces) expect(vertexCount(p)).toBeLessThanOrEqual(256 + 8);
    expect(subdivide(square)).toEqual([square]);
  });

  it('keeps a box per vanished island, not one across the sea between them', () => {
    const isle = (x: number, y: number): [number, number][][] => [[[x, y], [x + 0.1, y], [x + 0.1, y + 0.1], [x, y + 0.1], [x, y]]];
    const islands: Geometry = { type: 'MultiPolygon', coordinates: [isle(-24, 15), isle(44, -12)] };
    expect(simplify(islands, 1)).toBeNull();
    expect(simplify(islands, 1, true)).toEqual(islands);
    expect(simplify({ type: 'Polygon', coordinates: isle(5, 5) }, 1, true)).toEqual({ type: 'Polygon', coordinates: isle(5, 5) });
  });
});

describe('geo layers', () => {
  it('publishes a layer file and serves pieces by band, box and validity', () => {
    const layout = dataLayout(dir);
    const catalog = openWriter(layout.catalog, 'catalog');
    const w = GeoLayerWriter.open(layout, catalog, { code: 'lakes', sourceId: 7, geomKind: 'polygon', timeMode: 'valid', tileProps: ['name'] });
    const ring = Array.from({ length: 600 }, (_, i) => [20 + Math.cos((i / 600) * 2 * Math.PI), 40 + Math.sin((i / 600) * 2 * Math.PI)] as [number, number]);
    w.add({ sourceRecordId: 'old', props: { name: 'Old' }, geom: { type: 'Polygon', coordinates: [[...ring, ring[0]]] } });
    w.add({ sourceRecordId: 'dam', validLo: Y(1960), props: { name: 'Dam' }, geom: { type: 'Point', coordinates: [21, 41] } });
    expect(w.publish()).toMatchObject({ code: 'lakes', version: 1, features: 2 });
    const layer = geoLayers(catalog)[0];
    expect(layer).toMatchObject({ code: 'lakes', file: 'geo/lakes@1.db', version: 1 });
    const fs = SqliteFeatureStore.open(layout, layer)!;
    const box = { w: 15, s: 35, e: 25, n: 45 };
    const low = fs.pieces({ bbox: box, z: 1, tLo: Y(1950), tHi: Y(1951) });
    expect(low.map(p => p.props.name)).toEqual(['Old']);
    expect(vertexCount(fromWkb(low[0].geom))).toBeLessThan(600);
    const high = fs.pieces({ bbox: box, z: 12, tLo: Y(1970), tHi: Y(1971) });
    expect(new Set(high.map(p => p.props.name))).toEqual(new Set(['Old', 'Dam']));
    expect(high.filter(p => p.props.name === 'Old').length).toBeGreaterThan(1);
    expect(fs.pieces({ bbox: { w: 100, s: 0, e: 110, n: 10 }, z: 12 })).toEqual([]);
    fs.close();
    catalog.close();
  });
});
