import type { RtFeed, RtStopFix } from '../gtfs/realtime';

/**
 * The London Underground from TfL's Unified API: every tube line's next arrivals in one keyless call
 * (~2 MB; anonymous use is limited to about 50 calls a minute). There are no positions, so each train is
 * its soonest station and placed on the 'tfl-tube' stop graph (tools/transit/tfl-graph.ts). Terms:
 * tfl.gov.uk transport data service; "Powered by TfL Open Data".
 */
export const TFL_TUBE_URL = 'https://api.tfl.gov.uk/Mode/tube/Arrivals?count=-1';
export const TFL_TUBE_GRAPH = 'tfl-tube';

interface Arrival {
  vehicleId?: string;
  naptanId?: string;
  lineId?: string;
  lineName?: string;
  direction?: string;
  destinationNaptanId?: string;
  currentLocation?: string;
  timeToStation?: number;
  expectedArrival?: string;
}

/** A station on one line, one way: the graph's stops are keyed so, so a train runs into it from the right side. */
export const tflStop = (naptan: string, line: string, direction: string) => `${naptan}|${line}|${direction}`;

/**
 * One train per line, vehicle id, direction and destination (ids repeat across lines and even across a line),
 * at its soonest station: at the platform, arriving, or between stops on the way there.
 */
export function parseTfl(arrivals: readonly Arrival[], nowS: number): Pick<RtFeed, 'atStops' | 'trips'> {
  const soonest = new Map<string, Arrival & { at: number }>();
  for (const a of arrivals) {
    if (!a.vehicleId || /^0+$/.test(a.vehicleId) || !a.naptanId || !a.lineId || !a.direction) continue;
    const at = Date.parse(a.expectedArrival ?? '') / 1000;
    if (!Number.isFinite(at)) continue;
    const key = [a.lineId, a.vehicleId, a.direction, a.destinationNaptanId].join(':');
    const best = soonest.get(key);
    if (!best || at < best.at) soonest.set(key, { ...a, at });
  }
  const atStops: RtStopFix[] = [];
  const trips: RtFeed['trips'] = new Map();
  for (const [key, a] of soonest) {
    const where = a.currentLocation ?? '';
    const stopId = tflStop(a.naptanId!, a.lineId!, a.direction!);
    const atPlatform = /^at /i.test(where) && a.at - nowS < 60;
    atStops.push({ id: key, trip: key, route: a.lineName ?? a.lineId, stopId, status: atPlatform ? 1 : /^approaching/i.test(where) ? 0 : 2, t: Math.round(nowS) });
    trips.set(key, { route: a.lineName, next: [{ stop: stopId, arrive: Math.round(a.at) }] });
  }
  return { atStops, trips };
}
