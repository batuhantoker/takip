// The tube's stop graph from TfL's line route sequences: each station once per line and direction, run times
// from the distance (TfL publishes no keyless timetable to time them).
import type { StopGraph } from '../../src/lib/feeds/transit/placement/stop-place';
import { tflStop } from '../../src/lib/feeds/transit/sources/tfl';

const API = 'https://api.tfl.gov.uk';
/** Average tube speed between stations with the stop, in metres per second (~33 km/h). */
const SPEED_MS = 9;
const DWELL_S = 30;

interface Sequence {
  stations?: { id: string; name: string; lat: number; lon: number }[];
  orderedLineRoutes?: { naptanIds: string[] }[];
}

const metres = ([lng1, lat1]: number[], [lng2, lat2]: number[]) => {
  const k = Math.PI / 180, x = (lng2 - lng1) * k * Math.cos(((lat1 + lat2) / 2) * k), y = (lat2 - lat1) * k;
  return Math.hypot(x, y) * 6_371_000;
};

const r5 = (v: number) => Math.round(v * 1e5) / 1e5;

async function json<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`TfL ${path}: HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export async function tflTubeGraph(): Promise<StopGraph> {
  const lines = (await json<{ id: string }[]>('/Line/Mode/tube')).map(l => l.id);
  const graph: StopGraph = { stops: {}, prev: {} };
  for (const line of lines) {
    for (const direction of ['inbound', 'outbound']) {
      const seq = await json<Sequence>(`/Line/${line}/Route/Sequence/${direction}`);
      const at = new Map((seq.stations ?? []).map(s => [s.id, s]));
      for (const route of seq.orderedLineRoutes ?? []) {
        for (let i = 0; i < route.naptanIds.length; i++) {
          const s = at.get(route.naptanIds[i]);
          if (!s) continue;
          const name = s.name.replace(/ Underground Station$/, '');
          graph.stops[s.id] = [r5(s.lon), r5(s.lat), name];
          graph.stops[tflStop(s.id, line, direction)] = [r5(s.lon), r5(s.lat), name];
          const p = at.get(route.naptanIds[i - 1]);
          if (!p) continue;
          const to = tflStop(s.id, line, direction), from = tflStop(p.id, line, direction);
          const edges = (graph.prev[to] ??= []);
          if (!edges.some(e => e[0] === from)) edges.push([from, Math.round(metres([p.lon, p.lat], [s.lon, s.lat]) / SPEED_MS + DWELL_S), '']);
        }
      }
    }
  }
  return graph;
}
