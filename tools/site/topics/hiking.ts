// The hiking table for place pages: the waymarked hiking routes around every town and city of 50,000 people or more,
// from Waymarked Trails (data © OpenStreetMap contributors, ODbL). Writes data/site/topics/hiking.json, keyed by
// GeoNames id, holding only places with routes; the routes the pages name sit once in its meta.
//
//   nice npx tsx tools/site/topics/hiking.ts [--cache <dir>] [--europe] [--offline] [--only <id,id>]
//
// Reads data/site/gazetteer.json (tools/site/build-gazetteer.ts). Waymarked Trails is run by volunteers: one request
// at a time, at most one a second, every answer cached (default .cache/site/hiking), so a rerun resumes where the
// last stopped and --offline rebuilds from the cache alone. Outside Europe each country, then each 2° cell of its
// towns, is asked first whether it has any route at all.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { slimDetails, type RouteDetails } from '../../../src/lib/feeds/hiking/details';
import { fromMercator, mercatorBox, type MercatorBox } from '../../../src/lib/feeds/hiking/mercator';
import { WMT_API } from '../../../src/lib/feeds/hiking/overlay';
import {
  hikingKm, hikingLevel, isNamedRoute, type HikingCounts, type HikingMeta, type HikingRoute, type HikingRow,
} from '../../../src/lib/platform/site/places/topics/hiking-data';

const OUT = 'data/site/topics/hiking.json';
const GAZETTEER = 'data/site/gazetteer.json';
const COUNTRY_INFO = 'https://download.geonames.org/export/dump/countryInfo.txt';
const UA = 'TAKIP-site-pages/0.1 (https://takip.dev; hello@takip.dev)';
const MIN_POP = 50_000;
const SPACING_MS = 1000;
/** by_area's own maximum. A full listing is cut short, alphabetically among local routes; its box is split in four once. */
const LIMIT = 100;
const MAX_SPLITS = 1;
const IDS_PER_SEGMENTS = 100;
/** Slivers where a route only grazes the circle. */
const MIN_INSIDE_KM = 0.1;
const SHORT_KM = 10;
const TOP = 12;
/** Country boxes bigger than this go straight to cells: one query over a continent is no kindness. */
const MAX_PROBE_DEG = 15;

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const CACHE = arg('--cache') ?? join('.cache', 'site', 'hiking');
const OFFLINE = process.argv.includes('--offline');
const EUROPE_ONLY = process.argv.includes('--europe');
/** GeoNames ids to survey alone, for trying the tool out; the output then holds only them. */
const ONLY = arg('--only')?.split(',').map(Number);

interface Candidate { id: number; name: string; cc: string; at: [number, number]; pop: number; europe: boolean }
interface Summary { id: number; name?: string; ref?: string; group: string; itinerary?: string[] }
interface Measured { inKm: number; boxKm: number; whole: boolean }
interface Details extends RouteDetails { type?: string; from?: string; to?: string }
type Lines = number[][][];

class OfflineMiss extends Error {}

const sleep = (ms: number) => new Promise(r => setTimeout(r, Math.max(0, ms)));
const round = (km: number) => (km < 10 ? Math.round(km * 10) / 10 : Math.round(km));
const hash = (s: string) => createHash('sha1').update(s).digest('hex').slice(0, 12);
const boxKey = (b: MercatorBox) => b.map(n => Math.round(n)).join('_');
const boxParam = (b: MercatorBox) => b.map(n => Math.round(n)).join(',');

let lastStart = 0;
let requests = 0;

async function wmt(path: string): Promise<unknown> {
  if (OFFLINE) throw new OfflineMiss(path);
  for (let attempt = 1; ; attempt++) {
    await sleep(lastStart + SPACING_MS - Date.now());
    lastStart = Date.now();
    requests++;
    const res = await fetch(`${WMT_API}${path}`, { headers: { 'User-Agent': UA } }).catch(() => null);
    if (res?.ok) return res.json();
    if (res?.status === 404) return null;
    if (attempt >= 5 || (res && res.status < 500 && res.status !== 429)) throw new Error(`${res?.status ?? 'network error'} ${path}`);
    console.warn(`  ${res?.status ?? 'network error'} on ${path}; retrying`);
    await sleep(15_000 * attempt);
  }
}

