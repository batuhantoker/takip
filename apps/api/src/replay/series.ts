import type { PolityKey, PolityRender, SeriesPointRow } from '@takip/db';
import { type Context, Hono } from 'hono';
import type { AccessEnv } from '../access/middleware';
import type { ReplayData } from './data';

/*
 * Country-year series for the replay choropleth (replay-database.md §8.6), as JSON until the binary form exists.
 * Values are keyed by today's shape (countries.json `id`); a historical polity's value is painted on each shape
 * it renders to, tagged with that polity's key. Like the rest of /history, gated by licence tier only.
 */

/** A metric covering fewer polities than this isn't worth a map (one-country FRED series). */
const MIN_SUBJECTS = 10;
const CATALOGUE_TTL_MS = 5 * 60_000;
const CACHE = { 'Cache-Control': 'private, max-age=300' };
const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * [calendar year, value] or, painted from a historical polity, [year, value, its key]. For a 'day' metric
 * the year is fractional: the point's date (2020.2 is mid-March 2020).
 */
export type ShapePoint = [number, number] | [number, number, string];

/** 'day' also carries weekly series (the schema has no week); 'month' and finer have no map yet. */
export type Step = 'year' | 'day';
const MAPPED = new Set<string>(['year', 'day']);

const notReady = (c: Context) =>
  c.json({ error: 'not_ready', message: 'No history yet: run `npm run import -- all`.' }, 503, { ...NO_STORE, 'Retry-After': '60' });

const yearOf = (ms: number) => new Date(ms).getUTCFullYear();
const round = (v: number) => Number(v.toPrecision(5));

/** Epoch ms → fractional calendar year, to about five minutes. */
export function fractionalYear(ms: number) {
  const year = yearOf(ms);
  const start = Date.UTC(year, 0, 1);
  return Number((year + (ms - start) / (Date.UTC(year + 1, 0, 1) - start)).toFixed(5));
}

/** A metric's first and last point as the series reports its years: calendar years, or fractional for a 'day' metric. */
export function yearsOf(first: number | null, last: number | null, step: Step): [number, number] | null {
  if (first === null || last === null) return null;
  return step === 'day' ? [fractionalYear(first), fractionalYear(last)] : [yearOf(first), yearOf(last)];
}

/** Points by shape key. A shape's own value wins over one painted from a historical polity at the same time. */
export function shapeSeries(rows: readonly SeriesPointRow[], polities: readonly PolityKey[], render: readonly PolityRender[], step: Step = 'year') {
  const keyOf = step === 'year' ? yearOf : (ms: number) => ms;
  const xOf = step === 'year' ? (year: number) => year : fractionalYear;
  const byEntity = new Map(polities.map(p => [p.entityId, p]));
  const renders = new Map<number, PolityRender[]>();
  for (const r of render) {
    const list = renders.get(r.entityId);
    if (list) list.push(r);
    else renders.set(r.entityId, [r]);
  }
  const own = new Map<string, Map<number, number>>();
  const via = new Map<string, Map<number, [number, string]>>();
  const names: Record<string, string> = {};
  for (const row of rows) {
    if (row.subjectType !== 'entity' || row.v === null) continue;
    const polity = byEntity.get(row.subjectId);
    if (!polity) continue;
    const at = keyOf(row.t);
    const targets = renders.get(row.subjectId);
    if (targets) {
      for (const r of targets) {
        if (r.validLo > row.t || (r.validHi !== null && r.validHi <= row.t)) continue;
        let m = via.get(r.renderKey);
        if (!m) via.set(r.renderKey, (m = new Map()));
        if (!m.has(at)) m.set(at, [row.v, polity.key]);
        names[polity.key] = polity.name ?? polity.key;
      }
    } else if (!polity.key.startsWith('hist:')) {
      let m = own.get(polity.key);
      if (!m) own.set(polity.key, (m = new Map()));
      m.set(at, row.v);
    }
  }
  const values: Record<string, ShapePoint[]> = {};
  let lo = Infinity;
  let hi = -Infinity;
  for (const key of new Set([...own.keys(), ...via.keys()])) {
    const mine = own.get(key);
    const borrowed = via.get(key);
    const times = new Set([...(mine?.keys() ?? []), ...(borrowed?.keys() ?? [])]);
    const points: ShapePoint[] = [];
    for (const at of [...times].sort((a, b) => a - b)) {
      const x = xOf(at);
      const v = mine?.get(at);
      if (v !== undefined) points.push([x, round(v)]);
      else {
        const [bv, from] = borrowed!.get(at)!;
        points.push([x, round(bv), from]);
      }
      lo = Math.min(lo, x);
      hi = Math.max(hi, x);
    }
    values[key] = points;
  }
  return { values, names, years: Number.isFinite(lo) ? [lo, hi] as [number, number] : null };
}

