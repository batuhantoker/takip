import { createHash } from 'node:crypto';
import type { Lod } from '@takip/core/tracks';
import type { Db } from '../open';
import type {
  CatalogStore,
  CoverageRow,
  CoverageStatus,
  IdentityItem,
  IngestRun,
  Policy,
  PolityKey,
  PolityRender,
  SealedBucket,
  ShardRow,
  SourceRow,
  Tier,
} from '../stores';

type Interval = { validLo: number; validHi: number | null; entityId: number };

const POLICY_TTL_MS = 60_000;

/** catalog.db. One instance per process; the writer's id cache assumes it is the only writer of identifiers. */
export class SqliteCatalogStore implements CatalogStore {
  private readonly ids = new Map<number, Map<string, Interval[]>>();
  private readonly policies = new Map<Tier, { policy: Policy; at: number }>();
  private readonly codeIds = new Map<string, number>();

  constructor(readonly db: Db, private readonly now: () => number = Date.now) {}

  sources(): SourceRow[] {
    type Raw = Omit<SourceRow, 'record' | 'build'> & { record: number; build: number };
    return (this.db.prepare(`
      SELECT s.source_id AS sourceId, s.code, s.name, s.licence_id AS licenceId, s.track_bit AS trackBit, l.attribution,
        s.delivery, s.record, s.build, s.switched_at AS switchedAt, s.switched_by AS switchedBy
      FROM meta_source s JOIN meta_licence l USING (licence_id) ORDER BY s.source_id
    `).all() as Raw[]).map(r => ({ ...r, record: r.record === 1, build: r.build === 1 }));
  }

  setSourceSwitches(code: string, { record, build }: { record?: boolean; build?: boolean }, by: string) {
    const { changes } = this.db.prepare(`
      UPDATE meta_source SET record = coalesce(?, record), build = coalesce(?, build), switched_at = ?, switched_by = ?
      WHERE code = ?
    `).run(record === undefined ? null : Number(record), build === undefined ? null : Number(build), this.now(), by, code);
    return changes > 0;
  }

  source(code: string) {
    return this.sources().find(s => s.code === code);
  }

  private codeId(table: 'core_id_scheme' | 'core_entity_type', code: string) {
    const key = `${table}:${code}`;
    let id = this.codeIds.get(key);
    if (id === undefined) {
      const idCol = table === 'core_id_scheme' ? 'scheme_id' : 'type_id';
      const row = this.db.prepare(`SELECT ${idCol} AS id FROM ${table} WHERE code = ?`).get(code) as { id: number } | undefined;
      if (!row) throw new Error(`unknown ${table} code: ${code}`);
      this.codeIds.set(key, (id = row.id));
    }
    return id;
  }

  /** The scheme's identifiers, loaded once and kept current by ensureIdentities (§6: the hot id cache). */
  private schemeIds(schemeId: number) {
    let map = this.ids.get(schemeId);
    if (!map) {
      map = new Map();
      const rows = this.db.prepare(`
        SELECT value, valid_lo AS validLo, valid_hi AS validHi, entity_id AS entityId
        FROM core_entity_identifier WHERE scheme_id = ? ORDER BY value, valid_lo
      `).all(schemeId) as (Interval & { value: string })[];
      for (const { value, ...interval } of rows) {
        const list = map.get(value);
        if (list) list.push(interval);
        else map.set(value, [interval]);
      }
      this.ids.set(schemeId, map);
    }
    return map;
  }

  resolve(scheme: string, value: string, at: number) {
    const list = this.schemeIds(this.codeId('core_id_scheme', scheme)).get(value);
    return list?.find(i => i.validLo <= at && (i.validHi === null || i.validHi > at))?.entityId;
  }

  ensureIdentities(type: string, scheme: string, sourceId: number, items: IdentityItem[]) {
    const schemeId = this.codeId('core_id_scheme', scheme);
    const typeId = this.codeId('core_entity_type', type);
    const cache = this.schemeIds(schemeId);
    const now = this.now();
    const out = new Map<string, number>();

    const insertEntity = this.db.prepare(`
      INSERT INTO core_entity (type_id, name, first_seen, last_seen, updated_at) VALUES (?, ?, ?, ?, ?) RETURNING entity_id AS id
    `);
    const insertId = this.db.prepare(`
      INSERT INTO core_entity_identifier (scheme_id, value, valid_lo, entity_id, source_id) VALUES (?, ?, ?, ?, ?)
    `);
    const lowerId = this.db.prepare(`
      UPDATE core_entity_identifier SET valid_lo = ? WHERE scheme_id = ? AND value = ? AND valid_lo = ?
    `);
    const seen = this.db.prepare(`
      UPDATE core_entity SET first_seen = min(coalesce(first_seen, @first), @first), last_seen = max(coalesce(last_seen, @last), @last),
        name = coalesce(name, @name), updated_at = @now
      WHERE entity_id = @entityId
    `);

    this.db.transaction(() => {
      for (const { value, first, last, name = null } of items) {
        const list = cache.get(value) ?? [];
        let entityId = list.find(i => i.validLo <= first && (i.validHi === null || i.validHi > first))?.entityId;
        if (entityId === undefined) {
          // Seen before its identifier starts (a rebuild of an older hour): extend it back rather than overlap it.
          // Nothing earlier covers `first`, or the lookup above would have found it.
          const later = list.find(i => i.validLo > first);
          if (later) {
            lowerId.run(first, schemeId, value, later.validLo);
            later.validLo = first;
            entityId = later.entityId;
          } else {
            entityId = (insertEntity.get(typeId, name, first, last, now) as { id: number }).id;
            insertId.run(schemeId, value, first, entityId, sourceId);
            list.push({ validLo: first, validHi: null, entityId });
            list.sort((a, b) => a.validLo - b.validLo);
            cache.set(value, list);
          }
        }
        seen.run({ first, last, name, now, entityId });
        out.set(value, entityId);
      }
    })();
    return out;
  }