async function cached<T>(file: string, get: () => Promise<T>): Promise<T> {
  const path = join(CACHE, file);
  if (existsSync(path)) {
    const buf = readFileSync(path);
    return JSON.parse((path.endsWith('.gz') ? gunzipSync(buf) : buf).toString('utf8')) as T;
  }
  const value = await get();
  mkdirSync(dirname(path), { recursive: true });
  const text = JSON.stringify(value);
  writeFileSync(path, path.endsWith('.gz') ? gzipSync(text) : text);
  return value;
}

async function candidates(): Promise<Candidate[]> {
  const info = join(CACHE, 'countryInfo.txt');
  if (!existsSync(info)) {
    const res = await fetch(COUNTRY_INFO, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`countryInfo.txt: HTTP ${res.status}`);
    mkdirSync(CACHE, { recursive: true });
    writeFileSync(info, await res.text());
  }
  const continent = new Map(readFileSync(info, 'utf8').split('\n').filter(l => l && !l.startsWith('#')).map(l => l.split('\t')).map(p => [p[0], p[8]]));
  const places = (JSON.parse(readFileSync(GAZETTEER, 'utf8')) as { places: (Omit<Candidate, 'europe'> & { kind: string })[] }).places;
  return places.filter(p => p.kind === 'city' && p.pop >= MIN_POP)
    .map(p => ({ id: p.id, name: p.name, cc: p.cc, at: p.at, pop: p.pop, europe: continent.get(p.cc) === 'EU' }));
}

/** [west, south, east, north] in degrees, `km` each way from the centre. */
function degreeBox([lng, lat]: [number, number], km: number): [number, number, number, number] {
  const dLat = km / 110.574;
  const dLng = km / (111.32 * Math.cos((lat * Math.PI) / 180));
  return [lng - dLng, lat - dLat, lng + dLng, lat + dLat];
}

const union = (boxes: [number, number, number, number][]): [number, number, number, number] =>
  [Math.min(...boxes.map(b => b[0])), Math.min(...boxes.map(b => b[1])), Math.max(...boxes.map(b => b[2])), Math.max(...boxes.map(b => b[3]))];

const validSummary = (r: unknown): r is Summary => Number.isInteger((r as Summary)?.id) && typeof (r as Summary).group === 'string';

/** Top-level routes with a stretch in the box, most important first. */
async function listArea(b: MercatorBox, limit = LIMIT): Promise<Summary[]> {
  const file = limit === LIMIT ? `area/${boxKey(b)}.json.gz` : `probe/${boxKey(b)}.json`;
  return cached(file, async () => {
    const json = await wmt(`/list/by_area?bbox=${boxParam(b)}&limit=${limit}`) as { results?: unknown[] } | null;
    return (json?.results ?? []).filter(validSummary).map(({ id, name, ref, group, itinerary }) => ({ id, name, ref, group, itinerary }));
  });
}

/** Every top-level route with a stretch in the box, splitting the box in four while a listing comes back full. */
async function routesIn(b: MercatorBox, depth = 0): Promise<{ routes: Map<number, Summary>; capped: boolean }> {
  const found = await listArea(b);
  const routes = new Map(found.map(r => [r.id, r]));
  if (found.length < LIMIT) return { routes, capped: false };
  if (depth >= MAX_SPLITS) return { routes, capped: true };
  const [x1, y1, x2, y2] = b;
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  let capped = false;
  for (const q of [[x1, y1, mx, my], [mx, y1, x2, my], [x1, my, mx, y2], [mx, my, x2, y2]] as MercatorBox[]) {
    const sub = await routesIn(q, depth + 1);
    sub.routes.forEach((r, id) => routes.set(id, r));
    capped ||= sub.capped;
  }
  return { routes, capped };
}

