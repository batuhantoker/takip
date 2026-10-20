/** Counting and ranking for stories: pure, so every number a narrator says is computed here, not by the model. */

export interface Located { t: number; lat: number; lon: number }

/** Where a set of points sits, longitudes averaged on the circle so a Pacific cluster doesn't land in Africa. */
export function centre(points: Located[]): [number, number] | null {
  if (!points.length) return null;
  let x = 0, y = 0, lat = 0;
  for (const p of points) {
    x += Math.cos((p.lon * Math.PI) / 180);
    y += Math.sin((p.lon * Math.PI) / 180);
    lat += p.lat;
  }
  return [lat / points.length, (Math.atan2(y, x) * 180) / Math.PI];
}

/** The centre of the busiest cell of a coarse grid: where a camera should look, unlike an average of far-apart places. */
export function densest(points: Located[], cellDeg = 30): [number, number] | null {
  const cells = new Map<string, Located[]>();
  for (const p of points) {
    const key = `${Math.floor(p.lat / cellDeg)}:${Math.floor(p.lon / cellDeg)}`;
    cells.set(key, [...(cells.get(key) ?? []), p]);
  }
  const busiest = [...cells.values()].sort((a, b) => b.length - a.length)[0];
  return busiest ? centre(busiest) : null;
}

export function countBy<T>(items: T[], key: (item: T) => string | null): [string, number][] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export const yearOf = (ms: number) => new Date(ms).getUTCFullYear();
export const decadeOf = (ms: number) => Math.floor(yearOf(ms) / 10) * 10;

/** Evenly spaced years from `from` to `to`, the inner ones rounded to a step that reads well. */
export function sampleYears(from: number, to: number, n: number): number[] {
  const span = to - from;
  const step = span > 1500 ? 50 : span > 400 ? 25 : span > 120 ? 10 : 5;
  return Array.from({ length: n }, (_, i) => (i === 0 ? from : i === n - 1 ? to : Math.round((from + (span * i) / (n - 1)) / step) * step));
}

export type Ranked = { key: string; value: number };

/** Each key's value in a year from [year, value] points: the point for that year, else none. */
export function valuesAt(series: Record<string, [number, number][]>, year: number): Ranked[] {
  const out: Ranked[] = [];
  for (const [key, points] of Object.entries(series)) {
    const p = points.find(q => q[0] === year);
    if (p && Number.isFinite(p[1])) out.push({ key, value: p[1] });
  }
  return out.sort((a, b) => b.value - a.value);
}

/** A key's place in a ranking, 1 for the top; null when it has no value. */
export const rankOf = (ranking: Ranked[], key: string) => {
  const i = ranking.findIndex(r => r.key === key);
  return i < 0 ? null : i + 1;
};

/** The keys whose value changed most between two rankings, by ratio, among those with a value in both. */
export function movers(a: Ranked[], b: Ranked[], n: number, direction: 'up' | 'down'): { key: string; from: number; to: number }[] {
  const before = new Map(a.map(r => [r.key, r.value]));
  return b.flatMap(r => {
    const from = before.get(r.key);
    return from && from > 0 ? [{ key: r.key, from, to: r.value }] : [];
  }).sort((x, y) => (direction === 'up' ? y.to / y.from - x.to / x.from : x.to / x.from - y.to / y.from)).slice(0, n);
}

/** Numbers as a narrator says them in English: "1.4 billion", "72.5", "3,200". */
export function spokenNumber(v: number, digits = 1) {
  if (Math.abs(v) >= 1e6) return new Intl.NumberFormat('en', { notation: 'compact', compactDisplay: 'long', maximumFractionDigits: digits }).format(v);
  return new Intl.NumberFormat('en', { maximumFractionDigits: Math.abs(v) < 100 ? digits : 0 }).format(v);
}
