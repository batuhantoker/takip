import type { RtVehicle } from '../gtfs/realtime';
import type { TransitMode } from '../modes';

/**
 * LA Metro Rail, B/D subway included, from api.metro.net's keyless WebSocket: GTFS-RT VehiclePositions as
 * JSON, one message per train, the whole fleet in a burst a few seconds after connecting. Its .pb twin is
 * Swiftly's and needs a key. Terms (developer.metro.net/terms-conditions): credit Metro, no advertising use,
 * no unauthorised redistribution.
 */
export const LAMETRO_RAIL_URL = 'wss://api.metro.net/ws/LACMTA_Rail/vehicle_positions';

/** Route codes to the letters riders know; B and D run underground, the rest are light rail. */
const LINES: Record<string, [string, TransitMode]> = {
  801: ['A', 'tram'], 802: ['B', 'metro'], 803: ['C', 'tram'], 804: ['E', 'tram'], 805: ['D', 'metro'], 807: ['K', 'tram'],
};

interface Message {
  id?: string;
  vehicle?: {
    trip?: { tripId?: string; routeId?: string };
    position?: { latitude?: number; longitude?: number; bearing?: number; speed?: number };
    currentStatus?: string;
    timestamp?: string | number;
    vehicle?: { id?: string; label?: string };
  };
}

const STATUS: Record<string, number> = { INCOMING_AT: 0, STOPPED_AT: 1, IN_TRANSIT_TO: 2 };

/** The latest message per train, revenue trips only: a train with no trip is out of service. */
export function parseLaMetro(messages: readonly unknown[]): RtVehicle[] {
  const latest = new Map<string, RtVehicle>();
  for (const raw of messages) {
    const m = raw as Message, v = m.vehicle;
    const lat = v?.position?.latitude, lng = v?.position?.longitude;
    if (!v?.trip?.tripId || lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const id = v.vehicle?.id || m.id;
    if (!id) continue;
    const [route, mode] = LINES[v.trip.routeId ?? ''] ?? [v.trip.routeId, undefined];
    latest.set(id, {
      id, lat, lng, route, mode, trip: v.trip.tripId, label: v.vehicle?.label,
      bearing: v.position?.bearing, speed: v.position?.speed,
      status: v.currentStatus ? STATUS[v.currentStatus] : undefined,
      t: Number(v.timestamp) || undefined,
    });
  }
  return [...latest.values()];
}

/** Listens until the burst has gone quiet or `maxMs` passes; throws if nothing arrived. */
export function readSocket(url: string, signal: AbortSignal, { maxMs = 8_000, quietMs = 1_500 } = {}): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const messages: unknown[] = [];
    const ws = new WebSocket(url);
    let quiet: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      clearTimeout(quiet);
      clearTimeout(cap);
      signal.removeEventListener('abort', finish);
      ws.close();
      if (messages.length) resolve(messages);
      else reject(new Error(signal.aborted ? 'aborted' : 'no messages'));
    };
    const cap = setTimeout(finish, maxMs);
    signal.addEventListener('abort', finish);
    ws.onmessage = e => {
      try { messages.push(JSON.parse(String(e.data))); } catch { /* not JSON */ }
      clearTimeout(quiet);
      quiet = setTimeout(finish, quietMs);
    };
    ws.onerror = () => finish();
  });
}
