// Builds src/lib/feeds/transit/generated/feeds.generated.ts: every keyless GTFS-RT vehicle-position feed in the
// Mobility Database and Transitland Atlas, probed once for where its vehicles actually run; and
// public/data/transit/cities.json: the cities they serve, with the modes from each feed's routes.txt;
// the stop graphs of feeds that give trains by stop alone; and each mixed feed's route modes.
//   nice -n 10 npx tsx tools/transit/build-feeds.ts [--reuse-probes [--reprobe=<regex on id or url>]]
// Downloads go to .cache/transit/. Probe in daytime for the region you care about: an empty feed keeps
// only its catalogue bbox, and an Atlas feed with neither is dropped.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createPool } from '../../src/lib/core/net/fetch-pool';
import { EXTRA_FEEDS } from '../../src/lib/feeds/transit/sources/extra-feeds';
import type { RtStopFix, RtVehicle } from '../../src/lib/feeds/transit/gtfs/realtime';
import { modeOfRouteType, sortModes, type TransitCities, type TransitMode } from '../../src/lib/feeds/transit/modes';
import { routeModes, type RouteModes } from '../../src/lib/feeds/transit/gtfs/route-mode';
import { inBbox, type TransitFeed } from '../../src/lib/feeds/transit/select';
import { TFL_TUBE_GRAPH } from '../../src/lib/feeds/transit/sources/tfl';
import { scheduledVehicles, type Timetable } from '../../src/lib/feeds/transit/placement/scheduled';
import { placeAtStops, stopFixes, type StopGraph } from '../../src/lib/feeds/transit/placement/stop-place';
import { fetchFeed } from '../../src/lib/feeds/transit/upstream';
import { agencyNames, fromAtlas, fromMdb, normUrl, onestopName } from './catalogue';
import { cityCoverage, createCityIndex, parseGeonames, type FeedSample } from './cities';
import { buildStopGraph } from './stop-graphs';
import { fresh, jaccard, meets, pad, probe, recent, span, TIMEOUT_MS, union, vehicleBbox, type Probe } from './probes';
import { morning, writeSchedules } from './scheduled-feeds';
import { tflTubeGraph } from './tfl-graph';
import { zipEntry } from '../../src/lib/core/net/remote-zip';

const CACHE = '.cache/transit';
const OUT = 'src/lib/feeds/transit/generated/feeds.generated.ts';
const GRAPHS_OUT = 'src/lib/feeds/transit/generated/stop-graphs.generated.ts';
const ROUTE_MODES_OUT = 'src/lib/feeds/transit/generated/route-modes.generated.ts';
/** The modes a stop graph is built for: a bus given by stop alone is better left off than drawn at its stop. */
const GRAPH_MODES = new Set<TransitMode>(['metro', 'rail', 'tram']);
/**
 * A graph places a city's trains. Past this it is a national network (SNCF's, Germany's DELFI): megabytes
 * in the bundle, and the same trains its cities' own feeds already draw.
 */
const MAX_GRAPH_STOPS = 3_000;
/** Position feeds known to send some trains by stop alone, which a night-time probe may not see. */
const STOP_ONLY_MODES: Record<string, TransitMode[]> = {
  // OVapi: Amsterdam's GVB metro comes without coordinates.
  'mdb-1646': ['metro'],
};
const CITIES_OUT = 'public/data/transit/cities.json';
const GEONAMES = 'https://download.geonames.org/export/dump/cities15000.zip';
const MDB_CSV = 'https://files.mobilitydatabase.org/feeds_v2.csv';
const ATLAS_TGZ = 'https://codeload.github.com/transitland/transitland-atlas/tar.gz/refs/heads/main';
// USDOT's National Transit Database GTFS links: static only, but they name US agencies Atlas leaves unnamed.
const NTD_JSON = 'https://data.transportation.gov/resource/2u7n-ub22.json?$limit=50000';
const WORKERS = 4;
/** A catalogue area wider than this is a national static feed behind one operator's vehicles; the probe wins. */
const KNOWN_MAX_DEG = 8;
const PROBES = join(CACHE, 'probes.json');
const ROUTES = join(CACHE, 'routes.json');
/** A feed this small runs every mode of its routes.txt in each city it reaches. */
const LOCAL_DEG = 1.5;

