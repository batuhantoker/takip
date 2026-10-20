// The History indicators table for place pages: for every country, each indicator's yearly series as History holds
// it, with its projection and range kept apart, the older run before it, and the facts its copy needs. Writes
// data/site/topics/indicators.json, keyed by GeoNames id (src/lib/platform/site/places/topics/indicators-data.ts).
//
//   nice npx tsx tools/site/topics/indicators.ts
//
// Reads data/db/history.db and catalog.db read-only, the gazetteer for the countries and their GeoNames ids, and
// public/data/boundaries/countries.json for each country's shape on History's map. A year is the UTC calendar year of
// a point's time (never SQLite's strftime, which breaks before year 0). Projections join as History joins them
// (lib/history/projection.ts): a country's estimates stop where its own projections start. Nothing is carried
// forward or filled in: a year with no value is null.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import Database from 'better-sqlite3';
import { PointFlag } from '@takip/db';
import type { TopicTable } from '../../../src/lib/platform/site/places/tables';
import {
  INDICATORS, type IndicatorFacts, type IndicatorMeta, type IndicatorMetricMeta, type IndicatorRow, type IndicatorSeries, type IndicatorSpec, type SeriesRef, type Yearly,
} from '../../../src/lib/platform/site/places/topics/indicators-data';

const OUT = 'data/site/topics/indicators.json';
const SIGNIFICANT = 4;
/** A metric's rank year is the latest in which at least this share of the countries it covers have a value. */
const RANK_SHARE = 0.5;

/** Year → value. */
export type Points = Map<number, number>;

const yearOf = (t: number) => new Date(t).getUTCFullYear();

/** Four significant digits: enough for a chart and a sentence, a third of the bytes. */
export function sig(v: number): number {
  if (!Number.isFinite(v) || v === 0) return 0;
  return Number(v.toPrecision(SIGNIFICANT));
}

/** The points from `from` up to (not including) `before`, as a Yearly; null when none are left. */
export function toYearly(points: Points | undefined, from = -Infinity, before = Infinity): Yearly | null {
  if (!points) return null;
  const years = [...points.keys()].filter(y => y >= from && y < before).sort((a, b) => a - b);
  if (!years.length) return null;
  const first = years[0];
  const values: (number | null)[] = new Array(years[years.length - 1] - first + 1).fill(null);
  for (const y of years) values[y - first] = sig(points.get(y)!);
  return [first, values];
}

/** [year, value] for each value a Yearly holds. */
export function yearlyPoints([from, values]: Yearly): [number, number][] {
  return values.flatMap((v, i) => (v === null ? [] : [[from + i, v] as [number, number]]));
}

export const yearlyAt = ([from, values]: Yearly, year: number): number | null => values[year - from] ?? null;

/** First, last, highest and lowest; the earliest year wins a tie for highest or lowest. */
export function seriesFacts(e: Yearly): Omit<IndicatorFacts, 'rank' | 'world' | 'proj' | 'before'> {
  const pts = yearlyPoints(e);
  let max = pts[0];
  let min = pts[0];
  for (const p of pts) {
    if (p[1] > max[1]) max = p;
    if (p[1] < min[1]) min = p;
  }
  return { n: pts.length, first: pts[0], last: pts[pts.length - 1], max, min };
}

/** The latest year in which at least RANK_SHARE of the series have a value. */
export function rankYear(series: Yearly[]): number | undefined {
  const counts = new Map<number, number>();
  for (const s of series) for (const [y] of yearlyPoints(s)) counts.set(y, (counts.get(y) ?? 0) + 1);
  const need = Math.max(1, Math.ceil(series.length * RANK_SHARE));
  return [...counts].filter(([, n]) => n >= need).map(([y]) => y).sort((a, b) => b - a)[0];
}

/** Each key's place among those with a value in `year`, highest first; equal values share the better place and say how many share it. */
export function ranks(series: Map<string, Yearly>, year: number): Map<string, NonNullable<IndicatorFacts['rank']>> {
  const valued = [...series].flatMap(([k, s]) => {
    const v = yearlyAt(s, year);
    return v === null ? [] : [{ k, v }];
  }).sort((a, b) => b.v - a.v);
  const out = new Map<string, NonNullable<IndicatorFacts['rank']>>();
  for (const { k, v } of valued) {
    const tied = valued.filter(x => x.v === v).length;
    out.set(k, tied > 1 ? [valued.findIndex(x => x.v === v) + 1, valued.length, tied] : [valued.findIndex(x => x.v === v) + 1, valued.length]);
  }
  return out;
}

