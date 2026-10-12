import { expand, OPEN_HI, Prec } from '@takip/core/time';
import type {
  EventCandidate,
  EventCandidateQuery,
  EventDetail,
  EventInput,
  EventKindInput,
  EventStore,
  TimelineBin,
  UpsertResult,
} from '../history-stores';
import type { Db } from '../open';
import { statements } from './statements';

const CANDIDATE_COLS = `
  e.event_id AS id, k.code AS kind, k.family, e.source_id AS sourceId, e.title,
  coalesce(e.lon, (e.x0 + e.x1) / 2) AS lon, coalesce(e.lat, (e.y0 + e.y1) / 2) AS lat,
  e.t_lo AS t0, e.t_hi AS t1, e.t_start AS tStart, e.t_end AS tEnd, e.t_start_prec AS prec, e.ongoing,
  e.geo_prec AS geoPrec, e.magnitude, e.severity, e.confidence, e.geom`;

type Existing = { event_id: number; sig: string; retracted_at: number | null };

const yearStart = (t: number, span: number) => {
  const d = new Date(0);
  d.setUTCFullYear(Math.floor(new Date(t).getUTCFullYear() / span) * span, 0, 1);
  return d.getTime();
};

/** history.db events. Kind and role ids are cached; one instance per process. */
export class SqliteEventStore implements EventStore {
  private kinds = new Map<string, { id: number; family: string }>();
  private roles = new Map<string, number>();

  private readonly sql: ReturnType<typeof statements>;

  constructor(readonly db: Db) {
    this.sql = statements(db);
    this.loadCodes();
  }

  private loadCodes() {
    for (const r of this.sql(`SELECT kind_id AS id, code, family FROM ev_kind`).all() as { id: number; code: string; family: string }[])
      this.kinds.set(r.code, { id: r.id, family: r.family });
    for (const r of this.sql(`SELECT role_id AS id, code FROM ev_role`).all() as { id: number; code: string }[]) this.roles.set(r.code, r.id);
  }

  ensureKinds(kinds: EventKindInput[]) {
    const upsert = this.sql(`
      INSERT INTO ev_kind (code, family, parent_id, style) VALUES (?, ?, (SELECT kind_id FROM ev_kind WHERE code = ?), ?)
      ON CONFLICT (code) DO UPDATE SET family = excluded.family, parent_id = excluded.parent_id, style = excluded.style
    `);
    this.db.transaction(() => {
      for (const k of kinds) upsert.run(k.code, k.family, k.parent ?? null, JSON.stringify(k.style ?? {}));
    })();
    this.loadCodes();
  }

  ensureRoles(codes: string[]) {
    const ins = this.sql(`INSERT INTO ev_role (code) VALUES (?) ON CONFLICT (code) DO NOTHING`);
    this.db.transaction(() => {
      for (const c of codes) ins.run(c);
    })();
    this.loadCodes();
  }

  family(kind: string) {
    const k = this.kinds.get(kind);
    if (!k) throw new Error(`unknown event kind: ${kind}`);
    return k.family;
  }

  private kindId(code: string) {
    const k = this.kinds.get(code);
    if (!k) throw new Error(`unknown event kind: ${code}`);
    return k.id;
  }

  private roleId(code: string) {
    const r = this.roles.get(code);
    if (r === undefined) throw new Error(`unknown event role: ${code}`);
    return r;
  }