/** Each route's lines inside the box, in EPSG:3857, simplified upstream. */
async function segments(b: MercatorBox, ids: number[]): Promise<Map<number, Lines>> {
  const into = new Map<number, Lines>();
  const sorted = [...new Set(ids)].sort((x, y) => x - y);
  for (let i = 0; i < sorted.length; i += IDS_PER_SEGMENTS) {
    const chunk = sorted.slice(i, i + IDS_PER_SEGMENTS);
    const fc = await cached(`segments/${boxKey(b)}-${hash(chunk.join(','))}.json.gz`, async () =>
      await wmt(`/list/segments?bbox=${boxParam(b)}&relations=${chunk.join(',')}`) ?? { features: [] }) as
      { features?: { id?: number; geometry?: { type?: string; coordinates?: unknown } }[] };
    for (const f of fc.features ?? []) {
      const g = f.geometry;
      const lines = g?.type === 'LineString' ? [g.coordinates as number[][]] : g?.type === 'MultiLineString' ? g.coordinates as Lines : [];
      if (Number.isInteger(f.id) && lines.length) into.set(f.id!, [...(into.get(f.id!) ?? []), ...lines]);
    }
  }
  return into;
}

/** The part of segment a→b (km from the centre) inside the circle of radius r. */
function insideFraction([ax, ay]: number[], [bx, by]: number[], r: number): number {
  const dx = bx - ax, dy = by - ay;
  const dd = dx * dx + dy * dy;
  if (!dd) return 0;
  const ad = ax * dx + ay * dy;
  const disc = ad * ad - dd * (ax * ax + ay * ay - r * r);
  if (disc <= 0) return 0;
  const s = Math.sqrt(disc);
  return Math.max(0, Math.min(1, (-ad + s) / dd) - Math.max(0, (-ad - s) / dd));
}

function measure(lines: Lines, [lng0, lat0]: [number, number], r: number, box: MercatorBox): Measured {
  const kx = 111.32 * Math.cos((lat0 * Math.PI) / 180), ky = 110.574;
  // Clipped lines end on the box's edge; a route that never reaches it lies wholly inside.
  const margin = 100;
  const [x1, y1, x2, y2] = box;
  let inKm = 0, boxKm = 0, whole = true;
  for (const line of lines) {
    const pts = line.map(([x, y]) => {
      if (x - x1 < margin || x2 - x < margin || y - y1 < margin || y2 - y < margin) whole = false;
      const [lng, lat] = fromMercator(x, y);
      return [(lng - lng0) * kx, (lat - lat0) * ky];
    });
    for (let i = 1; i < pts.length; i++) {
      const len = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      boxKm += len;
      inKm += len * insideFraction(pts[i - 1], pts[i], r);
    }
  }
  return { inKm, boxKm, whole };
}

const zeroCounts = (): HikingCounts => ({ int: 0, nat: 0, reg: 0, loc: 0 });

interface Found { row: HikingRow; routes: Map<number, Summary & Measured> }

async function survey(c: Candidate, b: MercatorBox): Promise<Found | null> {
  const r = hikingKm(c.pop);
  const { routes, capped } = await routesIn(b);
  if (!routes.size) return null;
  const geo = await segments(b, [...routes.keys()]);
  const near = new Map<number, Summary & Measured>();
  for (const [id, s] of routes) {
    const m = measure(geo.get(id) ?? [], c.at, r, b);
    if (m.inKm >= MIN_INSIDE_KM) near.set(id, { ...s, ...m });
  }
  if (!near.size) return null;
  const n = zeroCounts(), kmIn = zeroCounts();
  let named = 0, shortLocal = 0;
  for (const x of near.values()) {
    const level = hikingLevel(x.group);
    n[level]++;
    kmIn[level] += x.inKm;
    if (isNamedRoute(x)) named++;
    if (level === 'loc' && x.whole && x.boxKm < SHORT_KM) shortLocal++;
  }
  for (const k of Object.keys(kmIn) as (keyof HikingCounts)[]) kmIn[k] = round(kmIn[k]);
  const top = [...near.values()].sort((a, z) => z.inKm - a.inKm).slice(0, TOP).map(x => [x.id, round(x.inKm)] as [number, number]);
  return { row: { r, n, named, kmIn, shortLocal, ...(capped ? { capped: true as const } : {}), top }, routes: near };
}

