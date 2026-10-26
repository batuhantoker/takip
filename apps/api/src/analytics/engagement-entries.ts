import type { AppDb } from '../db/app-db';
import { median, personOf } from './engagement-people';
import { visitorNotAdmin, type Range } from './range';

const MAP_PATH = '/';
// As page-visits.ts: views further apart are two visits, and a desktop hop faster than this from a visit's first page is a script.
const VISIT_GAP_MS = 30 * 60_000;
const TOO_FAST_MS = 2_000;

type ViewRow = { visitorId: string; at: number; path: string; device: string; known: number; userId: string | null };

/** page-visits.ts automatedBrowsers on these rows: desktop browsers that never used the map and left a visit's first page in under two seconds. */
function automated(rows: ViewRow[]) {
  const found = new Set<string>();
  rows.forEach((row, i) => {
    const before = rows[i - 1];
    const next = rows[i + 1];
    const begins = before?.visitorId !== row.visitorId || row.at - before.at > VISIT_GAP_MS;
    const hop = next?.visitorId === row.visitorId && next.path !== row.path && row.path !== MAP_PATH && next.path !== MAP_PATH;
    if (begins && hop && row.device === 'desktop' && !row.known && next.at - row.at < TOO_FAST_MS) found.add(row.visitorId);
  });
  return found;
}

// The kind of page a path is: '/city/berlin/cameras' → '/city/*/cameras', the place, event or pair starred; a layer page
// or guide is kept whole, being a kind itself. Paths are English already; the language is kept apart.
export function entryPage(path: string) {
  const [, section = '', entity, topic] = path.split('/');
  if (!entity || section === 'map' || section === 'guides') return path;
  return `/${section}/*${topic ? `/${topic}` : ''}`;
}

export const entrySection = (path: string) => `/${path.split('/')[1] ?? ''}`;

/**
 * Each person's first view in the range (map openings included), scripts left out: where they came in. A browser signed
 * in to an account counts as that account. Also the first day the view log has anything.
 */
export function arrivals(db: AppDb, r: Range) {
  const rows = db.prepare(`
    SELECT p.visitor_id AS visitorId, p.at, p.path, p.device, v.visitor_id IS NOT NULL AS known, v.user_id AS userId
    FROM page_view p LEFT JOIN visitor v ON v.visitor_id = p.visitor_id
    WHERE p.day >= ? ${visitorNotAdmin(r)} ORDER BY p.visitor_id, p.at`).all(r.first) as ViewRow[];
  const scripts = automated(rows);
  const first = new Map<string, ViewRow>();
  for (const row of rows) {
    if (scripts.has(row.visitorId)) continue;
    const person = personOf('v', row.visitorId, row.userId);
    const seen = first.get(person);
    if (!seen || row.at < seen.at) first.set(person, row);
  }
  const since = db.prepare('SELECT min(day) FROM page_view').pluck().get() as number | null;
  return { landed: new Map([...first].map(([person, row]) => [person, row.path])), since };
}

export type Entry = { page: string; people: number; openedMap: number; medianMapMinutes: number | null };

/** Landings by kind of page and by section: how many came in there, how many of them used the map, and their median minutes on it. */
export function entryPoints(landed: Map<string, string>, mapMinutes: Map<string, number>) {
  const group = (keyOf: (path: string) => string): Entry[] => {
    const by = new Map<string, { people: number; minutes: number[] }>();
    for (const [person, path] of landed) {
      const key = keyOf(path);
      const row = by.get(key) ?? by.set(key, { people: 0, minutes: [] }).get(key)!;
      row.people += 1;
      const used = mapMinutes.get(person);
      if (used) row.minutes.push(used);
    }
    return [...by].map(([page, row]) => ({ page, people: row.people, openedMap: row.minutes.length, medianMapMinutes: median(row.minutes) }))
      .sort((a, b) => b.people - a.people || a.page.localeCompare(b.page));
  };
  return { sections: group(entrySection), pages: group(entryPage) };
}
