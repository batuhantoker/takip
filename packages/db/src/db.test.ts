import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { decodeChunk, decodeTrk1, encodeTrk1 } from '@takip/core/trk';
import { TrackClass } from '@takip/core/tracks';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { dataLayout } from './layout';
import { openWriter } from './open';
import { MIGRATIONS, type FileKind } from './schema';
import { SqliteCatalogStore } from './sqlite/catalog-store';
import { SqliteTrackStore } from './sqlite/track-store';
import type { SegmentRow } from './stores';

const H = Date.parse('2026-10-12T13:00:00Z');
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'db-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('migrations', () => {
  it.each(Object.keys(MIGRATIONS) as FileKind[])('creates %s and is idempotent', kind => {
    const path = join(dir, `${kind}.db`);
    openWriter(path, kind).close();
    const db = openWriter(path, kind);
    expect(db.pragma('user_version', { simple: true })).toBe(MIGRATIONS[kind].length);
    expect(db.pragma('journal_mode', { simple: true })).toBe('wal');
    expect(db.pragma('page_size', { simple: true })).toBe(kind === 'catalog' || kind === 'history' || kind === 'cache' ? 4096 : 16384);
    db.close();
  });

  it('records revisions of events and survives updates that keep rev', () => {
    const db = openWriter(':memory:', 'history');
    db.exec(`INSERT INTO ev_kind (kind_id, code, family) VALUES (1, 'hazard.quake', 'hazard')`);
    db.prepare(`INSERT INTO ev_event (kind_id, source_id, source_record_id, t_start, t_start_prec, t_lo, t_hi, x0, y0, x1, y1, ingested_at, updated_at)
      VALUES (1, 1, 'us7000', ?, 9, ?, ?, 1, 2, 1, 2, ?, ?)`).run(H, H, H, H, H);
    db.exec(`UPDATE ev_event SET canonical_id = event_id`);
    db.exec(`UPDATE ev_event SET canonical_id = event_id`);
    db.exec(`UPDATE ev_event SET title = 'M5', rev = rev + 1, x0 = 3, x1 = 3`);
    expect(db.prepare(`SELECT event_id, rev FROM ev_event_history`).all()).toEqual([{ event_id: 1, rev: 1 }]);
    expect(db.prepare(`SELECT min_x FROM ev_event_rtree`).get()).toEqual({ min_x: 3 });
    db.close();
  });

  it('finds names by trigram without diacritics', () => {
    const db = openWriter(':memory:', 'catalog');
    db.exec(`INSERT INTO core_entity (entity_id, type_id, updated_at) VALUES (1, 6, 0)`);
    db.exec(`INSERT INTO core_entity_name (entity_id, name, norm) VALUES (1, 'Çeşme Marina', 'cesme marina')`);
    expect(db.prepare(`SELECT rowid FROM core_entity_name_fts WHERE core_entity_name_fts MATCH 'cesme'`).all()).toHaveLength(1);
    // Dotless ı is a letter, not a diacritic: matching it needs the TS-normalised norm column.
    db.exec(`INSERT INTO core_entity_name (entity_id, name, norm) VALUES (1, 'Limanı', 'limani')`);
    expect(db.prepare(`SELECT rowid FROM core_entity_name_fts WHERE core_entity_name_fts MATCH 'limani'`).all()).toHaveLength(0);
    db.close();
  });
});

