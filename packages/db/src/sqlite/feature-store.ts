import { existsSync, renameSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { FOREVER_LO, OPEN_HI } from '@takip/core/time';
import { bandTolerance, simplify, subdivide, ZBANDS, zband } from '../geo/generalize';
import { toWkb, bboxOf, vertexCount } from '../geo/geometry';
import type { FeatureInput, FeatureStore, GeoLayerSpec, LayerRow, PieceQuery, PieceRow, PublishedLayer } from '../geo-stores';
import type { DataLayout } from '../layout';
import { type Db, openReader, openWriter } from '../open';

const LAST_BAND = ZBANDS[ZBANDS.length - 1].zb;

/**
 * Builds geo/<code>@<v>.db next to its final name, then publishes by rename and registers it in catalog.db
 * (geo_layer, meta_shard, meta_layer_version). Readers holding the previous version keep it until they reopen.
 */
export class GeoLayerWriter {
  readonly db: Db;
  private features = 0;
  private pieces = 0;
  private readonly insFeature;
  private readonly insGen;
  private readonly insBox;

  private constructor(
    private readonly catalog: Db,
    private readonly spec: GeoLayerSpec,
    readonly version: number,
    readonly path: string,
    private readonly tmp: string,
  ) {
    rmSync(tmp, { force: true });
    rmSync(`${tmp}-wal`, { force: true });
    rmSync(`${tmp}-shm`, { force: true });
    this.db = openWriter(tmp, 'geo');
    this.db.pragma('synchronous = OFF');
    this.insFeature = this.db.prepare(`
      INSERT INTO feature (entity_id, source_record_id, valid_lo, valid_hi, t_prec, tier, props, geom)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING feature_id
    `).pluck();
    this.insGen = this.db.prepare(`INSERT INTO feature_gen (feature_id, zband, part, geom) VALUES (?, ?, ?, ?) RETURNING gen_id`).pluck();
    this.insBox = this.db.prepare(`INSERT INTO gen_rtree VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  }

  static open(layout: DataLayout, catalog: Db, spec: GeoLayerSpec) {
    const current = catalog.prepare(`SELECT version FROM geo_layer WHERE code = ?`).pluck().get(spec.code) as number | undefined;
    const version = (current ?? 0) + 1;
    const path = join(layout.dbDir, 'geo', `${spec.code}@${version}.db`);
    return new GeoLayerWriter(catalog, spec, version, path, `${path}.building`);
  }

  /** Writes the feature and its pieces for every band; bands where nothing changed share one piece set. */
  add(f: FeatureInput) {
    const lo = f.validLo ?? FOREVER_LO;
    const hi = f.validHi ?? null;
    let id = 0;
    this.db.transaction(() => {
      id = this.insFeature.get(f.entityId ?? null, f.sourceRecordId ?? null, lo, hi, f.tPrec ?? 0, f.tier ?? 0, JSON.stringify(f.props ?? {}), toWkb(f.geom)) as number;
      const full = vertexCount(f.geom);
      for (const { zb } of ZBANDS) {
        const g = simplify(f.geom, bandTolerance(zb), this.spec.keepSmall);
        if (!g) continue;
        const shared = zb === LAST_BAND || vertexCount(g) === full;
        subdivide(g).forEach((piece, part) => {
          const b = bboxOf(piece);
          const genId = this.insGen.get(id, zb, part, toWkb(piece)) as number;
          this.insBox.run(genId, b.w, b.e, b.s, b.n, lo, hi ?? OPEN_HI, zb, shared ? LAST_BAND : zb);
          this.pieces++;
        });
        if (shared) break;
      }
    })();
    this.features++;
    return id;
  }

  publish(): PublishedLayer {
    const meta = this.db.prepare(`INSERT OR REPLACE INTO layer_meta (key, value) VALUES (?, ?)`);
    const now = Date.now();
    for (const [k, v] of Object.entries({
      code: this.spec.code,
      version: String(this.version),
      source_id: String(this.spec.sourceId),
      geom_kind: this.spec.geomKind,
      time_mode: this.spec.timeMode,
      tile_props: JSON.stringify(this.spec.tileProps),
      zbands: JSON.stringify(ZBANDS),
      built_at: new Date(now).toISOString(),
    }))
      meta.run(k, v);
    this.db.pragma('wal_checkpoint(TRUNCATE)');
    this.db.exec('ANALYZE');
    this.db.close();
    renameSync(this.tmp, this.path);
    rmSync(`${this.tmp}-wal`, { force: true });
    rmSync(`${this.tmp}-shm`, { force: true });
    const bytes = statSync(this.path).size;
    const file = `geo/${this.spec.code}@${this.version}.db`;
    const s = this.spec;
    this.catalog.transaction(() => {
      this.catalog.prepare(`UPDATE meta_shard SET status = 'superseded' WHERE kind = 'geo' AND layer = ? AND path <> ?`).run(s.code, file);
      this.catalog.prepare(`
        INSERT INTO meta_shard (path, kind, layer, status, rows, bytes, sealed_at) VALUES (?, 'geo', ?, 'sealed', ?, ?, ?)
        ON CONFLICT (path) DO UPDATE SET status = 'sealed', rows = excluded.rows, bytes = excluded.bytes, sealed_at = excluded.sealed_at
      `).run(file, s.code, this.features, bytes, now);
      this.catalog.prepare(`
        INSERT INTO geo_layer (code, source_id, file, version, geom_kind, minzoom, maxzoom, time_mode, tile_props, style)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (code) DO UPDATE SET source_id = excluded.source_id, file = excluded.file, version = excluded.version,
          geom_kind = excluded.geom_kind, minzoom = excluded.minzoom, maxzoom = excluded.maxzoom, time_mode = excluded.time_mode,
          tile_props = excluded.tile_props, style = excluded.style
      `).run(s.code, s.sourceId, file, this.version, s.geomKind, s.minzoom ?? 0, s.maxzoom ?? 14, s.timeMode, JSON.stringify(s.tileProps), JSON.stringify(s.style ?? {}));
      this.catalog.prepare(`
        INSERT INTO meta_layer_version (layer, version, changed_at) VALUES (?, ?, ?)
        ON CONFLICT (layer) DO UPDATE SET version = excluded.version, changed_at = excluded.changed_at
      `).run(`geo:${s.code}`, this.version, now);
    })();
    return { code: s.code, version: this.version, path: this.path, features: this.features, pieces: this.pieces, bytes };
  }

  abort() {
    this.db.close();
    for (const f of [this.tmp, `${this.tmp}-wal`, `${this.tmp}-shm`]) rmSync(f, { force: true });
  }
}

export function geoLayers(catalog: Db): LayerRow[] {
  const rows = catalog.prepare(`
    SELECT code, source_id AS sourceId, file, version, geom_kind AS geomKind, minzoom, maxzoom, time_mode AS timeMode,
      tile_props AS tileProps, style FROM geo_layer ORDER BY code
  `).all() as (Omit<LayerRow, 'tileProps' | 'style'> & { tileProps: string; style: string })[];
  return rows.map(r => ({ ...r, tileProps: JSON.parse(r.tileProps), style: JSON.parse(r.style) }));
}

type RawPiece = Omit<PieceRow, 'props'> & { props: string };

/** Read side of one geo/<layer>@<v>.db. */
export class SqliteFeatureStore implements FeatureStore {
  private constructor(readonly db: Db) {}

  /** Opens the layer's current version, or undefined when it hasn't been built. */
  static open(layout: DataLayout, layer: Pick<LayerRow, 'file'>) {
    const path = join(layout.dbDir, layer.file);
    if (!existsSync(path)) return undefined;
    const db = openReader(path);
    return db && new SqliteFeatureStore(db);
  }

  pieces(q: PieceQuery): PieceRow[] {
    const rows = this.db.prepare(`
      SELECT g.gen_id AS genId, g.feature_id AS featureId, f.entity_id AS entityId, f.source_record_id AS sourceRecordId, g.part,
        f.valid_lo AS validLo, f.valid_hi AS validHi, f.t_prec AS tPrec, f.tier, f.props, g.geom
      FROM gen_rtree r JOIN feature_gen g ON g.gen_id = r.id JOIN feature f ON f.feature_id = g.feature_id
      WHERE r.min_x <= @e AND r.max_x >= @w AND r.min_y <= @n AND r.max_y >= @s AND r.min_zb <= @zb AND r.max_zb >= @zb
        AND r.min_t < @tHi AND r.max_t >= @tLo
        AND f.valid_lo < @tHi AND coalesce(f.valid_hi, 8640000000000000) > @tLo AND f.tier <= @maxTier
      ORDER BY f.tier, g.feature_id, g.part
      LIMIT @limit
    `).all({
      w: q.bbox.w,
      s: q.bbox.s,
      e: q.bbox.e,
      n: q.bbox.n,
      zb: zband(q.z),
      tLo: q.tLo ?? FOREVER_LO,
      tHi: q.tHi ?? OPEN_HI,
      maxTier: q.maxTier ?? 1e9,
      limit: q.limit ?? -1,
    }) as RawPiece[];
    return rows.map(r => ({ ...r, props: JSON.parse(r.props) }));
  }

  feature(featureId: number) {
    const r = this.db.prepare(`
      SELECT feature_id AS featureId, entity_id AS entityId, source_record_id AS sourceRecordId, valid_lo AS validLo,
        valid_hi AS validHi, t_prec AS tPrec, tier, props, geom FROM feature WHERE feature_id = ?
    `).get(featureId) as (Omit<RawPiece, 'genId' | 'part'>) | undefined;
    return r && { ...r, props: JSON.parse(r.props) };
  }

  meta() {
    const rows = this.db.prepare(`SELECT key, value FROM layer_meta`).all() as { key: string; value: string }[];
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
  }

  close() {
    this.db.close();
  }
}
