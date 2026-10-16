// A rail system's stop graph out of its static GTFS: where each stop is, and which stop each train
// reaches it from with the scheduled run. Feeds that give a train's stop but no position are placed with it.
import { scanCsv, type Zipped } from '../../src/lib/feeds/transit/gtfs/shapes';
import type { StopGraph } from '../../src/lib/feeds/transit/placement/stop-place';
import { openZip } from '../../src/lib/core/net/remote-zip';

/** Runs kept per edge for its median. */
const SAMPLES = 25;
/** An edge with no timed run gets this. */
const DEFAULT_RUN_S = 90;

const seconds = (hms: string) => {
  const [h, m, s] = hms.split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 3600 + m * 60 + (s || 0) : NaN;
};

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const r5 = (v: number) => Math.round(v * 1e5) / 1e5;

interface Row { stop: string; seq: number; arrive: number; depart: number }
interface Edge { runs: number[]; routes: Map<string, number>; trips: number }

/** The graph of the routes `keep` takes, or null when the zip lacks the files or none of them run. */
export async function buildStopGraph(url: string, keep: (route: string) => boolean, signal?: AbortSignal): Promise<StopGraph | null> {
  const zip = await openZip(url, signal);
  const file = async (name: string): Promise<Zipped | null> => {
    const f = zip.find(name);
    return f ? { data: await zip.raw(f), method: f.method } : null;
  };
  const [routes, trips, stopTimes, stops] = await Promise.all([file('routes.txt'), file('trips.txt'), file('stop_times.txt'), file('stops.txt')]);
  if (!trips || !stopTimes || !stops) return null;

  const routeOf = new Map<string, string>();
  await scanCsv(trips, cell => {
    const route = cell('route_id');
    if (keep(route)) routeOf.set(cell('trip_id'), route);
  });
  if (!routeOf.size) return null;

  const edges = new Map<string, Edge>();
  let trip = '', rows: Row[] = [];
  const flush = () => {
    const route = routeOf.get(trip);
    if (route) {
      rows.sort((a, b) => a.seq - b.seq);
      for (let i = 1; i < rows.length; i++) {
        const a = rows[i - 1], b = rows[i];
        if (a.stop === b.stop) continue;
        const key = `${a.stop}\t${b.stop}`;
        let e = edges.get(key);
        if (!e) edges.set(key, (e = { runs: [], routes: new Map(), trips: 0 }));
        e.trips++;
        e.routes.set(route, (e.routes.get(route) ?? 0) + 1);
        const run = (b.arrive || b.depart) - (a.depart || a.arrive);
        if (run > 0 && run < 3600 && e.runs.length < SAMPLES) e.runs.push(run);
      }
    }
    rows = [];
  };
  // Feeds keep a trip's rows together; the trips this graph skips cost a map lookup each.
  await scanCsv(stopTimes, cell => {
    const t = cell('trip_id');
    if (t !== trip) { flush(); trip = t; }
    if (!routeOf.has(t)) return;
    rows.push({ stop: cell('stop_id'), seq: Number(cell('stop_sequence')), arrive: seconds(cell('arrival_time')) || 0, depart: seconds(cell('departure_time')) || 0 });
  });
  flush();

  const used = new Set<string>();
  for (const key of edges.keys()) for (const s of key.split('\t')) used.add(s);
  const graph: StopGraph = { stops: {}, prev: {} };
  const names: Record<string, string> = {};
  if (routes) await scanCsv(routes, cell => {
    const id = cell('route_id'), name = cell('route_short_name') || cell('route_long_name');
    if (keep(id) && name && name !== id) names[id] = name;
  });
  if (Object.keys(names).length) graph.names = names;
  await scanCsv(stops, cell => {
    const id = cell('stop_id'), lat = Number(cell('stop_lat')), lng = Number(cell('stop_lon'));
    if (used.has(id) && Number.isFinite(lat) && Number.isFinite(lng) && (lat || lng)) graph.stops[id] = [r5(lng), r5(lat), cell('stop_name')];
  });
  const byTo = new Map<string, [string, Edge][]>();
  for (const [key, e] of edges) {
    const [from, to] = key.split('\t');
    if (!graph.stops[from] || !graph.stops[to]) continue;
    byTo.set(to, [...(byTo.get(to) ?? []), [from, e]]);
  }
  for (const [to, list] of byTo) {
    // Each route is named on the run it takes most: NYC's A comes into 145 St express by day and local by night.
    const best = new Map<string, Edge>();
    for (const [, e] of list) for (const [route, n] of e.routes) if (n > (best.get(route)?.routes.get(route) ?? 0)) best.set(route, e);
    graph.prev[to] = list
      .sort((a, b) => b[1].trips - a[1].trips)
      // With one way in, the routes never decide anything.
      .map(([from, e]) => [from, e.runs.length ? median(e.runs) : DEFAULT_RUN_S, list.length > 1 ? [...e.routes.keys()].filter(r => best.get(r) === e).sort().join(' ') : '']);
  }
  return Object.keys(graph.prev).length ? graph : null;
}
