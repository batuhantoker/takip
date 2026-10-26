import { dbStamp, readDb, stmt, type Db } from '@/lib/core/read-db';
import { MOUNTAINS_DB, type Mountain, type MountainKind, type MountainPlace } from './data';

/* Reads of data/db/mountains.db (tools/site/build-mountains.ts): key lookups, index ranges and R*Tree boxes only. */

interface Row {
  qid: number; slug: string; kind: MountainKind; names: string; wiki: string; articles: number; lon: number; lat: number;
  elev: number | null; prom: number | null; isol: number | null; parent: number | null; range: number | null; cc: string;
  ascent: string | null; image: string | null; gvp: string | null; highest: string; place: number | null; tz: string | null; indexed: number;
}

const db = () => readDb(MOUNTAINS_DB);

/** Changes whenever the file is replaced, for caches keyed on what it holds. */
export const mountainsStamp = () => dbStamp(MOUNTAINS_DB);

const parse = (r: Row): Mountain => ({
  ...r, names: JSON.parse(r.names), wiki: JSON.parse(r.wiki), cc: r.cc ? r.cc.split(',') : [], highest: JSON.parse(r.highest), indexed: !!r.indexed,
});

const COLUMNS = 'qid, slug, kind, names, wiki, articles, lon, lat, elev, prom, isol, parent, range, cc, ascent, image, gvp, highest, place, tz, indexed';

/** The mountain a slug names, or the slug it moved to; null when no mountain ever had it. */
export function mountainBySlug(slug: string): { mountain: Mountain } | { redirect: string } | null {
  const d = db();
  if (!d) return null;
  const row = stmt(d, `SELECT ${COLUMNS} FROM mountain WHERE slug = ?`).get(slug) as Row | undefined;
  if (row) return { mountain: parse(row) };
  const qid = stmt(d, 'SELECT qid FROM slug WHERE slug = ?').pluck().get(slug) as number | undefined;
  const now = qid === undefined ? undefined : stmt(d, 'SELECT slug FROM mountain WHERE qid = ?').pluck().get(qid) as string | undefined;
  return now ? { redirect: now } : null;
}

export function mountainsByQid(qids: readonly number[]): Map<number, Mountain> {
  const d = db();
  const out = new Map<number, Mountain>();
  if (!d) return out;
  for (const q of new Set(qids)) {
    const row = stmt(d, `SELECT ${COLUMNS} FROM mountain WHERE qid = ?`).get(q) as Row | undefined;
    if (row) out.set(q, parse(row));
  }
  return out;
}

export function placesByQid(qids: readonly number[]): Map<number, MountainPlace> {
  const d = db();
  const out = new Map<number, MountainPlace>();
  if (!d) return out;
  for (const q of new Set(qids)) {
    const row = stmt(d, 'SELECT qid, kind, names, cc FROM place WHERE qid = ?').get(q) as { qid: number; kind: MountainPlace['kind']; names: string; cc: string | null } | undefined;
    if (row) out.set(q, { ...row, names: JSON.parse(row.names) });
  }
  return out;
}

/** Mountains in a box, the best known first. */
export function mountainsIn([w, s, e, n]: [number, number, number, number], limit: number): Mountain[] {
  const d = db();
  if (!d) return [];
  return (stmt(d, `SELECT ${COLUMNS.split(', ').map(c => `m.${c}`).join(', ')} FROM near JOIN mountain m ON m.qid = near.id
    WHERE near.min_x <= ? AND near.max_x >= ? AND near.min_y <= ? AND near.max_y >= ?
    ORDER BY m.indexed DESC, m.articles DESC LIMIT ?`).all(e, w, n, s, limit) as Row[]).map(parse);
}

/** Prominence a summit needs to count as a mountain of its own in a ranking, the usual convention. */
const SEPARATE_M = 300;
/**
 * A summit without a known prominence counts as part of a higher or better-known one this close: Everest's South
 * Summit, and Wikidata's second item for Ararat.
 */
const SAME_MOUNTAIN_DEG = 0.02;

