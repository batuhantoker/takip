/*
 * Laying the near-real-time aircraft around the view (/api/flights/nearby, seconds old) over the global
 * snapshot (/api/flights, 90 s old or more): a nearby row replaces the same aircraft's global row, in the
 * bucket its category puts it in, and is marked `near` so the map draws every one of them.
 */

export const FLIGHT_BUCKET_KEYS = ['commercial_flights', 'private_flights', 'private_jets', 'military_flights'] as const;
export type FlightBucketKey = (typeof FLIGHT_BUCKET_KEYS)[number];

type Row = { icao24?: string; category?: string; [k: string]: unknown };
export type FlightBuckets = Partial<Record<FlightBucketKey, Row[]>>;

/** The same split /api/flights makes. */
export function bucketFor(category: unknown): FlightBucketKey {
  if (category === 'military') return 'military_flights';
  if (category === 'jet') return 'private_jets';
  if (category === 'private') return 'private_flights';
  return 'commercial_flights';
}

/** Nearby zoom: below it the 250 nm circle is a small part of the view, and the global snapshot carries it. */
export const NEARBY_MIN_ZOOM = 5;

export function mergeNearby(data: FlightBuckets, nearby: Row[]): Record<FlightBucketKey, Row[]> {
  const ids = new Set(nearby.map(r => r.icao24).filter(Boolean));
  const out = Object.fromEntries(FLIGHT_BUCKET_KEYS.map(k => [k, (data[k] ?? []).filter(r => !r.near && !ids.has(r.icao24))])) as Record<FlightBucketKey, Row[]>;
  for (const row of nearby) out[bucketFor(row.category)].push({ ...row, near: true });
  return out;
}