describe('SqliteCatalogStore', () => {
  const store = () => new SqliteCatalogStore(openWriter(':memory:', 'catalog'), () => H);

  it('seeds sources with track bits and every tier allowed to view them for now', () => {
    const s = store();
    expect(s.source('opensky')).toMatchObject({ trackBit: 1, attribution: expect.stringContaining('OpenSky') });
    const anon = s.policy('anon');
    expect(anon.trackMask).toBe(0b11111);
    expect(s.source('adsblol')).toMatchObject({ trackBit: 3, attribution: 'adsb.lol, ODbL 1.0' });
    expect(anon.hash).toMatch(/^[0-9a-f]{12}$/);
  });

  it('narrows the policy when a licence is turned off for a tier', () => {
    const s = store();
    s.db.exec(`UPDATE meta_access_policy SET can_view = 0 WHERE tier = 'anon' AND licence_id = (SELECT licence_id FROM meta_source WHERE code = 'opensky')`);
    expect(s.policy('anon').trackMask).toBe(0b11101);
    expect(s.policy('anon').hash).not.toBe(s.policy('paid').hash);
  });

  it('creates an entity once per identifier and resolves it at a time', () => {
    const s = store();
    const first = s.ensureIdentities('vessel', 'mmsi', 1, [{ value: '271000001', first: H, last: H + 60_000, name: 'KOCAELI' }]);
    const again = s.ensureIdentities('vessel', 'mmsi', 1, [{ value: '271000001', first: H + 3_600_000, last: H + 3_660_000 }]);
    expect(again.get('271000001')).toBe(first.get('271000001'));
    expect(s.resolve('mmsi', '271000001', H + 10)).toBe(first.get('271000001'));
    expect(s.resolve('mmsi', '271000001', H - 10)).toBeUndefined();
    const row = s.db.prepare(`SELECT name, first_seen, last_seen FROM core_entity`).get();
    expect(row).toEqual({ name: 'KOCAELI', first_seen: H, last_seen: H + 3_660_000 });
  });

  it('extends an identifier back in time instead of creating an overlapping one', () => {
    const s = store();
    const id = s.ensureIdentities('aircraft', 'icao24', 2, [{ value: '4b1805', first: H, last: H }]).get('4b1805');
    expect(s.ensureIdentities('aircraft', 'icao24', 2, [{ value: '4b1805', first: H - 7_200_000, last: H - 7_100_000 }]).get('4b1805')).toBe(id);
    expect(s.db.prepare(`SELECT valid_lo FROM core_entity_identifier`).all()).toEqual([{ valid_lo: H - 7_200_000 }]);
    // A fresh store reloads the cache from disk and agrees.
    expect(new SqliteCatalogStore(s.db).resolve('icao24', '4b1805', H - 3_600_000)).toBe(id);
  });

  it('keeps coverage intervals non-overlapping and merges equal neighbours', () => {
    const s = store();
    const hour = 3_600_000;
    s.setCoverage(2, H, H + hour, 'ok');
    s.setCoverage(2, H + hour, H + 2 * hour, 'ok');
    s.setCoverage(2, H + 2 * hour, H + 3 * hour, 'down');
    s.setCoverage(2, H + 3 * hour, H + 4 * hour, 'ok');
    expect(s.coverage(H, H + 4 * hour)).toEqual([
      { source: 'opensky', tLo: H, tHi: H + 2 * hour, status: 'ok' },
      { source: 'opensky', tLo: H + 2 * hour, tHi: H + 3 * hour, status: 'down' },
      { source: 'opensky', tLo: H + 3 * hour, tHi: H + 4 * hour, status: 'ok' },
    ]);
    // A rebuild that finds the outage hour was fine after all heals it into one interval.
    s.setCoverage(2, H + 2 * hour, H + 3 * hour, 'ok');
    expect(s.coverage(H, H + 4 * hour)).toEqual([{ source: 'opensky', tLo: H, tHi: H + 4 * hour, status: 'ok' }]);
    s.setCoverage(2, H + hour, H + 2 * hour, 'degraded');
    expect(s.coverage(H, H + 4 * hour).map(c => c.status)).toEqual(['ok', 'degraded', 'ok']);
  });

  it('queues dirty buckets until they are sealed', () => {
    const s = store();
    s.markDirty(0, [H + 3_600_000, H], 'backfill');
    expect(s.dirtyBuckets(0, 10)).toEqual([H, H + 3_600_000]);
    s.markSealed(
      { lod: 0, bucket: H, segments: 0, points: 0, buildVersion: 1, sealedAt: H },
      { path: 'tracks/l0/2026/10/12.db', kind: 'tracks', lod: 0, tLo: H, tHi: H + 86_400_000, status: 'open', rows: 0, bytes: 0 },
      [],
    );
    expect(s.dirtyBuckets(0, 10)).toEqual([H + 3_600_000]);
    expect(s.source('adsblol-history')).toMatchObject({ delivery: 'bulk', trackBit: 4 });
    expect(s.source('usgs')).toMatchObject({ delivery: 'poll', trackBit: null, record: true, build: true });
  });

  it('publishes a sealed bucket with its shard and bumps layer versions', () => {
    const s = store();
    const bucket = { lod: 0 as const, bucket: H, segments: 2, points: 10, buildVersion: 1, sealedAt: H + 7_500_000 };
    const shard = { path: 'tracks/l0/2026/10/12.db', kind: 'tracks' as const, lod: 0, tLo: H, tHi: H + 86_400_000, status: 'open' as const, rows: 2, bytes: 100 };
    s.markSealed(bucket, shard, ['tracks:vessel']);
    s.markSealed({ ...bucket, buildVersion: 2 }, shard, ['tracks:vessel']);
    expect(s.sealedBucket(0, H)?.buildVersion).toBe(2);
    expect(s.sealedBuckets(0, H, H + 3_600_000)).toHaveLength(1);
    expect(s.layerVersions()).toEqual({ 'tracks:vessel': 2 });
  });
});