/** Separate mountains only: one with too little prominence, or another peak right beside it, is a summit of another. */
function separate(d: Db, peaks: Mountain[], limit: number): Mountain[] {
  const beside = stmt(d, `SELECT 1 FROM near JOIN mountain m ON m.qid = near.id
    WHERE near.min_x <= ? AND near.max_x >= ? AND near.min_y <= ? AND near.max_y >= ? AND m.qid != ? AND (m.elev > ? OR m.articles > ?) LIMIT 1`);
  return peaks.filter(p => (p.prom !== null ? p.prom >= SEPARATE_M : !beside.get(
    p.lon + SAME_MOUNTAIN_DEG, p.lon - SAME_MOUNTAIN_DEG, p.lat + SAME_MOUNTAIN_DEG, p.lat - SAME_MOUNTAIN_DEG, p.qid, p.elev ?? 0, p.articles,
  ))).slice(0, limit);
}

/** The highest separate mountains in a range. */
export function highestInRange(range: number, limit: number): Mountain[] {
  const d = db();
  return d ? separate(d, (stmt(d, `SELECT ${COLUMNS} FROM mountain WHERE range = ? AND elev IS NOT NULL ORDER BY elev DESC LIMIT ?`).all(range, limit * 3) as Row[]).map(parse), limit) : [];
}

export function rangeSize(range: number): number {
  const d = db();
  return d ? stmt(d, 'SELECT count(*) FROM mountain WHERE range = ?').pluck().get(range) as number : 0;
}

/** The highest separate mountains in a country. */
export function highestInCountry(cc: string, limit: number, indexedOnly = false): Mountain[] {
  const d = db();
  if (!d) return [];
  const qids = stmt(d, `SELECT qid FROM in_country WHERE cc = ? ${indexedOnly ? 'AND indexed = 1' : ''} ORDER BY elev DESC LIMIT ?`).pluck().all(cc, limit * 3) as number[];
  const found = mountainsByQid(qids);
  return separate(d, qids.flatMap(q => found.get(q) ?? []), limit);
}

/** Peaks whose parent this is. */
export function childPeaks(parent: number, limit: number): Mountain[] {
  const d = db();
  return d ? (stmt(d, `SELECT ${COLUMNS} FROM mountain WHERE parent = ? ORDER BY elev DESC LIMIT ?`).all(parent, limit) as Row[]).map(parse) : [];
}

/** The world's highest separate mountains, measured and indexed. */
export function highestOnEarth(limit: number): Mountain[] {
  const d = db();
  return d ? separate(d, (stmt(d, `SELECT ${COLUMNS} FROM mountain WHERE indexed = 1 ORDER BY elev DESC LIMIT ?`).all(limit * 3) as Row[]).map(parse), limit) : [];
}

/** For the sitemaps: how many pages are indexed, and a run of their slugs by sitemap order. */
export function indexedCount(): number {
  const d = db();
  return Number((d && stmt(d, "SELECT v FROM meta WHERE k = 'indexed'").pluck().get() as string | undefined) ?? 0);
}

export function indexedSlugs(from: number, to: number): string[] {
  const d = db();
  return d ? stmt(d, 'SELECT slug FROM mountain WHERE seq >= ? AND seq < ? ORDER BY seq').pluck().all(from, to) as string[] : [];
}

/** Each country's count of measured mountains (indexed ones apart) and its highest. */
export function countrySummaries(): { cc: string; n: number; indexed: number; top: number }[] {
  const d = db();
  // SQLite gives a bare column the row max() picked: the highest's id.
  return d ? stmt(d, 'SELECT cc, count(*) AS n, sum(indexed) AS indexed, qid AS top, max(elev) FROM in_country GROUP BY cc ORDER BY n DESC').all() as { cc: string; n: number; indexed: number; top: number }[] : [];
}

/** Mountains that are the highest point of somewhere. */
export function placeSummits(): Mountain[] {
  const d = db();
  return d ? (stmt(d, `SELECT ${COLUMNS} FROM mountain WHERE highest != '[]' ORDER BY elev DESC`).all() as Row[]).map(parse) : [];
}