  upsertEvents(rows: EventInput[], now = Date.now()): UpsertResult {
    const find = this.sql(`
      SELECT e.event_id, e.retracted_at, json_array(e.kind_id, e.dataset_id IS NULL, e.parent_id, e.title, e.t_start, e.t_end, e.t_start_prec,
        e.t_end_prec, e.ongoing, e.t_lo, e.t_hi, e.lon, e.lat, e.x0, e.y0, e.x1, e.y1, hex(e.geom), e.geo_prec, e.magnitude,
        e.severity, e.confidence, e.attrs,
        (SELECT json_group_array(json_array(entity_id, role_id, side, spell, t_lo, t_hi, attrs))
           FROM (SELECT * FROM ev_event_entity WHERE event_id = e.event_id ORDER BY entity_id, role_id, side, spell))) AS sig
      FROM ev_event e WHERE e.source_id = ? AND e.source_record_id = ?
    `);
    // Builds the same signature SQLite does above, from the input; the casts match the STRICT column types.
    const sigOf = this.sql(`
      SELECT json_array(CAST(@kind_id AS INTEGER), @dataset_id IS NULL, CAST(@parent_id AS INTEGER), @title, CAST(@t_start AS INTEGER),
        CAST(@t_end AS INTEGER), CAST(@t_start_prec AS INTEGER), CAST(@t_end_prec AS INTEGER), CAST(@ongoing AS INTEGER),
        CAST(@t_lo AS INTEGER), CAST(@t_hi AS INTEGER), CAST(@lon AS REAL), CAST(@lat AS REAL), CAST(@x0 AS REAL), CAST(@y0 AS REAL),
        CAST(@x1 AS REAL), CAST(@y1 AS REAL), hex(@geom), CAST(@geo_prec AS INTEGER), CAST(@magnitude AS REAL), CAST(@severity AS REAL),
        CAST(@confidence AS REAL), @attrs,
        (SELECT json_group_array(json_array(value ->> 0, value ->> 1, value ->> 2, value ->> 3, value ->> 4, value ->> 5, value ->> 6))
           FROM (SELECT value FROM json_each(@entities) ORDER BY value ->> 0, value ->> 1, value ->> 2, value ->> 3))) AS sig
    `).pluck();
    const insert = this.sql(`
      INSERT INTO ev_event (kind_id, source_id, dataset_id, source_record_id, parent_id, title, t_start, t_end, t_start_prec,
        t_end_prec, ongoing, t_lo, t_hi, lon, lat, x0, y0, x1, y1, geom, geo_prec, magnitude, severity, confidence, attrs,
        ingested_at, updated_at)
      VALUES (@kind_id, @source_id, @dataset_id, @source_record_id, @parent_id, @title, @t_start, @t_end, @t_start_prec,
        @t_end_prec, @ongoing, @t_lo, @t_hi, @lon, @lat, @x0, @y0, @x1, @y1, @geom, @geo_prec, @magnitude, @severity, @confidence,
        @attrs, @now, @now)
      RETURNING event_id
    `).pluck();
    const setCanonical = this.sql(`UPDATE ev_event SET canonical_id = event_id WHERE event_id = ?`);
    const update = this.sql(`
      UPDATE ev_event SET kind_id = @kind_id, dataset_id = @dataset_id, parent_id = @parent_id, title = @title,
        t_start = @t_start, t_end = @t_end, t_start_prec = @t_start_prec, t_end_prec = @t_end_prec, ongoing = @ongoing,
        t_lo = @t_lo, t_hi = @t_hi, lon = @lon, lat = @lat, x0 = @x0, y0 = @y0, x1 = @x1, y1 = @y1, geom = @geom,
        geo_prec = @geo_prec, magnitude = @magnitude, severity = @severity, confidence = @confidence, attrs = @attrs,
        rev = rev + 1, retracted_at = NULL, updated_at = @now
      WHERE event_id = @event_id
    `);
    const touch = this.sql(`UPDATE ev_event SET dataset_id = ? WHERE event_id = ? AND dataset_id IS NOT ?`);
    const clearEntities = this.sql(`DELETE FROM ev_event_entity WHERE event_id = ?`);
    const insertEntity = this.sql(`
      INSERT OR IGNORE INTO ev_event_entity (event_id, entity_id, role_id, side, spell, t_lo, t_hi, attrs) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result: UpsertResult = { inserted: 0, changed: 0, unchanged: 0 };
    this.db.transaction(() => {
      for (const r of rows) {
        const parentId = r.parentRecordId ? this.eventId(r.sourceId, r.parentRecordId) ?? null : null;
        if (r.parentRecordId && parentId === null) throw new Error(`parent ${r.parentRecordId} of ${r.sourceRecordId} is not loaded`);
        const span = expand(r.tStart, r.tStartPrec);
        const tHi = r.ongoing ? OPEN_HI : r.tEnd != null ? expand(r.tEnd, (r.tEndPrec ?? r.tStartPrec) as Prec).hi : span.hi;
        const bbox = r.bbox ?? (r.lon != null && r.lat != null ? { w: r.lon, s: r.lat, e: r.lon, n: r.lat } : null);
        // First row per primary key wins, as INSERT OR IGNORE would; the signature must see the same rows.
        const byKey = new Map<string, unknown[]>();
        for (const en of r.entities ?? []) {
          const row = [en.entityId, this.roleId(en.role), en.side ?? 0, en.spell ?? 1, en.tLo ?? null, en.tHi ?? null, JSON.stringify(en.attrs ?? {})];
          const key = row.slice(0, 4).join('|');
          if (!byKey.has(key)) byKey.set(key, row);
        }
        const entities = [...byKey.values()];
        const p = {
          kind_id: this.kindId(r.kind),
          source_id: r.sourceId,
          dataset_id: r.datasetId,
          source_record_id: r.sourceRecordId,
          parent_id: parentId,
          title: r.title,
          t_start: r.tStart,
          t_end: r.tEnd ?? null,
          t_start_prec: r.tStartPrec,
          t_end_prec: r.tEnd != null ? (r.tEndPrec ?? r.tStartPrec) : null,
          ongoing: r.ongoing ? 1 : 0,
          t_lo: span.lo,
          t_hi: Math.max(tHi, span.lo),
          lon: r.lon,
          lat: r.lat,
          x0: bbox?.w ?? null,
          y0: bbox?.s ?? null,
          x1: bbox?.e ?? null,
          y1: bbox?.n ?? null,
          geom: r.geom ?? null,
          geo_prec: r.geoPrec,
          magnitude: r.magnitude ?? null,
          severity: r.severity ?? null,
          confidence: r.confidence ?? 1,
          attrs: JSON.stringify(r.attrs ?? {}),
          now,
        };
        const existing = find.get(r.sourceId, r.sourceRecordId) as Existing | undefined;
        if (!existing) {
          const id = insert.get(p) as number;
          setCanonical.run(id);
          for (const en of entities) insertEntity.run(id, ...en);
          result.inserted++;
          continue;
        }
        const sig = sigOf.get({ ...p, entities: JSON.stringify(entities) }) as string;
        if (sig === existing.sig && existing.retracted_at === null) {
          touch.run(r.datasetId, existing.event_id, r.datasetId);
          result.unchanged++;
          continue;
        }
        update.run({ ...p, event_id: existing.event_id });
        clearEntities.run(existing.event_id);
        for (const en of entities) insertEntity.run(existing.event_id, ...en);
        result.changed++;
      }
    })();
    return result;
  }

  retractMissing(sourceId: number, keep: ReadonlySet<string>, now = Date.now()) {
    const rows = this.sql(`SELECT event_id AS id, source_record_id AS key FROM ev_event WHERE source_id = ? AND retracted_at IS NULL`)
      .all(sourceId) as { id: number; key: string }[];
    const retract = this.sql(`UPDATE ev_event SET retracted_at = ?, rev = rev + 1, updated_at = ? WHERE event_id = ?`);
    let n = 0;
    this.db.transaction(() => {
      for (const r of rows) if (!keep.has(r.key)) n += retract.run(now, now, r.id).changes;
    })();
    return n;
  }

  eventId(sourceId: number, sourceRecordId: string) {
    return this.sql(`SELECT event_id FROM ev_event WHERE source_id = ? AND source_record_id = ?`).pluck().get(sourceId, sourceRecordId) as
      | number
      | undefined;
  }

  relate(fromId: number, rel: 'part_of' | 'same_as' | 'follows' | 'related', toId: number, confidence = 1, sourceId?: number) {
    this.sql(`
      INSERT INTO ev_event_relation (from_id, rel, to_id, confidence, source_id) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT DO UPDATE SET confidence = excluded.confidence, source_id = excluded.source_id
    `).run(fromId, rel, toId, confidence, sourceId ?? null);
  }

  clearRelations(sourceId: number) {
    return this.sql(`DELETE FROM ev_event_relation WHERE source_id = ?`).run(sourceId).changes;
  }

  resolveCanonical(preference: readonly number[]) {
    const edges = this.sql(`SELECT from_id AS a, to_id AS b FROM ev_event_relation WHERE rel = 'same_as'`).all() as { a: number; b: number }[];
    const parent = new Map<number, number>();
    const find = (x: number): number => {
      let r = x;
      while (parent.has(r) && parent.get(r) !== r) r = parent.get(r)!;
      parent.set(x, r);
      return r;
    };
    for (const { a, b } of edges) {
      if (!parent.has(a)) parent.set(a, a);
      if (!parent.has(b)) parent.set(b, b);
      parent.set(find(a), find(b));
    }
    const members = [...parent.keys()];
    const sources = new Map<number, number>();
    const srcOf = this.sql(`SELECT source_id FROM ev_event WHERE event_id = ?`).pluck();
    for (const m of members) sources.set(m, srcOf.get(m) as number);
    const rank = (id: number) => {
      const i = preference.indexOf(sources.get(id)!);
      return i < 0 ? preference.length : i;
    };
    const rep = new Map<number, number>();
    for (const m of members) {
      const root = find(m);
      const cur = rep.get(root);
      if (cur === undefined || rank(m) < rank(cur) || (rank(m) === rank(cur) && m < cur)) rep.set(root, m);
    }
    const set = this.sql(`UPDATE ev_event SET canonical_id = ? WHERE event_id = ? AND canonical_id IS NOT ?`);
    let n = 0;
    this.db.transaction(() => {
      this.sql(`
        UPDATE ev_event SET canonical_id = event_id WHERE canonical_id IS NOT event_id
          AND event_id NOT IN (SELECT from_id FROM ev_event_relation WHERE rel = 'same_as' UNION SELECT to_id FROM ev_event_relation WHERE rel = 'same_as')
      `).run();
      for (const m of members) {
        const c = rep.get(find(m))!;
        n += set.run(c, m, c).changes;
      }
    })();
    return n;
  }

  rebuildTimeline(families: readonly string[]) {
    const rows = this.sql(`
      SELECT k.family AS layer, e.source_id AS sourceId, e.t_lo AS t, e.magnitude AS mag
      FROM ev_event e JOIN ev_kind k USING (kind_id)
      WHERE k.family IN (SELECT value FROM json_each(?)) AND e.retracted_at IS NULL AND e.event_id = e.canonical_id AND e.parent_id IS NULL
    `).all(JSON.stringify(families)) as { layer: string; sourceId: number; t: number; mag: number | null }[];
    const bins = new Map<string, TimelineBin>();
    for (const r of rows) {
      for (const [unit, span] of [['decade', 10], ['year', 1]] as const) {
        const bin = yearStart(r.t, span);
        const key = `${r.layer}|${unit}|${bin}|${r.sourceId}`;
        const b = bins.get(key) ?? { layer: r.layer, sourceId: r.sourceId, unit, bin, n: 0, magSum: null };
        b.n++;
        if (r.mag != null) b.magSum = (b.magSum ?? 0) + r.mag;
        bins.set(key, b);
      }
    }
    const del = this.sql(`DELETE FROM agg_timeline_bin WHERE layer = ?`);
    const ins = this.sql(`INSERT INTO agg_timeline_bin (layer, source_id, unit, bin, n, mag_sum) VALUES (?, ?, ?, ?, ?, ?)`);
    this.db.transaction(() => {
      for (const f of families) del.run(f);
      for (const b of bins.values()) ins.run(b.layer, b.sourceId, b.unit, b.bin, b.n, b.magSum);
    })();
  }

  candidates(q: EventCandidateQuery): EventCandidate[] {
    const { bbox } = q;
    return this.sql(`
      SELECT ${CANDIDATE_COLS}
      FROM ev_event_rtree r JOIN ev_event e ON e.event_id = r.id JOIN ev_kind k ON k.kind_id = e.kind_id
      WHERE r.min_x <= @e AND r.max_x >= @w AND r.min_y <= @n AND r.max_y >= @s AND r.min_t < @tHi AND r.max_t >= @tLo
        AND e.t_lo < @tHi AND e.t_hi > @tLo
        AND e.retracted_at IS NULL AND e.event_id = e.canonical_id
        AND e.source_id IN (SELECT value FROM json_each(@sources))
        AND (@families IS NULL OR k.family IN (SELECT value FROM json_each(@families)))
        AND (@kinds IS NULL OR k.code IN (SELECT value FROM json_each(@kinds)))
      ORDER BY e.magnitude DESC NULLS LAST, e.event_id
      LIMIT @limit
    `).all({
      w: bbox.w,
      s: bbox.s,
      e: bbox.e,
      n: bbox.n,
      tLo: q.tLo,
      tHi: q.tHi,
      sources: JSON.stringify([...q.sourceIds]),
      families: q.families ? JSON.stringify(q.families) : null,
      kinds: q.kinds ? JSON.stringify(q.kinds) : null,
      limit: q.limit ?? -1,
    }) as EventCandidate[];
  }

  event(id: number): EventDetail | undefined {
    const row = this.sql(`
      SELECT ${CANDIDATE_COLS}, e.source_record_id AS sourceRecordId, e.canonical_id AS canonicalId, e.parent_id AS parentId,
        e.t_end_prec AS endPrec, e.attrs
      FROM ev_event e JOIN ev_kind k USING (kind_id) WHERE e.event_id = ?
    `).get(id) as (Omit<EventDetail, 'attrs' | 'entities' | 'relations'> & { attrs: string }) | undefined;
    if (!row) return undefined;
    const entities = (this.sql(`
      SELECT x.entity_id AS entityId, r.code AS role, x.side, x.spell, x.t_lo AS tLo, x.t_hi AS tHi, x.attrs
      FROM ev_event_entity x JOIN ev_role r USING (role_id) WHERE x.event_id = ? ORDER BY r.code, x.side, x.entity_id
    `).all(id) as (EventDetail['entities'][number] & { attrs: string })[]).map(e => ({ ...e, attrs: JSON.parse(e.attrs) }));
    const relations = this.sql(`
      SELECT rel, to_id AS otherId, 'out' AS direction, confidence FROM ev_event_relation WHERE from_id = ?
      UNION ALL SELECT rel, from_id, 'in', confidence FROM ev_event_relation WHERE to_id = ?
    `).all(id, id) as EventDetail['relations'];
    return { ...row, attrs: JSON.parse(row.attrs), entities, relations };
  }

  timeline(layers: readonly string[], unit: TimelineBin['unit'], from: number, to: number, sourceIds: ReadonlySet<number>) {
    return this.sql(`
      SELECT layer, source_id AS sourceId, unit, bin, n, mag_sum AS magSum FROM agg_timeline_bin
      WHERE layer IN (SELECT value FROM json_each(?)) AND unit = ? AND bin >= ? AND bin < ?
        AND source_id IN (SELECT value FROM json_each(?))
      ORDER BY layer, bin
    `).all(JSON.stringify(layers), unit, from, to, JSON.stringify([...sourceIds])) as TimelineBin[];
  }
}