  entityCategories(ids: number[]) {
    const rows = this.db.prepare(`
      SELECT entity_id AS id, attrs ->> '$.category' AS category FROM core_entity
      WHERE entity_id IN (SELECT value FROM json_each(?)) AND attrs ->> '$.category' IS NOT NULL
    `).all(JSON.stringify(ids)) as { id: number; category: string }[];
    return new Map(rows.map(r => [r.id, r.category]));
  }

  setEntityCategories(categories: Map<number, string>) {
    const update = this.db.prepare(`
      UPDATE core_entity SET attrs = json_set(attrs, '$.category', ?) WHERE entity_id = ? AND attrs ->> '$.category' IS NOT ?
    `);
    this.db.transaction(() => {
      for (const [id, category] of categories) update.run(category, id, category);
    })();
  }

  markSealed(row: SealedBucket, shard: ShardRow, layers: string[]) {
    this.db.transaction(() => {
      this.db.prepare(`
        INSERT INTO meta_shard (path, kind, lod, t_lo, t_hi, status, rows, bytes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (path) DO UPDATE SET rows = excluded.rows, bytes = excluded.bytes, status = excluded.status
      `).run(shard.path, shard.kind, shard.lod, shard.tLo, shard.tHi, shard.status, shard.rows, shard.bytes);
      this.db.prepare(`
        INSERT INTO trk_sealed_bucket (lod, bucket, segments, points, build_version, sealed_at) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT (lod, bucket) DO UPDATE SET segments = excluded.segments, points = excluded.points,
          build_version = excluded.build_version, sealed_at = excluded.sealed_at
      `).run(row.lod, row.bucket, row.segments, row.points, row.buildVersion, row.sealedAt);
      this.db.prepare(`DELETE FROM trk_dirty_bucket WHERE lod = ? AND bucket = ?`).run(row.lod, row.bucket);
      const bump = this.db.prepare(`
        INSERT INTO meta_layer_version (layer, version, changed_at) VALUES (?, 1, ?)
        ON CONFLICT (layer) DO UPDATE SET version = version + 1, changed_at = excluded.changed_at
      `);
      for (const layer of layers) bump.run(layer, row.sealedAt);
    })();
  }

  sealedBuckets(lod: Lod, from: number, to: number) {
    return this.db.prepare(`
      SELECT lod, bucket, segments, points, build_version AS buildVersion, sealed_at AS sealedAt
      FROM trk_sealed_bucket WHERE lod = ? AND bucket >= ? AND bucket < ? ORDER BY bucket
    `).all(lod, from, to) as SealedBucket[];
  }

  sealedBucket(lod: Lod, bucket: number) {
    return this.db.prepare(`
      SELECT lod, bucket, segments, points, build_version AS buildVersion, sealed_at AS sealedAt
      FROM trk_sealed_bucket WHERE lod = ? AND bucket = ?
    `).get(lod, bucket) as SealedBucket | undefined;
  }

