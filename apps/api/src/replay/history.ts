import { DAY_MS } from '@takip/core/time';
import type { Bbox } from '@takip/core/tiles';
import { bandTolerance, type EventCandidate, type EventCell, fromWkb, type Geometry, type Position, simplify, zband } from '@takip/db';
import { type Context, Hono } from 'hono';
import type { AccessEnv } from '../access/middleware';
import type { ReplayData } from './data';

/*
 * Curated history (wars, battles, claims, attacks, tariffs, heritage in danger) as GeoJSON, until the MVT
 * event tiles of replay-database.md §8.4 exist. Times on the wire are epoch seconds.
 * History is not held to replay.lookback_days: that entitlement is about recorded tracks.
 */

/** A family with more events than this in the view is sent as counted cells instead. */
const MAX_PER_FAMILY = 2000;
const CELLS_PER_TILE = 12;
const BINS = 10;
const CACHE = { 'Cache-Control': 'private, max-age=300' };
const NO_STORE = { 'Cache-Control': 'no-store' };

const notReady = (c: Context) =>
  c.json({ error: 'not_ready', message: 'No history yet: run `npm run import -- all`.' }, 503, { ...NO_STORE, 'Retry-After': '60' });

/** Longitudes inside [-180, 180]; a box across the antimeridian becomes two. */
export function boxes(w: number, s: number, e: number, n: number): Bbox[] {
  const south = Math.max(-90, s);
  const north = Math.min(90, n);
  if (e - w >= 360) return [{ w: -180, s: south, e: 180, n: north }];
  const wrap = (x: number) => ((((x + 180) % 360) + 360) % 360) - 180;
  const west = wrap(w);
  const east = wrap(e);
  return west <= east
    ? [{ w: west, s: south, e: east, n: north }]
    : [{ w: west, s: south, e: 180, n: north }, { w: -180, s: south, e: east, n: north }];
}

const point = (lon: number, lat: number, properties: Record<string, unknown>) => ({
  type: 'Feature' as const,
  geometry: { type: 'Point' as const, coordinates: [lon, lat] },
  properties,
});

const eventFeature = (r: EventCandidate) => point(r.lon, r.lat, {
  id: r.id,
  kind: r.kind,
  family: r.family,
  title: r.title,
  t0: r.t0 / 1000,
  t1: r.t1 / 1000,
  prec: r.prec,
  ongoing: r.ongoing,
  geoPrec: r.geoPrec,
  magnitude: r.magnitude,
  sourceId: r.sourceId,
});

const round = (x: number) => Math.round(x * 1000) / 1000;

/** Longitudes made continuous fix to fix, as the importers store them; a no-op on a line that already is. */
const unwrap = (line: Position[]): Position[] => {
  const out: Position[] = [];
  for (const [lon, lat] of line) {
    const prev = out[out.length - 1];
    out.push([prev ? lon + 360 * Math.round((prev[0] - lon) / 360) : lon, lat]);
  }
  return out;
};

/** A continuous line cut where it crosses ±180°, each piece back inside [-180, 180], so no stripe runs across the map. */
export function splitAt180(line: Position[]): Position[][] {
  const world = (lon: number) => Math.floor((lon + 180) / 360);
  const parts: Position[][] = [];
  let part: Position[] = [];
  const push = (p: Position) => {
    const last = part[part.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) part.push(p);
  };
  line.forEach((p, i) => {
    const w = world(p[0]);
    const q = line[i - 1];
    const v = q && world(q[0]);
    if (q && v !== w) {
      const edge = -180 + 360 * Math.max(v, w);
      const lat = round(q[1] + ((p[1] - q[1]) * (edge - q[0])) / (p[0] - q[0]));
      push([round(edge - 360 * v), lat]);
      parts.push(part);
      part = [];
      push([round(edge - 360 * w), lat]);
    }
    push([round(p[0] - 360 * w), round(p[1])]);
  });
  parts.push(part);
  return parts.filter(l => l.length >= 2);
}

/** An event's line (a storm's track, a voyage's ports) simplified for the zoom; null when its geom is no line. */
export function trackOf(wkb: Uint8Array, tolerance: number): Geometry | null {
  let g: Geometry;
  try {
    g = fromWkb(wkb);
  } catch {
    return null;
  }
  if (g.type !== 'LineString' && g.type !== 'MultiLineString') return null;
  const lines = g.type === 'LineString' ? [g.coordinates] : g.coordinates;
  const parts = lines.flatMap(l => {
    const s = simplify({ type: 'LineString', coordinates: unwrap(l) }, tolerance);
    return s?.type === 'LineString' ? splitAt180(s.coordinates) : [];
  });
  if (!parts.length) return null;
  return parts.length === 1 ? { type: 'LineString', coordinates: parts[0] } : { type: 'MultiLineString', coordinates: parts };
}

/** Its point's times, so the map's clock shows and fades both alike. */
const lineFeature = (r: EventCandidate, geometry: Geometry) => ({
  type: 'Feature' as const,
  geometry,
  properties: { line: 1, id: r.id, kind: r.kind, family: r.family, t0: r.t0 / 1000, t1: r.t1 / 1000, geoPrec: r.geoPrec },
});