async function download(url: string, file: string) {
  if (existsSync(file) && Date.now() - statSync(file).mtimeMs < 86_400_000) return;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows;
  return body.filter(r => r.length === head.length).map(r => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

async function main() {
  mkdirSync(CACHE, { recursive: true });
  await download(MDB_CSV, join(CACHE, 'feeds_v2.csv'));
  await download(ATLAS_TGZ, join(CACHE, 'atlas.tgz'));
  await download(NTD_JSON, join(CACHE, 'ntd-gtfs.json'));
  execFileSync('tar', ['-xzf', join(CACHE, 'atlas.tgz'), '-C', CACHE]);

  const csv = parseCsv(readFileSync(join(CACHE, 'feeds_v2.csv'), 'utf8'));
  const ntd = JSON.parse(readFileSync(join(CACHE, 'ntd-gtfs.json'), 'utf8')) as { agency_name?: string; weblink?: { url?: string } }[];
  const mdb = fromMdb(csv);
  const names = agencyNames(csv, ntd);
  const atlas = fromAtlas(join(CACHE, 'transitland-atlas-main', 'feeds'))
    .map(c => (c.name === onestopName(c.id) ? { ...c, name: c.statics.map(u => names.get(normUrl(u))).find(Boolean) ?? c.name } : c));
  const seen = new Set<string>();
  // The Mobility Database first: it carries a location for most feeds.
  const candidates = [...mdb, ...atlas].filter(c => !seen.has(normUrl(c.url)) && seen.add(normUrl(c.url)));
  console.log(`${mdb.length} Mobility Database + ${atlas.length} Atlas feeds, ${candidates.length} distinct URLs`);

  // --reuse-probes rebuilds from the last run's probes, for working on the rules below without the network;
  // --reprobe=<regex> asks the feeds it matches again, e.g. one region by day.
  const saved: Record<string, Probe> = readSaved(PROBES);
  const reprobe = process.argv.find(a => a.startsWith('--reprobe='))?.slice('--reprobe='.length);
  if (reprobe) for (const c of candidates) if (new RegExp(reprobe).test(c.id) || new RegExp(reprobe).test(c.url)) delete saved[c.url];
  const savedAt = existsSync(PROBES) ? statSync(PROBES).mtimeMs : Date.now();
  for (const p of Object.values(saved)) p.at ??= savedAt;
  console.log(`probing ${candidates.filter(c => !saved[c.url]).length}, ${WORKERS} at a time`);
  const pool = createPool(WORKERS);
  let done = 0;
  const probes = await Promise.all(candidates.map(c => saved[c.url] ?? pool.run(async () => {
    const p = await probe(c);
    if (++done % 50 === 0) console.log(`  ${done} probed`);
    return p;
  })));
  // Merged, so a run over fewer candidates keeps the rest for the next --reuse-probes.
  writeFileSync(PROBES, JSON.stringify({ ...saved, ...Object.fromEntries(candidates.map((c, i) => [c.url, probes[i]])) }));

  const drops: Record<string, number> = {};
  const drop = (why: string) => { drops[why] = (drops[why] ?? 0) + 1; return null; };
  const kept = candidates.map((c, i) => {
    const p = probes[i];
    if (p.fatal) return drop('dead or not a feed');
    const vehicles = fresh(p);
    const seenAt = vehicleBbox(vehicles);
    const known = c.known && span(c.known) <= KNOWN_MAX_DEG ? c.known : undefined;
    // Vehicles nowhere near the area the catalogue gives: the URL now serves someone else's fleet.
    if (seenAt && known && !meets(seenAt, pad(pad(known)))) {
      console.log(`  elsewhere: ${c.id} ${c.name} — catalogue ${known.map(v => v.toFixed(1))}, vehicles ${seenAt.map(v => v.toFixed(1))}`);
      return drop('vehicles not where the catalogue says');
    }
    const bbox = seenAt && known ? (meets(seenAt, known) ? union(seenAt, known) : seenAt) : seenAt ?? known;
    const atStops = recent(p, p.atStops);
    // Trains by stop alone take their area from their stop graph, below.
    if (!bbox && !atStops.length && !c.tripsOnly) return drop(p.err ? 'unreachable, no known area' : 'empty, no known area');
    const ids = new Set([...(p.vehicles ?? []), ...(p.atStops ?? [])].map(v => v.id));
    const feed: TransitFeed = { id: c.id, name: c.name, kind: 'gtfs-rt', url: c.url, bbox: bbox ? pad(bbox) : [0, 0, 0, 0], size: vehicles.length + atStops.length, license: c.license };
    return { feed, ids, vehicles, atStops, statics: c.statics, tripsOnly: c.tripsOnly };
  }).filter(<T,>(k: T | null): k is T => k != null);

  // The same feed under two URLs (a CDN and the agency's host) would draw every vehicle twice.
  const deduped = kept.filter((k, i) => {
    const dup = k.ids.size >= 5 && kept.slice(0, i).some(o => o.ids.size >= 5 && meets(o.feed.bbox, k.feed.bbox) && jaccard(o.ids, k.ids) >= 0.8);
    if (dup) drop('duplicate');
    return !dup;
  });

  const routes = await readRoutes(deduped, readSaved(ROUTES));
  for (const [i, k] of deduped.entries()) {
    const modes = feedModes(routes[i]);
    // Where the server reads trips.txt and shapes.txt to keep a tracked vehicle on its route.
    if (routes[i].types?.length) k.feed.static = routes[i].url ?? k.statics[0];
    if (modes.length) k.feed.modes = modes;
  }

  const extraGraphs = { [TFL_TUBE_GRAPH]: await tflTubeGraph() };
  const { unplaced, graphs } = await writeStopGraphs(deduped, routes, extraGraphs);
  unplaced.forEach(why => drop(why));
  const out = deduped.filter((_, i) => !unplaced.has(i)), outRoutes = routes.filter((_, i) => !unplaced.has(i));
  writeRouteModes(out, outRoutes);
  const day = new Date().toISOString().slice(0, 10);
  const lines = out.map(k => `  ${JSON.stringify(Object.fromEntries(Object.entries(k.feed).filter(([, v]) => v !== undefined)))},`);
  writeFileSync(OUT, `// Generated by tools/transit/build-feeds.ts on ${day} from the Mobility Database (${MDB_CSV})
// and Transitland Atlas (CC BY 4.0), each feed probed live for its area. Do not edit; rerun the tool.
import type { TransitFeed } from '../select';

export const GTFS_RT_FEEDS: TransitFeed[] = [
${lines.join('\n')}
];
`);
  const live = out.filter(k => (k.feed.size ?? 0) > 0);
  console.log(`wrote ${out.length} feeds (${live.length} with vehicles now, ${live.reduce((s, k) => s + (k.feed.size ?? 0), 0)} vehicles) to ${OUT}`);
  console.log('dropped:', drops);

  const scheduled = await writeSchedules();
  await writeCities(out, outRoutes, graphs, scheduled);
}

const readSaved = (file: string) => (process.argv.includes('--reuse-probes') && existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {});

/** routes.txt as [route_id, route_type], and which static zip it came from. */
type RouteTypes = { types?: [string, number][]; err?: string; url?: string };

const feedModes = (r: RouteTypes) => sortModes(new Set((r.types ?? []).map(([, t]) => modeOfRouteType(t)).filter((m): m is TransitMode => !!m)));

async function readRoutes(out: { statics: string[] }[], saved: Record<string, RouteTypes>): Promise<RouteTypes[]> {
  const pool = createPool(WORKERS);
  console.log(`reading routes.txt for ${out.filter(k => k.statics.length && !saved[k.statics[0]]).length} feeds`);
  const routes = await Promise.all(out.map(k => (k.statics.length ? saved[k.statics[0]] ?? pool.run(() => routeTypes(k.statics)) : Promise.resolve<RouteTypes>({ err: 'no static feed' }))));
  writeFileSync(ROUTES, JSON.stringify({ ...saved, ...Object.fromEntries(out.flatMap((k, i) => (k.statics.length ? [[k.statics[0], routes[i]]] : []))) }));
  return routes;
}

async function routeTypes(statics: string[]): Promise<RouteTypes> {
  let err = 'no static feed';
  for (const url of statics) {
    try {
      const txt = await zipEntry(url, 'routes.txt', AbortSignal.timeout(60_000));
      if (!txt) { err = 'no routes.txt'; continue; }
      const rows = parseCsv(txt.toString('utf8').replace(/^\uFEFF/, ''));
      return { url, types: rows.map(r => [r.route_id?.trim() ?? '', Number(r.route_type)] as [string, number]).filter(([, t]) => Number.isFinite(t)) };
    } catch (e) {
      err = String((e as Error).message ?? e);
    }
  }
  return { err };
}

/** A week-old graph is reused: Paris's takes minutes to read out of a gigabyte of stop_times.txt. */
async function cachedStopGraph(url: string, rail: Set<string>): Promise<StopGraph | null> {
  const file = join(CACHE, 'graphs', `${createHash('sha1').update(`${url}\n${[...rail].sort().join(',')}`).digest('hex')}.json`);
  if (existsSync(file) && Date.now() - statSync(file).mtimeMs < 7 * 86_400_000) return JSON.parse(readFileSync(file, 'utf8'));
  const graph = await buildStopGraph(url, r => rail.has(r), AbortSignal.timeout(900_000));
  mkdirSync(join(CACHE, 'graphs'), { recursive: true });
  writeFileSync(file, JSON.stringify(graph));
  return graph;
}

/**
 * A stop graph for each static zip behind feeds that give trains by stop alone (NYC's subway) or by trip
 * updates alone (BART, Paris), shared by every feed on that zip; their probed trains are placed on it for
 * cities.json. Returns, with the reason, the feeds that have nothing of their own to draw: no graph to place
 * their trains on, or trip updates for the same trips a position feed already draws (Toronto's streetcars).
 */
async function writeStopGraphs(
  out: { feed: TransitFeed; vehicles: RtVehicle[]; atStops: RtStopFix[]; tripsOnly?: boolean }[], routes: RouteTypes[], extra: Record<string, StopGraph>,
): Promise<{ unplaced: Map<number, string>; graphs: Record<string, StopGraph> }> {
  const graphs = new Map<string, { id: string; graph: StopGraph | null }>();
  const unplaced = new Map<number, string>();
  for (const [i, k] of out.entries()) {
    const hasGps = k.vehicles.length > 0;
    const forced = STOP_ONLY_MODES[k.feed.id];
    // A trip-update feed empty at the probe (night there) still gets its graph.
    if (!k.atStops.length && !(k.tripsOnly && !hasGps) && !forced) continue;
    const url = k.feed.static;
    let g = url ? graphs.get(url) : undefined;
    if (url && !g) {
      // A mixed feed's graph covers only the modes it sends by stop: Amsterdam's metro, not all of the Netherlands.
      const modeOf = new Map((routes[i].types ?? []).map(([id, t]) => [id, modeOfRouteType(t)]));
      const modes = forced ? new Set(forced) : hasGps ? new Set(k.atStops.map(f => f.route && modeOf.get(f.route))) : GRAPH_MODES;
      const rail = new Set([...modeOf].filter(([, m]) => m && GRAPH_MODES.has(m) && modes.has(m)).map(([id]) => id));
      let graph = rail.size ? await cachedStopGraph(url, rail).catch(e => {
        console.log(`  no stop graph for ${k.feed.id}: ${(e as Error).message}`);
        return null;
      }) : null;
      if (graph && Object.keys(graph.stops).length > MAX_GRAPH_STOPS) {
        console.log(`  no stop graph for ${k.feed.id}: ${Object.keys(graph.stops).length} stops is a national network`);
        graph = null;
      }
      graphs.set(url, (g = { id: k.feed.id, graph }));
    }
    const placed = g?.graph ? placeAtStops(k.atStops, new Map(), g.graph, Date.now() / 1000) : [];
    if (!g?.graph || (!placed.length && !k.tripsOnly && !forced)) {
      if (!hasGps) unplaced.set(i, 'trains by stop alone, none placed');
      continue;
    }
    const trips = new Set(k.atStops.map(f => f.trip).filter(Boolean));
    const twin = !hasGps && trips.size && out.find(o => o.vehicles.length && o !== k && meets(o.feed.bbox, k.feed.bbox.some(Boolean) ? k.feed.bbox : o.feed.bbox)
      && o.vehicles.filter(v => v.trip && trips.has(v.trip)).length >= 0.3 * trips.size);
    if (twin) {
      console.log(`  ${k.feed.id} ${k.feed.name}: its trips are ${twin.feed.id}'s vehicles`);
      unplaced.set(i, 'trip updates for a position feed\'s vehicles');
      continue;
    }
    k.feed.graph = g.id;
    k.vehicles.push(...placed);
    k.feed.size = k.vehicles.length;
    const stops = Object.values(g.graph.stops);
    if (!k.feed.bbox.some(Boolean)) k.feed.bbox = pad([Math.min(...stops.map(s => s[0])), Math.min(...stops.map(s => s[1])), Math.max(...stops.map(s => s[0])), Math.max(...stops.map(s => s[1]))]);
  }
  const used = new Set(out.filter((_, i) => !unplaced.has(i)).map(k => k.feed.graph));
  const built = [...graphs.values()].filter((g): g is { id: string; graph: StopGraph } => !!g.graph && used.has(g.id))
    .concat(Object.entries(extra).map(([id, graph]) => ({ id, graph })));
  writeFileSync(GRAPHS_OUT, `// Generated by tools/transit/build-feeds.ts from each feed's static GTFS. Do not edit; rerun the tool.
import type { StopGraph } from '../placement/stop-place';

export const STOP_GRAPHS: Record<string, StopGraph> = {
${built.map(g => `  ${JSON.stringify(g.id)}: ${JSON.stringify(g.graph)},`).join('\n')}
};
`);
  console.log(`wrote ${built.length} stop graphs (${built.map(g => `${g.id}: ${Object.keys(g.graph.stops).length} stops`).join(', ')}) to ${GRAPHS_OUT}`);
  return { unplaced, graphs: Object.fromEntries(built.map(g => [g.id, g.graph])) };
}

/** For each feed that runs more than one mode, the routes that aren't its main one, so a metro isn't drawn as a bus. */
function writeRouteModes(out: { feed: TransitFeed }[], routes: RouteTypes[]) {
  const table: Record<string, RouteModes> = {};
  for (const [i, k] of out.entries()) {
    const m = routeModes((routes[i].types ?? []).flatMap(([id, t]) => {
      const mode = modeOfRouteType(t);
      return mode ? [[id, mode] as [string, TransitMode]] : [];
    }));
    if (m) table[k.feed.id] = m;
  }
  writeFileSync(ROUTE_MODES_OUT, `// Generated by tools/transit/build-feeds.ts from each feed's routes.txt. Do not edit; rerun the tool.
import type { RouteModes } from '../gtfs/route-mode';

export const ROUTE_MODES: Record<string, RouteModes> = {
${Object.entries(table).map(([id, m]) => `  ${JSON.stringify(id)}: ${JSON.stringify(m)},`).join('\n')}
};
`);
  console.log(`wrote route modes for ${Object.keys(table).length} mixed feeds to ${ROUTE_MODES_OUT}`);
}

/** public/data/transit/cities.json: where the layer has vehicles, for the zoomed-out view. */
async function writeCities(out: { feed: TransitFeed; vehicles: RtVehicle[] }[], routes: RouteTypes[], graphs: Record<string, StopGraph>, scheduled: { feed: TransitFeed; tt: Timetable }[]) {
  await download(GEONAMES, join(CACHE, 'cities15000.zip'));
  const cityAt = createCityIndex(parseGeonames(execFileSync('unzip', ['-p', join(CACHE, 'cities15000.zip')], { maxBuffer: 64 * 1024 * 1024 }).toString('utf8')));

  const samples: FeedSample[] = out.map((k, i) => {
    const byRoute = new Map((routes[i].types ?? []).map(([id, t]) => [id, modeOfRouteType(t)]));
    const [w, s, e, n] = k.feed.bbox;
    return {
      name: k.feed.name,
      // Strays outside the feed's area would otherwise name a city on another continent.
      vehicles: k.vehicles.filter(v => inBbox(v.lng, v.lat, k.feed.bbox)).map(v => ({ lat: v.lat, lng: v.lng, mode: (v.route && byRoute.get(v.route)) || undefined })),
      modes: feedModes(routes[i]),
      center: [(w + e) / 2, (s + n) / 2],
      local: Math.max(e - w, n - s) <= LOCAL_DEG,
    };
  });
  for (const x of EXTRA_FEEDS) {
    // Placed on this run's graphs: the generated file this tool imported may predate them.
    const vehicles = await fetchFeed(x, AbortSignal.timeout(TIMEOUT_MS)).then(m => {
      const graph = x.graph ? graphs[x.graph] : undefined;
      const now = Date.now() / 1000;
      return graph ? [...m.vehicles, ...placeAtStops(stopFixes(m, now), m.trips, graph, now)] : m.vehicles;
    }).catch(() => []);
    const [w, s, e, n] = x.bbox;
    samples.push({ name: x.name, vehicles: vehicles.map(v => ({ lat: v.lat, lng: v.lng, mode: v.mode ?? x.modes[0] })), modes: x.modes, center: [(w + e) / 2, (s + n) / 2], local: true });
  }

  for (const { feed, tt } of scheduled) {
    const [w, s, e, n] = feed.bbox;
    const vehicles = scheduledVehicles(tt, morning(tt.tz));
    samples.push({ name: feed.name, vehicles: vehicles.map(v => ({ lat: v.lat, lng: v.lng, mode: v.mode })), modes: feed.modes ?? [], center: [(w + e) / 2, (s + n) / 2], local: true });
  }
  const cities = cityCoverage(samples, cityAt);
  const typed = routes.filter(r => r.types?.length).length;
  mkdirSync('public/data/transit', { recursive: true });
  writeFileSync(CITIES_OUT, `${JSON.stringify({ generated: new Date().toISOString().slice(0, 10), cities } satisfies TransitCities)}\n`);
  console.log(`wrote ${cities.length} cities to ${CITIES_OUT}; routes.txt read for ${typed}/${out.length} feeds`);
}

main().catch(e => { console.error(e); process.exit(1); });
