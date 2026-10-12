import { FOREVER_LO } from '@takip/core/time';
import type { Ctx } from './context';
import { normName } from './names';

type Interval = { lo: number; hi: number | null; entityId: number };

const covers = (i: Interval, t: number) => i.lo <= t && (i.hi === null || i.hi > t);

/** The scheme catalog.db stores importer keys in: polity keys (DEU, hist:SUN) and region groups (region:world). */
export const KEY_SCHEME = 'takip';

/**
 * Polities, region groups and organisations, held in memory for one import run.
 * resolve(scheme, value, t) is §6's resolver; names go through core_entity_name with validity.
 */
export class Resolver {
  private ids = new Map<string, Map<string, Interval[]>>();
  private names = new Map<string, Interval[]>();
  private points = new Map<number, { lon: number; lat: number }>();
  private regions = new Set<number>();
  private schemeIds = new Map<string, number>();
  private typeIds = new Map<string, number>();

  constructor(private readonly ctx: Ctx) {
    this.reload();
  }

  reload() {
    const db = this.ctx.catalog;
    this.ids.clear();
    this.names.clear();
    this.points.clear();
    for (const r of db.prepare(`SELECT scheme_id AS id, code FROM core_id_scheme`).all() as { id: number; code: string }[]) this.schemeIds.set(r.code, r.id);
    for (const r of db.prepare(`SELECT type_id AS id, code FROM core_entity_type`).all() as { id: number; code: string }[]) this.typeIds.set(r.code, r.id);
    // Moving things and cameras are the worker's; importers only resolve the identity types below.
    const rows = db.prepare(`
      SELECT s.code AS scheme, i.value, i.valid_lo AS lo, i.valid_hi AS hi, i.entity_id AS entityId
      FROM core_entity_identifier i JOIN core_id_scheme s USING (scheme_id) JOIN core_entity e USING (entity_id)
      JOIN core_entity_type t ON t.type_id = e.type_id
      WHERE t.code IN ('polity', 'region_group', 'org', 'instrument', 'heritage_site', 'waterbody')
    `).all() as ({ scheme: string; value: string } & Interval)[];
    for (const r of rows) this.addId(r.scheme, r.value, { lo: r.lo, hi: r.hi, entityId: r.entityId });
    const names = db.prepare(`
      SELECT n.norm, n.valid_lo AS lo, n.valid_hi AS hi, n.entity_id AS entityId, t.code = 'region_group' AS region
      FROM core_entity_name n JOIN core_entity e USING (entity_id) JOIN core_entity_type t ON t.type_id = e.type_id
      WHERE t.code IN ('polity', 'region_group') ORDER BY n.kind = 'alias'
    `).all() as ({ norm: string; region: number } & Interval)[];
    this.regions.clear();
    for (const n of names) {
      if (n.region) this.regions.add(n.entityId);
      const list = this.names.get(n.norm) ?? [];
      list.push({ lo: n.lo, hi: n.hi, entityId: n.entityId });
      this.names.set(n.norm, list);
    }
    for (const p of db.prepare(`SELECT entity_id AS id, lon, lat FROM core_entity WHERE lon IS NOT NULL AND lat IS NOT NULL`).all() as {
      id: number;
      lon: number;
      lat: number;
    }[])
      this.points.set(p.id, { lon: p.lon, lat: p.lat });
  }

  private addId(scheme: string, value: string, i: Interval) {
    let m = this.ids.get(scheme);
    if (!m) this.ids.set(scheme, (m = new Map()));
    const list = m.get(value) ?? [];
    list.push(i);
    m.set(value, list);
  }

  schemeId(code: string) {
    const id = this.schemeIds.get(code);
    if (id === undefined) throw new Error(`unknown id scheme ${code}`);
    return id;
  }

  typeId(code: string) {
    const id = this.typeIds.get(code);
    if (id === undefined) throw new Error(`unknown entity type ${code}`);
    return id;
  }

  resolve(scheme: string, value: string | null | undefined, t: number): number | undefined {
    if (!value) return undefined;
    const list = this.ids.get(scheme)?.get(value);
    return list?.find(i => covers(i, t))?.entityId;
  }

  /** The first scheme that knows the value at `t`. */
  resolveAny(pairs: [scheme: string, value: string | null | undefined][], t: number) {
    for (const [s, v] of pairs) {
      const id = this.resolve(s, v, t);
      if (id !== undefined) return id;
    }
    return undefined;
  }

