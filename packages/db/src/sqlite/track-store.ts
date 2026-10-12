import { existsSync } from 'node:fs';
import { LODS, type Lod, type TrackClass } from '@takip/core/tracks';
import { encodeChunk } from '@takip/core/trk';
import type Database from 'better-sqlite3';
import type { DataLayout } from '../layout';
import { type Db, openReader, openWriter } from '../open';
import type { FileKind } from '../schema';
import type { SegmentRow, TleRow, TrackChunkQuery, TrackStore } from '../stores';

/** Open handles by path, least recently used closed first. A missing file is not cached: it may appear later. */
class HandleCache {
  private readonly handles = new Map<string, Db>();
  private readonly statements = new WeakMap<Db, Map<string, Database.Statement>>();

  constructor(private readonly max: number) {}

  get(path: string, open: () => Db | undefined): Db | undefined {
    let db = this.handles.get(path);
    if (db) {
      this.handles.delete(path);
    } else {
      db = open();
      if (!db) return undefined;
      while (this.handles.size >= this.max) {
        const [oldest, handle] = this.handles.entries().next().value!;
        handle.close();
        this.handles.delete(oldest);
      }
    }
    this.handles.set(path, db);
    return db;
  }

  stmt(db: Db, sql: string) {
    let cache = this.statements.get(db);
    if (!cache) this.statements.set(db, (cache = new Map()));
    let s = cache.get(sql);
    if (!s) cache.set(sql, (s = db.prepare(sql)));
    return s;
  }

  closeAll() {
    for (const db of this.handles.values()) db.close();
    this.handles.clear();
  }
}

const CHUNK_SQL = `
  SELECT s.entity_id AS entity, s.part, s.class AS cls, s.category, s.label, s.points AS blob
  FROM trk_segment_rtree r JOIN trk_segment s ON s.segment_id = r.id
  WHERE r.min_x <= :e AND r.max_x >= :w AND r.min_y <= :n AND r.max_y >= :s
    AND r.min_t < :hi AND r.max_t >= :lo
    AND s.bucket = :bucket AND s.class = :cls AND (s.source_mask & ~:allowed) = 0
  ORDER BY s.entity_id, s.part`;

const SEGMENTS_SQL = `
  SELECT s.entity_id AS entityId, s.part, s.class AS cls, s.category, s.label, s.source_mask AS sourceMask,
    s.t_first AS tFirst, s.t_last AS tLast, s.n, s.points, s.flags,
    r.min_x AS w, r.min_y AS south, r.max_x AS e, r.max_y AS north
  FROM trk_segment s JOIN trk_segment_rtree r ON r.id = s.segment_id
  WHERE s.bucket = ? ORDER BY s.entity_id, s.part`;

// Ordered by the index on (entity_id, bucket, part), so a day's shard streams one entity at a time.
const SEGMENTS_BY_ENTITY_SQL = `
  SELECT s.entity_id AS entityId, s.part, s.class AS cls, s.category, s.label, s.source_mask AS sourceMask,
    s.t_first AS tFirst, s.t_last AS tLast, s.n, s.points, s.flags,
    r.min_x AS w, r.min_y AS south, r.max_x AS e, r.max_y AS north
  FROM trk_segment s JOIN trk_segment_rtree r ON r.id = s.segment_id
  WHERE s.bucket >= ? AND s.bucket < ? ORDER BY s.entity_id, s.bucket, s.part`;

// Newest set at or before t, else the oldest after it: SGP4 runs backwards too, so pre-recording times get orbits.
const TLE_AT_SQL = `
  SELECT norad_id AS noradId, epoch, line1, line2, name, source_id AS sourceId, fetched_at AS fetchedAt FROM (
    SELECT *, row_number() OVER (PARTITION BY norad_id ORDER BY epoch > ?, abs(epoch - ?)) AS rn
    FROM trk_tle WHERE epoch > ? AND epoch <= ?
  ) WHERE rn = 1 ORDER BY norad_id`;

const TLE_REACH_MS = 30 * 86_400_000;

/**
 * Track shards and tle.db. 'write' is the seal jobs' single writer (it reads through the same handles);
 * 'read' is the api, with read-only handles.
 */
export class SqliteTrackStore implements TrackStore {
  private readonly handles: HandleCache;

  constructor(private readonly layout: DataLayout, private readonly mode: 'read' | 'write') {
    this.handles = new HandleCache(mode === 'read' ? 64 : 8);
  }

  private open(path: string, kind: FileKind, create: boolean) {
    return this.handles.get(path, () => {
      if (this.mode === 'read') return openReader(path);
      return create || existsSync(path) ? openWriter(path, kind) : undefined;
    });
  }