const probe = async (box: [number, number, number, number]) => (await listArea(mercatorBox(...box), 1)).length > 0;

const townBox = (group: Candidate[]) => union(group.map(c => degreeBox(c.at, hikingKm(c.pop))));

/** The towns of a group near any route: probe their joint box, then each quarter of the group while it answers yes. */
async function sift(group: Candidate[], depth = 0): Promise<Candidate[]> {
  // Probing one or two towns costs what surveying them does.
  if (group.length <= 2) return group;
  if (!(await probe(townBox(group)))) return [];
  if (depth >= 3) return group;
  const [w, s, e, n] = townBox(group);
  const mx = (w + e) / 2, my = (s + n) / 2;
  const out: Candidate[] = [];
  for (const [east, north] of [[false, false], [true, false], [false, true], [true, true]]) {
    out.push(...await sift(group.filter(c => (c.at[0] >= mx) === east && (c.at[1] >= my) === north), depth + 1));
  }
  return out;
}

/** Outside Europe: the towns in countries, then 2° cells, then quarters of them, where Waymarked lists any route. */
async function reachable(others: Candidate[]): Promise<Candidate[]> {
  const byCountry = new Map<string, Candidate[]>();
  for (const c of others) byCountry.set(c.cc, [...(byCountry.get(c.cc) ?? []), c]);
  const keep: Candidate[] = [];
  for (const [cc, list] of byCountry) {
    const box = townBox(list);
    const cells = new Map<string, Candidate[]>();
    for (const c of list) {
      const key = `${Math.floor(c.at[0] / 2)},${Math.floor(c.at[1] / 2)}`;
      cells.set(key, [...(cells.get(key) ?? []), c]);
    }
    const small = box[2] - box[0] <= MAX_PROBE_DEG && box[3] - box[1] <= MAX_PROBE_DEG;
    if (cells.size > 1 && small && !(await probe(box))) continue;
    let near = 0;
    for (const group of cells.values()) {
      const found = await sift(group);
      keep.push(...found);
      near += found.length;
    }
    if (near) console.log(`  ${cc}: ${near} of ${list.length} towns near a route`);
  }
  return keep;
}

async function routeDetails(id: number): Promise<Details | null> {
  return cached(`details/${id}.json`, async () => {
    const raw = await wmt(`/details/relation/${id}`) as { tags?: Record<string, string> } | null;
    const slim = slimDetails(raw);
    return slim && { ...slim, type: raw?.tags?.type, from: raw?.tags?.from, to: raw?.tags?.to };
  });
}

function routeEntry(s: Summary & Measured, d: Details | null): HikingRoute {
  const itinerary = d?.itinerary?.length ? d.itinerary : s.itinerary;
  const from = d?.from ?? itinerary?.[0];
  const to = d?.to ?? (itinerary && itinerary.length > 1 ? itinerary[itinerary.length - 1] : undefined);
  const e: HikingRoute = { net: s.group };
  if (s.name) e.name = s.name;
  if (s.ref && s.ref !== s.name) e.ref = s.ref;
  if (d?.length) e.km = round(d.length / 1000);
  else if (s.whole) Object.assign(e, { km: round(s.boxKm), approx: true });
  if (d?.official_length && (!d.length || Math.abs(d.official_length - d.length) / d.official_length > 0.05)) e.officialKm = round(d.official_length / 1000);
  if (d?.operator) e.operator = d.operator;
  if (from && to && from !== to) Object.assign(e, { from, to });
  if (d?.type === 'superroute' && d.subroutes > 1) e.stages = d.subroutes;
  return e;
}

const found = new Map<number, Found>();
/** Each route a page names, measured where it lies wholly inside a box if anywhere, so its own lines give its length. */
const named = new Map<number, Summary & Measured>();
const details = new Map<number, Details | null>();

