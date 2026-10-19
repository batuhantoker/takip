import { UNDERWAY_KNOTS } from './ship-filter';

/** `/api/maritime?near=…` counts within this radius when no `km` is given, and never beyond NEAR_MAX_KM. */
export const NEAR_DEFAULT_KM = 10;
/** The reach the route gives a chokepoint's live count. */
export const NEAR_MAX_KM = 100;

export interface NearQuery { lat: number; lng: number; km: number }

/** The ships within `km` of a point: how many, how many under way, and how many of each class. */
export interface NearCount { km: number; total: number; underway: number; types: Record<string, number> }

/** `near=<lat>,<lng>&km=<n>` from a query string: null without `near`, an error when it doesn't parse. */
export function parseNear(params: URLSearchParams): NearQuery | null | { error: string } {
  const near = params.get('near');
  if (near === null) return null;
  const parts = near.split(',').map(p => p.trim());
  const [lat, lng] = parts.map(Number);
  if (parts.length !== 2 || parts.some(p => !p) || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return { error: 'near must be <lat>,<lng> in degrees' };
  }
  const kmText = params.get('km');
  const km = kmText === null ? NEAR_DEFAULT_KM : Number(kmText);
  if (!Number.isFinite(km) || km <= 0) return { error: 'km must be a positive number' };
  return { lat, lng, km: Math.min(km, NEAR_MAX_KM) };
}

export function countNear(ships: Iterable<{ lat: number; lng: number; speed?: number; type?: string }>, q: NearQuery): NearCount {
  const cos = Math.cos((q.lat * Math.PI) / 180);
  const r2 = (q.km / 111.32) ** 2;
  let total = 0, underway = 0;
  const types: Record<string, number> = {};
  for (const s of ships) {
    const dx = (s.lng - q.lng) * cos, dy = s.lat - q.lat;
    if (dx * dx + dy * dy > r2) continue;
    total++;
    if ((s.speed ?? 0) >= UNDERWAY_KNOTS) underway++;
    const type = s.type ?? 'other';
    types[type] = (types[type] ?? 0) + 1;
  }
  return { km: q.km, total, underway, types };
}