/** The years of `e` whose points the source flags as its estimate, and as highly uncertain (SIPRI's blue and red). */
export function markedYears(e: Yearly, flags: Map<number, number> | undefined): { est?: number[]; unc?: number[] } {
  if (!flags) return {};
  const years = yearlyPoints(e).map(([y]) => y);
  const est = years.filter(y => (flags.get(y) ?? 0) & PointFlag.estimated);
  const unc = years.filter(y => (flags.get(y) ?? 0) & PointFlag.footnoted);
  return { ...(est.length && { est }), ...(unc.length && { unc }) };
}

/** The last projected year with its value, and its range where both ends exist. */
export function projectionEnd(p: Yearly, lo?: Yearly, hi?: Yearly): IndicatorFacts['proj'] {
  const pts = yearlyPoints(p);
  const [year, v] = pts[pts.length - 1];
  const l = lo && yearlyAt(lo, year);
  const h = hi && yearlyAt(hi, year);
  return l != null && h != null ? [year, v, l, h] : [year, v];
}

/**
 * One country's series for one indicator: `main` up to where its projection starts, the projection and its range,
 * the model's run, and the older run up to where `main` begins (or from its `since`, charted apart, for `longRun`).
 */
export function buildSeries(spec: IndicatorSpec, get: (ref: SeriesRef, suffix?: string) => Points | undefined): IndicatorSeries | null {
  const base = spec.model ?? spec.main;
  const proj = spec.projection ? get(base, '.proj') : undefined;
  const start = proj?.size ? Math.min(...proj.keys()) : Infinity;
  const e = toYearly(get(spec.main), -Infinity, spec.model ? Infinity : start);
  if (!e) return null;
  const out: IndicatorSeries = { e, f: seriesFacts(e) };
  const m = spec.model && toYearly(get(spec.model), -Infinity, start);
  if (m) out.m = m;
  const p = toYearly(proj);
  if (p) {
    out.p = p;
    const lo = toYearly(get(base, '.proj.lo'));
    const hi = toYearly(get(base, '.proj.hi'));
    if (lo && hi) Object.assign(out, { lo, hi });
    out.f.proj = projectionEnd(p, out.lo, out.hi);
  }
  const l = spec.earlier ? toYearly(get(spec.earlier), spec.earlier.since, e[0]) : spec.longRun ? toYearly(get(spec.longRun), spec.longRun.since) : null;
  if (l) {
    out.l = l;
    out.f.before = yearlyPoints(l)[0];
  }
  return out;
}

interface Country { id: number; cc: string; entity: number; key?: string }

function loadCountries(catalog: Database.Database): Country[] {
  const gazetteer = JSON.parse(readFileSync('data/site/gazetteer.json', 'utf8')) as { places: { id: number; kind: string; cc: string }[] };
  const entities = new Map((catalog.prepare(`
    SELECT i.value AS cc, i.entity_id AS id FROM core_entity_identifier i JOIN core_entity e USING (entity_id)
    WHERE i.scheme_id = 12 AND i.valid_hi IS NULL AND e.type_id = (SELECT type_id FROM core_entity_type WHERE code = 'polity')
  `).all() as { cc: string; id: number }[]).map(r => [r.cc, r.id]));
  // ADM0_A3, not always ISO3 (SDS, KOS, PSX); Australia's iso2 is also on two territories, so its own shape wins.
  const shapes = new Map<string, string>();
  for (const f of (JSON.parse(readFileSync('public/data/boundaries/countries.json', 'utf8')) as { features: { properties: { id: string; iso2?: string; iso3?: string } }[] }).features) {
    const { id, iso2, iso3 } = f.properties;
    if (iso2 && (!shapes.has(iso2) || iso3 === id)) shapes.set(iso2, id);
  }
  return gazetteer.places.filter(p => p.kind === 'country' && entities.has(p.cc))
    .map(p => ({ id: p.id, cc: p.cc, entity: entities.get(p.cc)!, key: shapes.get(p.cc) }));
}