  key(key: string, t = 0) {
    return this.resolve(KEY_SCHEME, key, t);
  }

  /**
   * By any name or alias valid at `t`. The narrowest covering validity wins, so a dated alias ("Russia" until 1917)
   * beats a timeless official name; a name only ever used for one entity still resolves outside its validity.
   */
  byName(name: string | null | undefined, t: number, opts: { politiesOnly?: boolean } = {}): number | undefined {
    if (!name) return undefined;
    let list = this.names.get(normName(name));
    // Region groups appear as other datasets load (OWID's "Africa"), so free-text scans must not see them.
    if (list && opts.politiesOnly) list = list.filter(i => !this.regions.has(i.entityId));
    if (!list?.length) return undefined;
    const span = (i: Interval) => (i.hi ?? Infinity) - i.lo;
    const best = list.filter(i => covers(i, t)).sort((a, b) => span(a) - span(b))[0];
    return (best ?? (new Set(list.map(i => i.entityId)).size === 1 ? list[0] : undefined))?.entityId;
  }

  point(entityId: number | undefined) {
    return entityId === undefined ? undefined : this.points.get(entityId);
  }

  /** Midpoint of several entities' anchors, for events that only name their parties. */
  midpoint(entityIds: (number | undefined)[]) {
    const pts = entityIds.map(id => this.point(id)).filter((p): p is { lon: number; lat: number } => !!p);
    if (!pts.length) return undefined;
    // Averaging longitudes across the antimeridian would land mid-ocean; keep the first point's side.
    const ref = pts[0].lon;
    const lon = pts.reduce((s, p) => s + (Math.abs(p.lon - ref) > 180 ? p.lon - Math.sign(p.lon - ref) * 360 : p.lon), 0) / pts.length;
    return { lon: ((lon + 540) % 360) - 180, lat: pts.reduce((s, p) => s + p.lat, 0) / pts.length };
  }

  /**
   * Writes identifiers for entities resolved some other way (by name, by a fallback scheme), so the next
   * run and other datasets resolve them directly. Validity is open: these are a source's own codes.
   */
  remember(scheme: string, value: string, entityId: number, sourceId: number) {
    if (this.ids.get(scheme)?.has(value)) return;
    this.ctx.catalog.prepare(`
      INSERT INTO core_entity_identifier (scheme_id, value, entity_id, source_id) VALUES (?, ?, ?, ?)
      ON CONFLICT (scheme_id, value, valid_lo) DO NOTHING
    `).run(this.schemeId(scheme), value, entityId, sourceId);
    this.addId(scheme, value, { lo: FOREVER_LO, hi: null, entityId });
  }

  /**
   * An entity found by its own scheme value, created when missing (region groups, organisations, instruments).
   * Not for polities: those come only from the seed, so a typo can't mint a country.
   */
  ensure(type: 'region_group' | 'org' | 'instrument' | 'heritage_site' | 'waterbody', scheme: string, value: string, name: string, sourceId: number, at?: { lon: number; lat: number; attrs?: Record<string, unknown> }) {
    const found = this.resolve(scheme, value, 0);
    if (found !== undefined) return found;
    const db = this.ctx.catalog;
    const id = db.prepare(`INSERT INTO core_entity (type_id, name, lon, lat, attrs, updated_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING entity_id`)
      .pluck()
      .get(this.typeId(type), name, at?.lon ?? null, at?.lat ?? null, JSON.stringify(at?.attrs ?? {}), Date.now()) as number;
    db.prepare(`INSERT INTO core_entity_identifier (scheme_id, value, entity_id, source_id) VALUES (?, ?, ?, ?)`).run(this.schemeId(scheme), value, id, sourceId);
    db.prepare(`INSERT INTO core_entity_name (entity_id, name, norm, kind, source_id) VALUES (?, ?, ?, 'official', ?)`).run(id, name, normName(name), sourceId);
    this.addId(scheme, value, { lo: FOREVER_LO, hi: null, entityId: id });
    if (type === 'region_group') {
      this.regions.add(id);
      const list = this.names.get(normName(name)) ?? [];
      list.push({ lo: FOREVER_LO, hi: null, entityId: id });
      this.names.set(normName(name), list);
    }
    if (at) this.points.set(id, { lon: at.lon, lat: at.lat });
    return id;
  }

  /** A region group by key (region:world) and display name; aliases point other spellings at it. */
  region(key: string, name: string, sourceId: number) {
    return this.ensure('region_group', KEY_SCHEME, `region:${key}`, name, sourceId);
  }
}