  recordRun(run: IngestRun) {
    this.db.prepare(`
      INSERT INTO meta_ingest_run (source_id, started_at, finished_at, status, records, inserted, archive_ref, error)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(run.sourceId, run.startedAt, run.finishedAt, run.status, run.records, run.inserted, run.archiveRef, run.error ?? null);
  }

  hasRun(sourceId: number, archiveRef: string) {
    return Boolean(this.db.prepare(`SELECT 1 FROM meta_ingest_run WHERE source_id = ? AND archive_ref = ? AND status = 'ok'`).get(sourceId, archiveRef));
  }

  markDirty(lod: Lod, buckets: number[], reason: string) {
    const insert = this.db.prepare(`
      INSERT INTO trk_dirty_bucket (lod, bucket, reason, queued_at) VALUES (?, ?, ?, ?)
      ON CONFLICT (lod, bucket) DO UPDATE SET reason = excluded.reason, queued_at = excluded.queued_at
    `);
    this.db.transaction(() => {
      for (const bucket of buckets) insert.run(lod, bucket, reason, this.now());
    })();
  }

  dirtyBuckets(lod: Lod, limit: number) {
    return (this.db.prepare(`SELECT bucket FROM trk_dirty_bucket WHERE lod = ? ORDER BY bucket LIMIT ?`).all(lod, limit) as { bucket: number }[])
      .map(r => r.bucket);
  }

  /** Keeps a source's intervals non-overlapping: whatever [tLo, tHi) held is replaced, and equal neighbours merge. */
  setCoverage(sourceId: number, tLo: number, tHi: number, status: CoverageStatus) {
    type Row = { t_lo: number; t_hi: number | null; status: CoverageStatus; note: string | null };
    const del = this.db.prepare(`DELETE FROM meta_coverage WHERE source_id = ? AND t_lo = ?`);
    const ins = this.db.prepare(`INSERT INTO meta_coverage (source_id, t_lo, t_hi, status, note) VALUES (?, ?, ?, ?, ?)`);
    this.db.transaction(() => {
      const overlapping = this.db.prepare(`
        SELECT t_lo, t_hi, status, note FROM meta_coverage
        WHERE source_id = ? AND t_lo < ? AND coalesce(t_hi, 8640000000000000) > ?
      `).all(sourceId, tHi, tLo) as Row[];
      for (const r of overlapping) {
        del.run(sourceId, r.t_lo);
        if (r.t_lo < tLo) ins.run(sourceId, r.t_lo, tLo, r.status, r.note);
        if (r.t_hi === null || r.t_hi > tHi) ins.run(sourceId, tHi, r.t_hi, r.status, r.note);
      }
      let lo = tLo;
      let hi: number | null = tHi;
      const left = this.db.prepare(`SELECT t_lo FROM meta_coverage WHERE source_id = ? AND t_hi = ? AND status = ?`).get(sourceId, tLo, status) as { t_lo: number } | undefined;
      if (left) {
        del.run(sourceId, left.t_lo);
        lo = left.t_lo;
      }
      const right = this.db.prepare(`SELECT t_hi FROM meta_coverage WHERE source_id = ? AND t_lo = ? AND status = ?`).get(sourceId, tHi, status) as { t_hi: number | null } | undefined;
      if (right) {
        del.run(sourceId, tHi);
        hi = right.t_hi;
      }
      ins.run(sourceId, lo, hi, status, null);
    })();
  }

  coverage(from: number, to: number) {
    return this.db.prepare(`
      SELECT s.code AS source, c.t_lo AS tLo, c.t_hi AS tHi, c.status
      FROM meta_coverage c JOIN meta_source s USING (source_id)
      WHERE c.t_lo < ? AND coalesce(c.t_hi, 8640000000000000) > ? ORDER BY s.code, c.t_lo
    `).all(to, from) as CoverageRow[];
  }

  layerVersions() {
    const rows = this.db.prepare(`SELECT layer, version FROM meta_layer_version`).all() as { layer: string; version: number }[];
    return Object.fromEntries(rows.map(r => [r.layer, r.version]));
  }

  policy(tier: Tier): Policy {
    const cached = this.policies.get(tier);
    if (cached && this.now() - cached.at < POLICY_TTL_MS) return cached.policy;
    const rows = this.db.prepare(`
      SELECT s.source_id AS sourceId, s.track_bit AS trackBit
      FROM meta_source s JOIN meta_access_policy p ON p.licence_id = s.licence_id AND p.tier = ?
      WHERE p.can_view = 1 ORDER BY s.source_id
    `).all(tier) as { sourceId: number; trackBit: number | null }[];
    // Masks stay below 2^31 so the bitwise ops in JS and SQL agree; track_bit is checked to ≤ 62, so cap here.
    const trackMask = rows.reduce((m, r) => (r.trackBit !== null && r.trackBit < 31 ? m | (1 << r.trackBit) : m), 0);
    const ids = rows.map(r => r.sourceId);
    const policy: Policy = {
      tier,
      sourceIds: new Set(ids),
      trackMask,
      hash: createHash('sha256').update(ids.join(',')).digest('hex').slice(0, 12),
    };
    this.policies.set(tier, { policy, at: this.now() });
    return policy;
  }

  polityShapes() {
    const polities = this.db.prepare(`
      SELECT p.entity_id AS entityId, i.value AS key, e.name, p.kind
      FROM core_polity p JOIN core_entity e USING (entity_id)
      JOIN core_entity_identifier i ON i.entity_id = p.entity_id AND i.scheme_id = (SELECT scheme_id FROM core_id_scheme WHERE code = 'takip')
      ORDER BY i.value
    `).all() as PolityKey[];
    const render = this.db.prepare(`
      SELECT r.polity_id AS entityId, i.value AS renderKey, r.valid_lo AS validLo, r.valid_hi AS validHi
      FROM core_polity_render r
      JOIN core_entity_identifier i ON i.entity_id = r.render_polity_id AND i.scheme_id = (SELECT scheme_id FROM core_id_scheme WHERE code = 'takip')
      ORDER BY r.polity_id, i.value, r.valid_lo
    `).all() as PolityRender[];
    return { polities, render };
  }
}