describe('SqliteTrackStore', () => {
  const seg = (entityId: number, lon: number, lat: number, sourceMask = 1, part = 0): SegmentRow => {
    const points = encodeTrk1([{ t: H / 1000 + 60, lon, lat }, { t: H / 1000 + 120, lon: lon + 0.01, lat }]);
    return {
      entityId, part, cls: TrackClass.vessel, category: 1, label: `V${entityId}`, sourceMask,
      tFirst: H + 60_000, tLast: H + 120_000, n: 2, points, flags: 0,
      bbox: { w: lon, s: lat, e: lon + 0.01, n: lat },
    };
  };

  it('seals a bucket and serves it by tile, licence mask and class', () => {
    const layout = dataLayout(dir);
    const writer = new SqliteTrackStore(layout, 'write');
    writer.sealBucket(0, H, [seg(1, 29.0, 41.0), seg(2, 29.1, 41.05, 0b10), seg(3, -70, 40)], 1);
    // Resealing replaces the bucket rather than adding to it.
    const { path } = writer.sealBucket(0, H, [seg(1, 29.0, 41.0), seg(2, 29.1, 41.05, 0b10), seg(3, -70, 40), seg(3, -70.5, 40, 1, 1)], 2);
    expect(path).toBe(join(dir, 'db/tracks/l0/2026/10/12.db'));
    writer.close();

    const reader = new SqliteTrackStore(layout, 'read');
    const bbox = { w: 28, s: 40, e: 30, n: 42 };
    const all = decodeChunk(reader.chunk({ cls: TrackClass.vessel, lod: 0, bucket: H, bbox, allowedMask: 0b11 }));
    expect(all.bucket).toBe(H / 1000);
    expect(all.records.map(r => r.entity)).toEqual([1, 2]);
    expect(decodeTrk1(all.records[0].blob).lon[0]).toBe(29);

    const anonOnly = decodeChunk(reader.chunk({ cls: TrackClass.vessel, lod: 0, bucket: H, bbox, allowedMask: 0b01 }));
    expect(anonOnly.records.map(r => r.entity)).toEqual([1]);
    expect(decodeChunk(reader.chunk({ cls: TrackClass.aircraft, lod: 0, bucket: H, bbox, allowedMask: 0b11 })).records).toEqual([]);
    expect(decodeChunk(reader.chunk({ cls: TrackClass.vessel, lod: 0, bucket: H + 3_600_000, bbox, allowedMask: 0b11 })).records).toEqual([]);
    expect(reader.segments(0, H).filter(s => s.entityId === 3).map(s => s.part)).toEqual([0, 1]);
    reader.close();
  });

  it('returns an empty chunk before any shard exists', () => {
    const reader = new SqliteTrackStore(dataLayout(dir), 'read');
    expect(decodeChunk(reader.chunk({ cls: 1, lod: 2, bucket: H, bbox: { w: -180, s: -90, e: 180, n: 90 }, allowedMask: 1 })).records).toEqual([]);
  });

  it('answers the newest element set per object within 30 days, else the oldest one after', () => {
    const store = new SqliteTrackStore(dataLayout(dir), 'write');
    const tle = (noradId: number, epoch: number) => ({ noradId, epoch, line1: `1 ${noradId} ${epoch}`, line2: '2', name: null, sourceId: 4, fetchedAt: epoch });
    const day = 86_400_000;
    expect(store.insertTles([
      tle(25544, H - day), tle(25544, H - 3_600_000), tle(25544, H + 3_600_000), tle(20580, H - 40 * day),
      tle(43013, H + 3 * day), tle(43013, H + 2 * day), tle(48274, H + 40 * day),
    ])).toBe(7);
    expect(store.insertTles([tle(25544, H - 3_600_000)])).toBe(0);
    expect(store.tleAt(H).map(r => [r.noradId, r.epoch])).toEqual([[25544, H - 3_600_000], [43013, H + 2 * day]]);
    store.close();
  });
});
