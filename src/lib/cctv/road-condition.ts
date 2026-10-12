/**
 * TAKIP — measured road surface beside a camera, from the station its operator pairs it with.
 * Only operator-declared pairings, never a nearest-neighbour guess, and only when the station is within 10 km
 * and the reading is under 2 hours old. Surface words are passed through as the operator gives them.
 */

export interface RoadCondition {
  /** The operator's own surface word, e.g. "Wet", "Moist", "Dry". */
  surface: string;
  road_temp?: number;
  air_temp?: number;
  observed_at: string;
  station?: string;
  distance_km?: number;
  source: string;
}

export const ROAD_RULE = { maxKm: 10, maxAgeMs: 2 * 3600_000 };

/** null when the reading breaks the rule, or `now` has outlived it. */
export function admitRoadCondition(r: RoadCondition | null | undefined, now = Date.now()): RoadCondition | null {
  if (!r?.surface) return null;
  const at = Date.parse(r.observed_at);
  if (!Number.isFinite(at) || now - at > ROAD_RULE.maxAgeMs || at - now > 10 * 60_000) return null;
  if (r.distance_km != null && r.distance_km > ROAD_RULE.maxKm) return null;
  return r;
}

/** One line for the viewer: "Road wet · surface 7.5 °C · air 7.2 °C · station 3.2 km away · 12 min ago". */
export function roadConditionLine(r: RoadCondition, now = Date.now()): string {
  const mins = Math.max(0, Math.round((now - Date.parse(r.observed_at)) / 60_000));
  return [
    `Road ${r.surface.toLowerCase()}`,
    r.road_temp != null ? `surface ${r.road_temp.toFixed(1)} °C` : null,
    r.air_temp != null ? `air ${r.air_temp.toFixed(1)} °C` : null,
    r.distance_km != null && r.distance_km >= 1 ? `station ${r.distance_km.toFixed(1)} km away` : null,
    mins < 60 ? `${mins} min ago` : `${Math.floor(mins / 60)} h ${mins % 60} min ago`,
  ].filter(Boolean).join(' · ');
}

/** The map flattens feature properties, so the record travels as JSON. */
export function parseRoadCondition(v: unknown): RoadCondition | null {
  if (v && typeof v === 'object') return v as RoadCondition;
  if (typeof v !== 'string' || !v) return null;
  try {
    return JSON.parse(v) as RoadCondition;
  } catch {
    return null;
  }
}
