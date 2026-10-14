import { csvRecords } from '../csv';

export type GedPoint = { lon: number; lat: number };

/** GED where_prec 6 is the country and 7 international waters or airspace: no place of their own. */
const MAX_WHERE_PREC = 5;

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const km = (a: { lon: number; lat: number }, b: { lon: number; lat: number }) => {
  const rad = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lon - a.lon) * rad) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};

/** The event nearest the median point: between two theatres the median can fall in the sea or a desert. */
export function middleEvent(points: GedPoint[]): GedPoint | undefined {
  if (!points.length) return undefined;
  const m = { lon: median(points.map(p => p.lon)), lat: median(points.map(p => p.lat)) };
  let best = points[0];
  let bestKm = Infinity;
  for (const p of points) {
    const d = km(m, p);
    if (d < bestKm) [best, bestKm] = [p, d];
  }
  return best;
}

/** State-based GED events (type 1) by UCDP conflict id, which conflict_new_id carries. */
export async function readGedPoints(path: string): Promise<Map<string, GedPoint[]>> {
  const out = new Map<string, GedPoint[]>();
  for await (const r of csvRecords(path)) {
    if (r.__header__ || r.type_of_violence !== '1' || !(Number(r.where_prec) <= MAX_WHERE_PREC)) continue;
    const lon = Number(r.longitude);
    const lat = Number(r.latitude);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    const list = out.get(r.conflict_new_id) ?? [];
    list.push({ lon, lat });
    out.set(r.conflict_new_id, list);
  }
  return out;
}
