/**
 * TAKIP — pairs the same earthquake across two catalogues (USGS ↔ EMSC).
 *
 * Twins must fall within 120 s, 60 km and 0.8 magnitude of each other, and be each other's
 * nearest candidate, so a swarm of similar events never pairs crosswise.
 */

import { haversine } from '@/lib/geo';

export interface QuakeLike {
  id: string;
  time: number;
  lat: number;
  lng: number;
  magnitude: number;
}

export const TWIN_LIMITS = { seconds: 120, km: 60, magnitude: 0.8 };

/** Each limit counts equally; null when any one is exceeded. */
function score(a: QuakeLike, b: QuakeLike): number | null {
  const dt = Math.abs(a.time - b.time) / 1000;
  if (dt > TWIN_LIMITS.seconds) return null;
  const dm = Math.abs(a.magnitude - b.magnitude);
  if (dm > TWIN_LIMITS.magnitude) return null;
  const km = haversine([a.lng, a.lat], [b.lng, b.lat]);
  if (km > TWIN_LIMITS.km) return null;
  return dt / TWIN_LIMITS.seconds + km / TWIN_LIMITS.km + dm / TWIN_LIMITS.magnitude;
}

function nearest(from: QuakeLike, pool: QuakeLike[]): QuakeLike | null {
  let best: QuakeLike | null = null;
  let bestScore = Infinity;
  for (const candidate of pool) {
    const s = score(from, candidate);
    if (s != null && s < bestScore) {
      best = candidate;
      bestScore = s;
    }
  }
  return best;
}

/** Map of `a` id → `b` id for every mutual-nearest pair. */
export function matchQuakeTwins(a: QuakeLike[], b: QuakeLike[]): Map<string, string> {
  const pairs = new Map<string, string>();
  for (const quake of a) {
    const twin = nearest(quake, b);
    if (twin && nearest(twin, a)?.id === quake.id) pairs.set(quake.id, twin.id);
  }
  return pairs;
}