/** The place's row, and the full length and operator of each long-distance or regional route it names. */
async function surveyPlace(c: Candidate, box: MercatorBox) {
  const f = await survey(c, box);
  if (!f) return;
  found.set(c.id, f);
  for (const [id] of f.row.top) {
    const s = f.routes.get(id)!;
    const prev = named.get(id);
    named.set(id, prev && (prev.whole || !s.whole) ? prev : s);
    if (hikingLevel(s.group) !== 'loc' && !details.has(id)) {
      try {
        details.set(id, await routeDetails(id));
      } catch (e) {
        if (!(e instanceof OfflineMiss)) throw e;
      }
    }
  }
}

function write(of: number): string {
  const routes: Record<string, HikingRoute> = {};
  for (const [id, s] of named) routes[id] = routeEntry(s, details.get(id) ?? null);
  const rows: Record<string, HikingRow> = {};
  for (const [id, f] of found) rows[id] = f.row;
  const table = { generated: new Date().toISOString().slice(0, 10), meta: { routes } satisfies HikingMeta, rows };
  mkdirSync(dirname(OUT), { recursive: true });
  const text = `${JSON.stringify(table)}\n`;
  writeFileSync(OUT, text);
  return `${found.size} of ${of} places and ${named.size} routes in ${OUT} (${Math.round(text.length / 1024)} KB)`;
}

/**
 * The box each place is surveyed in: its own, or a bigger neighbour's that already holds its whole circle (a
 * city's districts and suburbs), which costs nothing more.
 */
function shareBoxes(todo: Candidate[]): Map<number, MercatorBox> {
  const boxes = new Map<number, MercatorBox>();
  const anchors: { c: Candidate; r: number; box: MercatorBox }[] = [];
  for (const c of [...todo].sort((a, z) => z.pop - a.pop)) {
    const r = hikingKm(c.pop);
    const holder = anchors.find(a => {
      const dx = Math.abs(c.at[0] - a.c.at[0]) * 111.32 * Math.cos((a.c.at[1] * Math.PI) / 180);
      const dy = Math.abs(c.at[1] - a.c.at[1]) * 110.574;
      return dx + r <= a.r && dy + r <= a.r;
    });
    if (holder) {
      boxes.set(c.id, holder.box);
    } else {
      const box = mercatorBox(...degreeBox(c.at, r));
      anchors.push({ c, r, box });
      boxes.set(c.id, box);
    }
  }
  return boxes;
}

async function main() {
  const all = (await candidates()).filter(c => !ONLY || ONLY.includes(c.id));
  const europe = all.filter(c => c.europe).sort((a, z) => z.pop - a.pop);
  console.log(`${all.length} places of ${MIN_POP.toLocaleString('en')}+; ${europe.length} in Europe`);
  let missed = 0, done = 0;
  const t0 = Date.now();
  // Written as it goes, so a stopped run still leaves a whole table for the places it reached.
  const surveyAll = async (todo: Candidate[]) => {
    const boxes = shareBoxes(todo);
    for (const [i, c] of todo.entries()) {
      try {
        await surveyPlace(c, boxes.get(c.id)!);
      } catch (e) {
        if (!(e instanceof OfflineMiss)) throw e;
        missed++;
      }
      done++;
      if ((i + 1) % 100 === 0) console.log(`  ${i + 1}/${todo.length}: ${write(done)}; ${requests} requests, ${Math.round((Date.now() - t0) / 60_000)} min`);
    }
  };
  await surveyAll(europe);
  console.log(`Europe: ${write(done)}; ${requests} requests`);
  const others = EUROPE_ONLY ? [] : (await reachable(all.filter(c => !c.europe))).sort((a, z) => z.pop - a.pop);
  console.log(`surveying ${others.length} places outside Europe, ${requests} requests so far`);
  await surveyAll(others);
  console.log(`wrote ${write(all.length)}; ${requests} requests${missed ? `; ${missed} places not in the cache` : ''}`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
