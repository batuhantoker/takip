/**
 * Whether a GDELT story and a wire or channel report tell of the same event, so the list can fold one under the
 * other. Titles are compared by their meaningful words, not their wording: the press GDELT reads and the channels
 * rarely share a headline. Kept strict, since a wrong fold hides a story.
 */

const HOUR_MS = 3_600_000;
const WINDOW_MS = 6 * HOUR_MS;
const NEAR_KM = 150;
const MIN_WORDS = 4;
const MIN_SHARED = 3;
const MIN_SHARE = 0.5;

const STOP = new Set([
  'with', 'from', 'that', 'this', 'than', 'then', 'they', 'them', 'their', 'there', 'these', 'those', 'what', 'when', 'where',
  'which', 'while', 'who', 'whom', 'will', 'would', 'could', 'should', 'have', 'been', 'were', 'into', 'onto', 'over', 'under',
  'after', 'before', 'about', 'amid', 'against', 'says', 'said', 'told', 'tells', 'more', 'most', 'some', 'many', 'much', 'also',
  'just', 'only', 'very', 'news', 'live', 'update', 'updates', 'latest', 'breaking', 'report', 'reports', 'video', 'watch', 'today',
  'year', 'years', 'week', 'day', 'days', 'time', 'first', 'last', 'new', 'says', 'reuters', 'says',
]);

/** Lower case, no accents, words of four letters or more, a plural "s" dropped, stopwords out. */
export function eventWords(title: string): Set<string> {
  const words = title.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').split(/[^\p{L}\p{N}]+/u);
  const out = new Set<string>();
  for (const w of words) {
    if (w.length < MIN_WORDS || STOP.has(w)) continue;
    out.add(w.length > 4 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);
  }
  return out;
}

/** `at` is [lat, lng], null when unplaced. */
export interface EventSketch { words: Set<string>; ts: number; at: [number, number] | null }

function km([lat1, lng1]: [number, number], [lat2, lng2]: [number, number]): number {
  const r = Math.PI / 180;
  return 6371 * Math.hypot((lng2 - lng1) * r * Math.cos(((lat1 + lat2) / 2) * r), (lat2 - lat1) * r);
}

export function sameEvent(a: EventSketch, b: EventSketch): boolean {
  if (Math.abs(a.ts - b.ts) > WINDOW_MS) return false;
  if (a.words.size < MIN_WORDS || b.words.size < MIN_WORDS) return false;
  let shared = 0;
  for (const w of a.words) if (b.words.has(w)) shared++;
  if (shared < MIN_SHARED || shared / Math.min(a.words.size, b.words.size) < MIN_SHARE) return false;
  return !(a.at && b.at && km(a.at, b.at) > NEAR_KM);
}
