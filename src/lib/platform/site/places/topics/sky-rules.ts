/**
 * Which places get an ISS or aurora page, and which of those are indexed. A page that renders but is not
 * indexed is noindex and stays out of the sitemap. tools/site/topics/sky.ts applies these to every place and
 * stores the result in sky.generated.ts; a threshold change is a rerun of the tool.
 *
 * ISS: every place gets a page, since "never above 10° here" is a true answer. It is indexed when the
 * place has 100,000 people or more, the station can climb at least 10° over it, and no more populous indexed
 * place lies within 25 km (within that the passes are the same to the minute, so the pages would be too).
 *
 * Aurora: a page wherever the corrected geomagnetic latitude is 50° or more, north or south: there the
 * aurora shows in strong storms. Indexed from 55° in the north, where it shows low in the sky on active nights
 * (Oslo, Helsinki), and from 51.5° in the south, thinned the same way within 50 km, about half an OVATION cell.
 */

export const SKY_RULES = {
  /** Degrees above the horizon that count as a pass, as on the map's pass list. */
  issMinElevation: 10,
  issIndexPopulation: 100_000,
  issNeighbourKm: 25,
  auroraPageMlat: 50,
  auroraIndexMlat: 55,
  // Few people live that far south; Tasmania and southern New Zealand are where the southern lights are watched.
  auroraIndexMlatSouth: 51.5,
  auroraNeighbourKm: 50,
} as const;

const RAD = Math.PI / 180;
const EARTH_KM = 6371;
const WGS84_A = 6378.137;
const WGS84_B = 6356.752;
/** The station's orbit: its inclination, and its distance from Earth's centre, about 420 km up. */
const ISS_INCLINATION = 51.64;
const ISS_ORBIT_KM = 6797;

/**
 * The highest the station can ever climb over a place, in degrees, from the orbit's geometry alone: its
 * ground track never goes poleward of the inclination, so further out it stays low on the horizon.
 */
export function issBestElevation(lat: number): number {
  const geocentric = Math.atan((WGS84_B / WGS84_A) ** 2 * Math.tan(Math.abs(lat) * RAD));
  const gap = Math.max(0, geocentric - ISS_INCLINATION * RAD);
  if (gap === 0) return 90;
  const radius = Math.hypot(WGS84_A * Math.cos(geocentric), WGS84_B * Math.sin(geocentric));
  return Math.atan2(Math.cos(gap) - radius / ISS_ORBIT_KM, Math.sin(gap)) / RAD;
}

export const issReaches = (lat: number) => issBestElevation(lat) >= SKY_RULES.issMinElevation;

/** Before thinning out neighbours. */
export const issIndexCandidate = (p: { lat: number; pop: number }) => p.pop >= SKY_RULES.issIndexPopulation && issReaches(p.lat);

export const auroraHasPage = (mlat: number) => Math.abs(mlat) >= SKY_RULES.auroraPageMlat;

/** Before thinning out neighbours. */
export const auroraIndexCandidate = (mlat: number) => (mlat >= 0 ? mlat >= SKY_RULES.auroraIndexMlat : -mlat >= SKY_RULES.auroraIndexMlatSouth);

export interface Spot { id: number; lat: number; lng: number; pop: number }

export function kmBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = (b.lat - a.lat) * RAD, dLng = (b.lng - a.lng) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The most populous first, each kept unless a kept place lies within `km`. Ties go to the lower id. */
export function thinOut(spots: Spot[], km: number): Set<number> {
  const kept: Spot[] = [];
  const cell = km / 111;
  const grid = new Map<string, Spot[]>();
  const key = (lat: number, lng: number) => `${Math.floor(lat / cell)},${Math.floor(lng / cell)}`;
  for (const s of [...spots].sort((a, b) => b.pop - a.pop || a.id - b.id)) {
    const row = Math.floor(s.lat / cell);
    // Longitude cells shrink toward the poles, so search as many as a degree of latitude spans there.
    const span = Math.ceil(1 / Math.max(Math.cos(Math.min(89, Math.abs(s.lat) + cell) * RAD), 1e-3));
    const col = Math.floor(s.lng / cell);
    let near = false;
    for (let r = row - 1; r <= row + 1 && !near; r++) {
      for (let c = col - span; c <= col + span && !near; c++) {
        near = (grid.get(`${r},${c}`) ?? []).some(k => kmBetween(k, s) < km);
      }
    }
    // Neighbours across the antimeridian are rare enough among cities to ignore.
    if (near) continue;
    kept.push(s);
    const k = key(s.lat, s.lng);
    grid.set(k, [...(grid.get(k) ?? []), s]);
  }
  return new Set(kept.map(s => s.id));
}