export function seriesRoutes(data: ReplayData) {
  const app = new Hono<AccessEnv>();
  const catalogues = new Map<string, { at: number; body: unknown }>();

  const scope = (c: Context<AccessEnv>) => {
    const catalog = data.catalog();
    const series = data.series();
    if (!catalog || !series) return undefined;
    return { catalog, series, policy: catalog.policy(c.var.access.entitlements['data.licence_tier']) };
  };

  /** Yearly and daily (or weekly) metrics with enough polities to map. */
  app.get('/', c => {
    const s = scope(c);
    if (!s) return notReady(c);
    const cached = catalogues.get(s.policy.hash);
    if (cached && data.now() - cached.at < CATALOGUE_TTL_MS) return c.json(cached.body, 200, CACHE);
    const metrics = s.series.entityMetrics(s.policy.sourceIds)
      .filter(m => MAPPED.has(m.granularity) && m.subjects >= MIN_SUBJECTS)
      .map(m => ({ code: m.code, name: m.name, unit: m.unit, topic: m.topic, subjects: m.subjects, years: yearsOf(m.first, m.last, m.granularity as Step) }));
    const body = { metrics };
    catalogues.set(s.policy.hash, { at: data.now(), body });
    return c.json(body, 200, CACHE);
  });

  /** ?source=code picks among the sources that publish the metric; the default is the one with the most points. */
  app.get('/:metric', c => {
    const s = scope(c);
    if (!s) return notReady(c);
    const metric = s.series.metric(c.req.param('metric'));
    if (!metric) return c.json({ error: 'not_found' }, 404, NO_STORE);
    if (!MAPPED.has(metric.granularity)) {
      return c.json({ error: 'not_mappable', message: `${metric.code} is ${metric.granularity}ly; only yearly, weekly and daily metrics are mapped` }, 422, NO_STORE);
    }
    const step = metric.granularity as Step;
    const rows = s.series.points(metric.code, s.policy.sourceIds).filter(r => r.subjectType === 'entity');
    const counts = new Map<number, number>();
    for (const r of rows) counts.set(r.sourceId, (counts.get(r.sourceId) ?? 0) + 1);
    if (!counts.size) return c.json({ error: 'not_found' }, 404, NO_STORE);
    const sources = s.catalog.sources().filter(src => counts.has(src.sourceId));
    const wanted = c.req.query('source');
    const chosen = wanted
      ? sources.find(src => src.code === wanted)
      : sources.reduce((best, src) => (counts.get(src.sourceId)! > counts.get(best.sourceId)! ? src : best));
    if (!chosen) return c.json({ error: 'not_found', message: `no ${metric.code} from ${wanted}` }, 404, NO_STORE);
    const { polities, render } = s.catalog.polityShapes();
    const shaped = shapeSeries(rows.filter(r => r.sourceId === chosen.sourceId), polities, render, step);
    return c.json({
      metric: { code: metric.code, name: metric.name, unit: metric.unit, topic: metric.topic },
      source: { code: chosen.code, name: chosen.name, attribution: chosen.attribution },
      sources: sources.map(src => ({ code: src.code, name: src.name, points: counts.get(src.sourceId) })),
      ...shaped,
      // Clients read a missing step as 'year'.
      ...(step === 'day' && { step }),
    }, 200, CACHE);
  });

  return app;
}
