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

/** Great-circle distance in degrees. */
export function arc(a: [number, number], b: [number, number]) {
  const r = Math.PI / 180;
  const h = Math.sin(((b[0] - a[0]) * r) / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(((b[1] - a[1]) * r) / 2) ** 2;
  return (2 * Math.asin(Math.min(1, Math.sqrt(h)))) / r;
}

/** Four-digit numbers in a line, not parts of "15,000" or "7.5". */
export const yearsSaid = (line: string) => (line.match(/(?<![\d,.])\d{4}(?!\d|[.,]\d)/g) ?? []).map(Number);
/** Years said as a span ("1970 to 1984", "1970–1984"): the stretch, not an event in it. */
export const spanYears = (line: string) => [...line.matchAll(/(\d{4})\s*(?:–|-|to|and)\s*(\d{4})/g)].flatMap(m => [+m[1], +m[2]]);
/** Capitalised names in a line ("Lop Nor", "Soviet Union"), without the words a sentence starts with. */
const NOT_NAMES = new Set(['The', 'Then', 'Now', 'At', 'In', 'On', 'One', 'And', 'But', 'By', 'From', 'Just', 'Its', 'This', 'That', 'Over', 'Today', 'First', 'Then']);
const namesIn = (line: string) => (line.match(/\b\p{Lu}[\p{L}-]*(?:\s+\p{Lu}[\p{L}-]*)*/gu) ?? [])
  .map(n => n.split(/\s+/).filter(w => !NOT_NAMES.has(w)).join(' ')).filter(n => n.length >= 4);

/** Words of at least five letters in a title, lower-cased. */
const titleWords = (title?: string) => (title ?? '').toLowerCase().split(/[^\p{L}]+/u).filter(w => w.length >= 5);

/**
 * The event a line names: the biggest whose year it says (not a span like "1970 to 1984"), else the biggest whose
 * description holds a name the line says ("the biggest at Lop Nor"), else the biggest of a year it says whose title
 * shares a word with the line ("2004 … Sumatra"), leaving out words most of the stretch's titles share ("tsunami").
 * `bounds` only matter as a span: a stretch's end year said alone is the year of an event in it.
 */
export function namedIn<T extends Located & { title?: string }>(line: string, bounds: number[], biggest: T[], { rows = [], size, describe }: {
  rows?: T[]; size?: (e: T) => number; describe?: (e: T) => string;
} = {}): T | undefined {
  const spans = spanYears(line);
  const said = yearsSaid(line).filter(y => !spans.includes(y) || !bounds.includes(y));
  const top = biggest.find(e => said.includes(yearOf(e.t)))
    ?? (describe ? biggest.find(e => namesIn(line).some(n => describe(e).includes(n))) : undefined);
  if (top || !said.length) return top;
  const common = countBy(rows.flatMap(e => [...new Set(titleWords(e.title))]), w => w).filter(([, n]) => n > rows.length / 2).map(([w]) => w);
  const lower = line.toLowerCase();
  return rows.filter(e => said.includes(yearOf(e.t)) && titleWords(e.title).some(w => !common.includes(w) && lower.includes(w)))
    .sort((a, b) => (size ? size(b) - size(a) : 0))[0];
}

/**
 * Where a stretch's camera looks, following its line: around the event it names (namedIn), else at the first place it
 * names, else around the biggest (the one its chip shows), else the densest part. A test site that leads every stretch
 * would otherwise hold the camera while the narrator talks about somewhere else.
 */
export function focus<T extends Located & { title?: string }>(rows: T[], line: string, { bounds, biggest, place, size, describe }: {
  bounds: number[]; biggest: T[]; place: (e: T) => string | null; size?: (e: T) => number; describe?: (e: T) => string;
}): [number, number] | null {
  const named = namedIn(line, bounds, biggest, { rows, size, describe });
  if (named) return centre(rows.filter(e => arc([named.lat, named.lon], [e.lat, e.lon]) <= 25));
  const lower = line.toLowerCase();
  const places = countBy(rows, place).map(([k]) => k).filter(k => lower.includes(k.toLowerCase()));
  const first = places.sort((a, b) => lower.indexOf(a.toLowerCase()) - lower.indexOf(b.toLowerCase()))[0];
  if (first) return densest(rows.filter(e => place(e) === first));
  const top = biggest[0];
  return top ? centre(rows.filter(e => arc([top.lat, top.lon], [e.lat, e.lon]) <= 25)) : densest(rows);
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
