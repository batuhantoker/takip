/**
 * Running a checked query over the live data the page (or the server) holds: one or several layers,
 * scoped to a point, a named region or the view, filtered on typed fields, ranked, and honest about
 * coverage ("at least N" where the feed cannot see everything). Pure.
 */
import { FIND_LAYERS, SOURCES, entitiesOf, loaded, type Entity, type FindLayer } from '../catalog';
import { valueOf } from './fields';
import { inBounds, inPolygon, km, type Bounds, type Point } from './geo';
import { passes, type Filter } from './spec';

export type Scope =
  | { kind: 'anywhere' }
  | { kind: 'near'; centre: Point; radiusKm: number; name: string }
  | { kind: 'region'; name: string; geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon; centre?: Point }
  | { kind: 'view'; bounds: Bounds; centre?: Point };

export interface Query {
  layers: FindLayer[];
  /** Words that must all appear in the name, detail or id. */
  text?: string;
  filters?: Filter[];
  scope?: Scope;
  withinHours?: number;
  /** nearest, newest, oldest, largest, smallest, or a field name. */
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  limit?: number;
  /** A follow-up: only these `layer:id` keys from the earlier result. */
  among?: ReadonlySet<string>;
}

export type Hit = Entity & { km?: number };

export interface QueryResult {
  layers: FindLayer[];
  /** How many the layers hold, and how many matched. */
  total: number;
  matched: number;
  items: Hit[];
  /** Every match, as `layer:id`, for a follow-up. */
  keys: string[];
  /** False when a queried feed cannot see everything, so `matched` is a floor. */
  complete: boolean;
  caveats: string[];
  sortBy: string;
}

export const keyOf = (e: Pick<Entity, 'layer' | 'id'>) => `${e.layer}:${e.id}`;

const fold = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

function within(e: Entity, scope: Scope | undefined): boolean {
  if (!scope || scope.kind === 'anywhere') return true;
  if (e.lat === null || e.lng === null) return false;
  const p = { lat: e.lat, lng: e.lng };
  if (scope.kind === 'near') return km(scope.centre, p) <= scope.radiusKm;
  if (scope.kind === 'region') return inPolygon(p, scope.geometry);
  return inBounds(p, scope.bounds);
}

const centreOf = (s: Scope | undefined): Point | null => (!s || s.kind === 'anywhere' ? null : s.kind === 'near' ? s.centre : s.centre ?? null);

export function runQuery(data: Record<string, unknown>, q: Query, now = Date.now()): QueryResult {
  const words = q.text ? fold(q.text).split(/\s+/).filter(w => w.length > 1) : [];
  const centre = centreOf(q.scope);
  let total = 0;
  const hits: Hit[] = [];
  for (const layer of q.layers) {
    const all = entitiesOf(data, layer);
    total += all.length;
    for (const e of all) {
      if (q.among && !q.among.has(keyOf(e))) continue;
      if (words.length) {
        const hay = fold(`${e.title} ${e.detail} ${e.id}`);
        if (!words.every(w => hay.includes(w))) continue;
      }
      if (q.withinHours !== undefined && (e.time === null || now - e.time > q.withinHours * 3_600_000)) continue;
      if (!within(e, q.scope)) continue;
      const hit: Hit = centre && e.lat !== null && e.lng !== null ? { ...e, km: Math.round(km(centre, { lat: e.lat, lng: e.lng })) } : e;
      if (q.filters?.length && !q.filters.every(f => passes(valueOf(hit, f.field, now), f))) continue;
      hits.push(hit);
    }
  }

  const byValue = q.layers.every(l => SOURCES[l].value);
  const sortBy = q.sortBy ?? (q.scope?.kind === 'near' ? 'nearest' : byValue ? 'largest' : 'newest');
  const down = (a: number | null | undefined, b: number | null | undefined) => (b ?? -Infinity) - (a ?? -Infinity);
  if (sortBy === 'nearest') hits.sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity));
  else if (sortBy === 'newest') hits.sort((a, b) => down(a.time, b.time));
  else if (sortBy === 'oldest') hits.sort((a, b) => (a.time ?? Infinity) - (b.time ?? Infinity));
  else if (sortBy === 'largest') hits.sort((a, b) => down(a.value, b.value));
  else if (sortBy === 'smallest') hits.sort((a, b) => (a.value ?? Infinity) - (b.value ?? Infinity));
  else {
    const vals = new Map(hits.map(h => [h, valueOf(h, sortBy, now)]));
    const asc = q.sortDir ? q.sortDir === 'asc' : typeof hits.map(h => vals.get(h)).find(v => v !== null) === 'string';
    hits.sort((a, b) => {
      const x = vals.get(a), y = vals.get(b);
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
      return asc ? c : -c;
    });
  }
  if (q.sortDir && ['nearest', 'newest', 'oldest', 'largest', 'smallest'].includes(sortBy)) {
    const natural = sortBy === 'nearest' || sortBy === 'oldest' || sortBy === 'smallest' ? 'asc' : 'desc';
    if (q.sortDir !== natural) hits.reverse();
  }

  const caveats = [...new Set(q.layers.map(l => SOURCES[l].partial).filter((c): c is string => Boolean(c)))];
  return {
    layers: q.layers, total, matched: hits.length,
    items: hits.slice(0, Math.max(1, Math.min(25, q.limit ?? 10))),
    keys: hits.slice(0, 5000).map(keyOf),
    complete: caveats.length === 0, caveats, sortBy,
  };
}

/* ───────────── What is in view ───────────── */

export interface ScanRow { layer: FindLayer; count: number; top: Entity[] }

/** How much of each live layer is in view, the biggest (or newest) few of each, busiest layer first. */
export function scan(data: Record<string, unknown>, bounds: Bounds, layers: FindLayer[] = FIND_LAYERS): ScanRow[] {
  const rows: ScanRow[] = [];
  for (const layer of layers) {
    if (!loaded(data, layer)) continue;
    const inView = entitiesOf(data, layer).filter(e => e.lat !== null && e.lng !== null && inBounds({ lat: e.lat, lng: e.lng }, bounds));
    if (!inView.length) continue;
    const byValue = SOURCES[layer].value !== undefined;
    inView.sort((a, b) => (byValue ? (b.value ?? -Infinity) - (a.value ?? -Infinity) : (b.time ?? -Infinity) - (a.time ?? -Infinity)));
    rows.push({ layer, count: inView.length, top: inView.slice(0, 3) });
  }
  return rows.sort((a, b) => b.count - a.count);
}
