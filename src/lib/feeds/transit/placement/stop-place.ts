import type { RtFeed, RtStopFix, RtVehicle } from '../gtfs/realtime';

/** A rail system's stops and the runs between them, from its static GTFS (tools/transit/stop-graphs.ts). */
export interface StopGraph {
  /** stop_id → [lng, lat, name]. */
  stops: Record<string, [number, number, string]>;
  /** stop_id → where trains reach it from: [stop_id, scheduled run in seconds, the routes that run it, space-separated]. */
  prev: Record<string, [string, number, string][]>;
  /** route_id → the name riders know, where the id is an internal one ("IDFM:C01371" → "1"). */
  names?: Record<string, string>;
}

const STOPPED_AT = 1, INCOMING_AT = 0, IN_TRANSIT_TO = 2;
/** Never quite at either end while in transit, so a moving train doesn't read as stopped. */
const MIN_SHARE = 0.05, MAX_SHARE = 0.95;

const rad = (d: number) => (d * Math.PI) / 180;

function bearingOf([lng1, lat1]: readonly [number, number, ...unknown[]], [lng2, lat2]: readonly [number, number, ...unknown[]]): number {
  const y = Math.sin(rad(lng2 - lng1)) * Math.cos(rad(lat2));
  const x = Math.cos(rad(lat1)) * Math.sin(rad(lat2)) - Math.sin(rad(lat1)) * Math.cos(rad(lat2)) * Math.cos(rad(lng2 - lng1));
  return Math.round(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360);
}

/** The run a trip takes into `stopId`: the edge its route runs, else the busiest one. */
function edgeInto(graph: StopGraph, f: RtStopFix) {
  const edges = graph.prev[f.stopId];
  if (!edges?.length) return null;
  return (f.route && edges.find(e => e[2].split(' ').includes(f.route!))) || edges[0];
}

/**
 * Trains from trip updates alone, for a feed that sends no vehicle positions (BART, Paris): each trip under
 * way is at the stop it has reached and not yet left, or heading to the next one. A trip still waiting at its
 * first stop (stop_sequence 0 or 1) hasn't started and is left out; so is one past its last listed stop.
 */
export function fixesFromTrips(trips: RtFeed['trips'], nowS: number, feedTime?: number): RtStopFix[] {
  const out: RtStopFix[] = [];
  for (const [trip, t] of trips) {
    const next = t.next.find(s => (s.depart ?? s.arrive)! > nowS);
    if (!next) continue;
    const at = next.arrive != null && next.arrive <= nowS;
    if (!at && !t.left && next.seq != null && next.seq <= 1 && t.next[0] === next) continue;
    // A stop between the one the feed says was left and `next` was passed since the feed was made.
    const prev = t.next[t.next.indexOf(next) - 1] ?? t.left;
    out.push({
      id: trip, trip, route: t.route, stopId: next.stop, status: at ? STOPPED_AT : IN_TRANSIT_TO, t: feedTime,
      fromId: prev?.stop, left: prev && (prev.depart ?? prev.arrive),
    });
  }
  return out;
}

/** The feed's stop-only vehicles; from its trip updates when it sends no vehicles at all. */
export const stopFixes = (m: RtFeed, nowS: number): RtStopFix[] =>
  m.vehicles.length || m.atStops.length ? m.atStops : fixesFromTrips(m.trips, nowS, m.timestamp);

/**
 * Where each stop-only vehicle is: at its stop when stopped there, else along the straight line from the stop
 * before, as far as its times say: left at one, due at the other, or the scheduled run when only the arrival is
 * known, or halfway with neither. An estimate, marked so.
 */
export function placeAtStops(fixes: readonly RtStopFix[], trips: RtFeed['trips'], graph: StopGraph, nowS: number): RtVehicle[] {
  const out: RtVehicle[] = [];
  for (const f of fixes) {
    const to = graph.stops[f.stopId];
    if (!to) continue;
    const listed = f.fromId ? graph.stops[f.fromId] : undefined;
    const edge = listed ? null : edgeInto(graph, f);
    const from = listed ?? (edge ? graph.stops[edge[0]] : undefined);
    const base = { id: f.id, route: f.route, line: f.route ? graph.names?.[f.route] : undefined, trip: f.trip, label: f.label, t: f.t, status: f.status, stop: to[2], estimated: true };
    if (!from || f.status === STOPPED_AT) {
      out.push({ ...base, lng: to[0], lat: to[1], bearing: from ? bearingOf(from, to) : undefined });
      continue;
    }
    const times = f.trip ? trips.get(f.trip) : undefined;
    const arrive = times?.next.find(s => s.stop === f.stopId)?.arrive;
    let share = 0.5;
    if (arrive != null && listed && f.left != null && arrive > f.left) share = (nowS - f.left) / (arrive - f.left);
    else if (arrive != null && edge) share = 1 - (arrive - nowS) / Math.max(edge[1], 30);
    if (f.status === INCOMING_AT) share = Math.max(share, 0.85);
    share = Math.min(MAX_SHARE, Math.max(MIN_SHARE, share));
    out.push({
      ...base, from: from[2],
      lng: from[0] + (to[0] - from[0]) * share, lat: from[1] + (to[1] - from[1]) * share,
      bearing: bearingOf(from, to),
    });
  }
  return out;
}