/** Wikipedia year-page sources by language ("wikipedia-years-tr"): one story told per language, see `languages`. */
const YEAR_PAGES = /^wikipedia-years-([a-z]{2,3})$/;

/** The reader's language and English among the year-page sources, or undefined when there are none. */
export function yearPageLanguages(sources: readonly { sourceId: number; code: string }[], lang: string | undefined) {
  const byLang = new Map(sources.flatMap(s => {
    const m = YEAR_PAGES.exec(s.code);
    return m ? [[m[1], s.sourceId] as const] : [];
  }));
  if (!byLang.size) return undefined;
  const base = byLang.get('en') ?? null;
  const prefer = lang && lang !== 'en' ? byLang.get(lang.slice(0, 2).toLowerCase()) ?? null : null;
  return { sources: [...byLang.values()], base, prefer };
}

const cellFeature = (r: EventCell) => point(r.lon, r.lat, { cell: 1, family: r.family, t0: r.t0 / 1000, t1: r.t1 / 1000, n: r.n, magnitude: r.magSum });

export function historyRoutes(data: ReplayData) {
  const app = new Hono<AccessEnv>();

  const scope = (c: Context<AccessEnv>) => {
    const catalog = data.catalog();
    const history = data.history();
    if (!catalog || !history) return undefined;
    return { catalog, history, sourceIds: catalog.policy(c.var.access.entitlements['data.licence_tier']).sourceIds };
  };

  /** ?bbox=w,s,e,n&from=&to=&z=&families=&kinds=&lang=: events in the view, with their lines; dense families as cells × BINS time bins. */
  app.get('/events', c => {
    const s = scope(c);
    if (!s) return notReady(c);
    const bbox = (c.req.query('bbox') ?? '-180,-90,180,90').split(',').map(Number);
    const from = Number(c.req.query('from'));
    const to = Number(c.req.query('to'));
    const z = Math.min(14, Math.max(0, Math.floor(Number(c.req.query('z') ?? 2))));
    if (bbox.length !== 4 || bbox.some(Number.isNaN) || !Number.isFinite(from) || !Number.isFinite(to) || from >= to || Number.isNaN(z)) {
      return c.json({ error: 'bad_request', message: 'bbox=w,s,e,n and from < to (epoch s) are required' }, 400, NO_STORE);
    }
    const families = c.req.query('families')?.split(',').filter(Boolean);
    const kinds = c.req.query('kinds')?.split(',').filter(Boolean);
    const languages = yearPageLanguages(s.catalog.sources(), c.req.query('lang'));
    const window = { tLo: from * 1000, tHi: to * 1000, sourceIds: s.sourceIds, families, kinds: kinds?.length ? kinds : undefined, languages };
    const cellDeg = 360 / 2 ** z / CELLS_PER_TILE;
    const binMs = Math.max(DAY_MS, Math.ceil((window.tHi - window.tLo) / BINS));

    const views = boxes(bbox[0], bbox[1], bbox[2], bbox[3]);
    const cells = views.flatMap(bb => s.history.cells({ ...window, bbox: bb, cellDeg, binMs }));
    const totals = new Map<string, number>();
    for (const cell of cells) totals.set(cell.family, (totals.get(cell.family) ?? 0) + cell.n);
    const sparse = [...totals].filter(([, n]) => n <= MAX_PER_FAMILY).map(([f]) => f);
    // An event whose box reaches both halves of a view split at 180° comes back from each.
    const byId = new Map<number, EventCandidate>();
    if (sparse.length) for (const bb of views) for (const r of s.history.candidates({ ...window, families: sparse, bbox: bb })) byId.set(r.id, r);
    const events = [...byId.values()];
    const tolerance = bandTolerance(zband(z));

    const features = [
      ...events.map(eventFeature),
      ...events.flatMap(r => {
        const track = r.geom && trackOf(r.geom, tolerance);
        return track ? [lineFeature(r, track)] : [];
      }),
      ...cells.filter(cell => !sparse.includes(cell.family)).map(cellFeature),
    ];
    return c.json({
      type: 'FeatureCollection',
      from,
      to,
      binS: binMs / 1000,
      counts: Object.fromEntries(totals),
      features,
    }, 200, CACHE);
  });

  app.get('/events/:id', c => {
    const s = scope(c);
    if (!s) return notReady(c);
    const e = s.history.event(Number(c.req.param('id')));
    if (!e || !s.sourceIds.has(e.sourceId)) return c.json({ error: 'not_found' }, 404, NO_STORE);
    const source = s.catalog.sources().find(src => src.sourceId === e.sourceId);
    const { geom: _geom, ...rest } = e;
    return c.json({
      ...rest,
      t0: e.t0 / 1000,
      t1: e.t1 / 1000,
      tStart: e.tStart / 1000,
      tEnd: e.tEnd === null ? null : e.tEnd / 1000,
      entities: e.entities.map(x => ({ ...x, tLo: x.tLo === null ? null : x.tLo / 1000, tHi: x.tHi === null ? null : x.tHi / 1000 })),
      source: source && { code: source.code, name: source.name, attribution: source.attribution },
    }, 200, CACHE);
  });

  return app;
}