function main() {
  const catalog = new Database('data/db/catalog.db', { readonly: true, fileMustExist: true });
  const db = new Database('data/db/history.db', { readonly: true, fileMustExist: true });
  const countries = loadCountries(catalog);
  const world = catalog.prepare(`
    SELECT entity_id FROM core_entity WHERE name = 'World' AND type_id = (SELECT type_id FROM core_entity_type WHERE code = 'region_group')
  `).pluck().get() as number | undefined;
  const sources = new Map((catalog.prepare(`SELECT s.code, s.source_id AS id, s.name, l.code AS licence FROM meta_source s JOIN meta_licence l USING (licence_id)`).all() as
    { code: string; id: number; name: string; licence: string }[]).map(s => [s.code, s]));
  catalog.close();

  const points = db.prepare(`
    SELECT s.subject_id AS e, p.t, p.v, p.flags FROM ts_metric m JOIN ts_series s USING (metric_id) JOIN ts_point p USING (series_id)
    WHERE m.code = ? AND s.source_id = ? AND s.subject_type = 'entity' AND p.v IS NOT NULL
  `);
  const cache = new Map<string, Map<number, Points>>();
  /** Non-zero point flags, by series key, entity and year. */
  const flagged = new Map<string, Map<number, Map<number, number>>>();
  const load = (code: string, source: string) => {
    const key = `${code}|${source}`;
    let byEntity = cache.get(key);
    if (byEntity) return byEntity;
    const src = sources.get(source);
    if (!src) throw new Error(`no source ${source} in catalog.db`);
    byEntity = new Map();
    const flags = new Map<number, Map<number, number>>();
    for (const r of points.iterate(code, src.id) as Iterable<{ e: number; t: number; v: number; flags: number }>) {
      let m = byEntity.get(r.e);
      if (!m) byEntity.set(r.e, (m = new Map()));
      m.set(yearOf(r.t), r.v);
      if (r.flags) {
        let f = flags.get(r.e);
        if (!f) flags.set(r.e, (f = new Map()));
        f.set(yearOf(r.t), r.flags);
      }
    }
    cache.set(key, byEntity);
    flagged.set(key, flags);
    return byEntity;
  };

  const year = new Date().getUTCFullYear();
  const rows: Record<string, IndicatorRow> = Object.fromEntries(countries.map(c => [c.id, { cc: c.cc, ...(c.key && { key: c.key }), m: {} }]));
  const metrics: Record<string, IndicatorMetricMeta> = {};
  for (const spec of INDICATORS) {
    cache.clear();
    const seriesOf = (entity: number) => buildSeries(spec, (ref, suffix = '') => load(`${ref.code}${suffix}`, ref.source).get(entity));
    const built = new Map<string, IndicatorSeries>();
    for (const c of countries) {
      const s = seriesOf(c.entity);
      if (!s) continue;
      if (spec.marks) Object.assign(s, markedYears(s.e, flagged.get(`${spec.main.code}|${spec.main.source}`)?.get(c.entity)));
      built.set(String(c.id), s);
    }
    const w = world === undefined ? null : seriesOf(world);
    const src = sources.get(spec.main.source)!;
    const meta: IndicatorMetricMeta = { source: src.name, licence: src.licence };
    // A World of zeros (net migration) compares with nothing.
    if (w && yearlyPoints(w.e).some(([, v]) => v !== 0)) meta.world = { e: w.e, ...(w.p && { p: w.p }), ...(w.m && { m: w.m }) };
    const ry = spec.modelled ? undefined : rankYear([...built.values()].map(s => s.e));
    const placed = ry === undefined ? new Map() : ranks(new Map([...built].map(([k, s]) => [k, s.e])), ry);
    if (ry !== undefined) Object.assign(meta, { rankYear: ry, ranked: [...placed.values()][0]?.[1] ?? 0 });
    for (const [id, s] of built) {
      const r = placed.get(id);
      if (r) s.f.rank = r;
      const wv = meta.world && yearlyAt(meta.world.e, s.f.last[0]);
      if (wv != null) s.f.world = wv;
      rows[id].m[spec.slug] = s;
    }
    metrics[spec.slug] = meta;
    console.log(`${spec.slug}: ${built.size} countries${w ? ', World' : ''}${ry ? `, ranked in ${ry} (${meta.ranked})` : ''}`);
  }
  db.close();

  for (const [id, row] of Object.entries(rows)) if (!Object.keys(row.m).length) delete rows[id];
  const table: TopicTable<IndicatorRow, IndicatorMeta> = { generated: new Date().toISOString().slice(0, 10), meta: { year, metrics }, rows };
  const json = `${JSON.stringify(table)}\n`;
  writeFileSync(OUT, json);
  console.log(`wrote ${Object.keys(rows).length} countries, ${(json.length / 1024 / 1024).toFixed(2)} MB to ${OUT}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