  sealBucket(lod: Lod, bucket: number, segments: SegmentRow[], buildVersion: number) {
    const path = this.layout.trackShard(lod, bucket);
    if (this.mode !== 'write') throw new Error('read-only track store');
    const db = this.open(path, 'tracks', true)!;
    const h = this.handles;
    let rows = 0;
    db.transaction(() => {
      h.stmt(db, `DELETE FROM trk_segment_rtree WHERE id IN (SELECT segment_id FROM trk_segment WHERE bucket = ?)`).run(bucket);
      h.stmt(db, `DELETE FROM trk_segment WHERE bucket = ?`).run(bucket);
      const insert = h.stmt(db, `
        INSERT INTO trk_segment (bucket, entity_id, part, class, category, label, source_mask, t_first, t_last, n, points, flags, build_version)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      const box = h.stmt(db, `INSERT INTO trk_segment_rtree VALUES (?, ?, ?, ?, ?, ?, ?)`);
      for (const s of segments) {
        const { lastInsertRowid } = insert.run(
          bucket, s.entityId, s.part, s.cls, s.category, s.label, s.sourceMask, s.tFirst, s.tLast, s.n, s.points, s.flags, buildVersion,
        );
        box.run(lastInsertRowid, s.bbox.w, s.bbox.e, s.bbox.s, s.bbox.n, s.tFirst, s.tLast);
      }
      const meta = h.stmt(db, `INSERT INTO shard_meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value`);
      meta.run('lod', String(lod));
      meta.run('build_version', String(buildVersion));
      rows = (h.stmt(db, `SELECT count(*) AS n FROM trk_segment`).get() as { n: number }).n;
    })();
    // Sealing is batch work, off the live path: fold the WAL in now so the file size is real and the WAL stays small.
    db.pragma('wal_checkpoint(PASSIVE)');
    return { path, rows };
  }

  chunk({ cls, lod, bucket, bbox, allowedMask }: TrackChunkQuery) {
    const db = this.open(this.layout.trackShard(lod, bucket), 'tracks', false);
    const records = db
      ? (this.handles.stmt(db, CHUNK_SQL).all({
        ...bbox, lo: bucket, hi: bucket + LODS[lod].bucketMs, bucket, cls, allowed: allowedMask,
      }) as { entity: number; part: number; cls: number; category: number; label: string | null; blob: Uint8Array }[])
      : [];
    return encodeChunk({ bucket: bucket / 1000, lod, records: records.map(r => ({ ...r, label: r.label ?? '' })) });
  }

  segments(lod: Lod, bucket: number): SegmentRow[] {
    const db = this.open(this.layout.trackShard(lod, bucket), 'tracks', false);
    if (!db) return [];
    type Raw = Omit<SegmentRow, 'bbox' | 'cls'> & { cls: TrackClass; w: number; south: number; e: number; north: number };
    return (this.handles.stmt(db, SEGMENTS_SQL).all(bucket) as Raw[]).map(({ w, south, e, north, ...row }) => ({
      ...row,
      bbox: { w, s: south, e, n: north },
    }));
  }

  *segmentsByEntity(lod: Lod, from: number, to: number): Generator<SegmentRow[]> {
    const db = this.open(this.layout.trackShard(lod, from), 'tracks', false);
    if (!db) return;
    type Raw = Omit<SegmentRow, 'bbox' | 'cls'> & { cls: TrackClass; w: number; south: number; e: number; north: number };
    let group: SegmentRow[] = [];
    for (const { w, south, e, north, ...row } of this.handles.stmt(db, SEGMENTS_BY_ENTITY_SQL).iterate(from, to) as Iterable<Raw>) {
      if (group.length && group[0].entityId !== row.entityId) {
        yield group;
        group = [];
      }
      group.push({ ...row, bbox: { w, s: south, e, n: north } });
    }
    if (group.length) yield group;
  }

  insertTles(rows: TleRow[]) {
    const db = this.open(this.layout.tle, 'tle', true)!;
    const insert = this.handles.stmt(db, `
      INSERT INTO trk_tle (norad_id, epoch, line1, line2, name, source_id, fetched_at) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (norad_id, epoch) DO NOTHING`);
    let added = 0;
    db.transaction(() => {
      for (const r of rows) added += insert.run(r.noradId, r.epoch, r.line1, r.line2, r.name, r.sourceId, r.fetchedAt).changes;
    })();
    return added;
  }

  tleAt(t: number): TleRow[] {
    const db = this.open(this.layout.tle, 'tle', false);
    return db ? (this.handles.stmt(db, TLE_AT_SQL).all(t, t, t - TLE_REACH_MS, t + TLE_REACH_MS) as TleRow[]) : [];
  }

  close() {
    this.handles.closeAll();
  }
}
