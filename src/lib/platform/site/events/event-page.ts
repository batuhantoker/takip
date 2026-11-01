import { stmt } from '@/lib/core/read-db';
import { searchScope } from '../search-scope';
import { buildStamp, historyDb, pagesDb } from './store';

/**
 * One event's page, read from the slug index (event-pages.db) and history.db: the event, every source that has it
 * (its duplicates), the war it was part of, what it includes, related and nearby events. Each read is a key lookup;
 * the result is held per slug, so a page asked for again doesn't read at all.
 */

/** A row of event-pages.db's event table. */
export interface IndexRow {
  key: string;
  event_id: number;
  canonical_id: number;
  slug: string;
  indexed: number;
  seq: number | null;
  sources: number;
  wiki: string | null;
  title: string | null;
  kind: string;
  family: string;
  source_id: number;
  t_start: number;
  prec: number;
  lon: number | null;
  lat: number | null;
  magnitude: number | null;
}

/** Another event, as a line in a list. Times are epoch seconds, as History's popup takes them. */
export interface EventRef {
  slug: string;
  title: string | null;
  kind: string;
  family: string;
  t0: number;
  prec: number;
  magnitude: number | null;
  indexed: boolean;
}

export interface EventSource {
  code: string;
  name: string;
  owner: string | null;
  url: string | null;
  licence: string | null;
  licenceUrl: string | null;
  attribution: string | null;
  /** The source's own page for this record. */
  recordUrl: string | null;
  /** The event as this source names it. */
  title: string | null;
}

export interface EventPage {
  slug: string;
  indexed: boolean;
  id: number;
  title: string | null;
  kind: string;
  family: string;
  /** Epoch seconds, as History's popup takes them. */
  t0: number;
  t1: number;
  tStart: number;
  tEnd: number | null;
  prec: number;
  endPrec: number | null;
  ongoing: number;
  lon: number | null;
  lat: number | null;
  geoPrec: number;
  magnitude: number | null;
  attrs: Record<string, unknown>;
  /** The Wikipedia article the page shows ("fr:Titre" for another Wikipedia). */
  wiki: string | null;
  sources: EventSource[];
  partOf: EventRef[];
  parts: { total: number; shown: EventRef[] };
  related: { total: number; shown: EventRef[] };
  nearby: EventRef[];
}

export type EventLookup = { page: EventPage } | { redirect: string } | null;

export const PARTS_SHOWN = 40;
const RELATED_SHOWN = 12;
const NEARBY_SHOWN = 8;
const NEAR_DEG = 4;

export const ref = (r: IndexRow): EventRef => ({
  slug: r.slug, title: r.title, kind: r.kind, family: r.family, t0: r.t_start / 1000, prec: r.prec, magnitude: r.magnitude, indexed: r.indexed === 1 && searchScope('/event'),
});

const yearOf = (ms: number) => new Date(ms).getUTCFullYear();

const httpUrl = (v: unknown) => (typeof v === 'string' && /^https?:\/\/\S+$/.test(v) ? v : null);

type Db = NonNullable<ReturnType<typeof pagesDb>>;

const byEventId = (pages: Db, id: number) => stmt(pages, 'SELECT * FROM event WHERE event_id = ?').get(id) as IndexRow | undefined;

/** The canonical row for a row that may be a duplicate. */
const canonicalOf = (pages: Db, r: IndexRow) => (r.canonical_id === r.event_id ? r : byEventId(pages, r.canonical_id));

/** history.db ids as index rows, through their keys, so an index built before a re-import still names the right events. */
function rowsFor(h: Handles, ids: number[]): IndexRow[] {
  if (!ids.length) return [];
  const found = stmt(h.history, 'SELECT e.source_id AS sourceId, e.source_record_id AS record FROM ev_event e WHERE e.event_id IN (SELECT value FROM json_each(?))')
    .all(JSON.stringify(ids)) as { sourceId: number; record: string }[];
  const keys = found.flatMap(f => (h.codes.has(f.sourceId) ? [`${h.codes.get(f.sourceId)}:${f.record}`] : []));
  const rows = stmt(h.pages, 'SELECT e.* FROM event e WHERE e.key IN (SELECT value FROM json_each(?))').all(JSON.stringify(keys)) as IndexRow[];
  const seen = new Set<string>();
  return rows.map(r => canonicalOf(h.pages, r)).filter((r): r is IndexRow => !!r && !seen.has(r.slug) && !!seen.add(r.slug));
}

const byDate = (a: IndexRow, b: IndexRow) => a.t_start - b.t_start || a.event_id - b.event_id;

function nearby(pages: Db, r: IndexRow, skip: Set<string>): EventRef[] {
  if (r.lon === null || r.lat === null) return [];
  const year = yearOf(r.t_start);
  // Ancient dates are loose, so the window widens with age: ±5 years for the 20th century, ±100 around 0 CE.
  const span = Math.min(200, Math.max(5, (2030 - year) / 20));
  const found = stmt(pages, `
    SELECT e.* FROM near n JOIN event e ON e.event_id = n.id
    WHERE n.min_x <= ? AND n.max_x >= ? AND n.min_y <= ? AND n.max_y >= ? AND n.min_t <= ? AND n.max_t >= ? LIMIT 400
  `).all(r.lon + NEAR_DEG, r.lon - NEAR_DEG, r.lat + NEAR_DEG, r.lat - NEAR_DEG, year + span, year - span) as IndexRow[];
  const cos = Math.cos((r.lat * Math.PI) / 180);
  const score = (o: IndexRow) => (((o.lon! - r.lon!) * cos) / NEAR_DEG) ** 2 + ((o.lat! - r.lat!) / NEAR_DEG) ** 2 + ((yearOf(o.t_start) - year) / span) ** 2;
  return found.filter(o => o.slug !== r.slug && !skip.has(o.slug)).sort((a, b) => score(a) - score(b)).slice(0, NEARBY_SHOWN).map(ref);
}

type HistoryRow = {
  id: number; sourceId: number; record: string; canonical: number; title: string | null; tStart: number; tEnd: number | null; t0: number; t1: number;
  prec: number; endPrec: number | null; ongoing: number; geoPrec: number; magnitude: number | null; attrs: string; retracted: number | null;
};

const EVENT_COLS = `e.event_id AS id, e.source_id AS sourceId, e.source_record_id AS record, e.canonical_id AS canonical, e.title,
  e.t_start AS tStart, e.t_end AS tEnd, e.t_lo AS t0, e.t_hi AS t1, e.t_start_prec AS prec, e.t_end_prec AS endPrec, e.ongoing,
  e.geo_prec AS geoPrec, e.magnitude, e.attrs, e.retracted_at AS retracted`;

function readPage(h: Handles, row: IndexRow): EventPage | null {
  const { pages, history } = h;
  const record = row.key.slice(row.key.indexOf(':') + 1);
  let e = stmt(history, `SELECT ${EVENT_COLS} FROM ev_event e WHERE e.event_id = ?`).get(row.event_id) as HistoryRow | undefined;
  // An index older than history.db's last rebuild: find the event by its source's own id instead.
  if (!e || e.sourceId !== row.source_id || e.record !== record) {
    e = stmt(history, `SELECT ${EVENT_COLS} FROM ev_event e WHERE e.source_id = ? AND e.source_record_id = ?`).get(row.source_id, record) as HistoryRow | undefined;
  }
  if (!e || e.retracted !== null) return null;
  const attrs = JSON.parse(e.attrs) as Record<string, unknown>;

  const dupes = stmt(history, `SELECT e.source_id AS sourceId, e.title, e.attrs ->> 'url' AS url FROM ev_event e
    WHERE e.canonical_id = ? AND e.event_id != ? AND e.retracted_at IS NULL ORDER BY e.event_id`).all(e.id, e.id) as { sourceId: number; title: string | null; url: string | null }[];
  const sourceRow = (id: number) => stmt(pages, 'SELECT * FROM source WHERE source_id = ?').get(id) as
    { code: string; name: string; owner: string | null; url: string | null; licence: string | null; licence_url: string | null; attribution: string | null } | undefined;
  const sources: EventSource[] = [];
  for (const d of [{ sourceId: e.sourceId, title: e.title, url: httpUrl(attrs.url) }, ...dupes]) {
    const s = sourceRow(d.sourceId);
    if (!s || sources.some(x => x.code === s.code)) continue;
    sources.push({
      code: s.code, name: s.name, owner: s.owner, url: httpUrl(s.url), licence: s.licence, licenceUrl: httpUrl(s.licence_url),
      attribution: s.attribution, recordUrl: httpUrl(d.url), title: d.title,
    });
  }

  const rel = stmt(history, `
    SELECT rel, to_id AS other, 'out' AS dir FROM ev_event_relation WHERE from_id = ? AND rel IN ('part_of', 'related')
    UNION ALL SELECT rel, from_id, 'in' FROM ev_event_relation WHERE to_id = ? AND rel IN ('part_of', 'related')
  `).all(e.id, e.id) as { rel: string; other: number; dir: 'in' | 'out' }[];
  const ids = (which: (r: (typeof rel)[number]) => boolean) => [...new Set(rel.filter(which).map(r => r.other))];
  const partOf = rowsFor(h, ids(r => r.rel === 'part_of' && r.dir === 'out')).sort(byDate);
  const parts = rowsFor(h, ids(r => r.rel === 'part_of' && r.dir === 'in')).sort(byDate);
  const related = rowsFor(h, ids(r => r.rel === 'related')).filter(r => r.slug !== row.slug).sort(byDate);
  const listed = new Set([...partOf, ...parts.slice(0, PARTS_SHOWN), ...related.slice(0, RELATED_SHOWN)].map(r => r.slug));

  return {
    slug: row.slug, indexed: row.indexed === 1, id: e.id, title: e.title, kind: row.kind, family: row.family,
    t0: e.t0 / 1000, t1: e.t1 / 1000, tStart: e.tStart / 1000, tEnd: e.tEnd === null ? null : e.tEnd / 1000, prec: e.prec, endPrec: e.endPrec,
    ongoing: e.ongoing, lon: row.lon, lat: row.lat, geoPrec: e.geoPrec, magnitude: e.magnitude, attrs, wiki: row.wiki, sources,
    partOf: partOf.map(ref),
    parts: { total: parts.length, shown: parts.slice(0, PARTS_SHOWN).map(ref) },
    related: { total: related.length, shown: related.slice(0, RELATED_SHOWN).map(ref) },
    nearby: nearby(pages, row, listed),
  };
}

type Handles = { pages: Db; history: Db; stamp: string; codes: Map<number, string> };

let codes: { stamp: string; map: Map<number, string> } | null = null;

function handles(): Handles | null {
  const pages = pagesDb();
  const history = historyDb();
  if (!pages || !history) return null;
  const stamp = buildStamp();
  if (codes?.stamp !== stamp) {
    const rows = stmt(pages, 'SELECT source_id, code FROM source').all() as { source_id: number; code: string }[];
    codes = { stamp, map: new Map(rows.map(r => [r.source_id, r.code])) };
  }
  return { pages, history, stamp, codes: codes.map };
}

const MEMO_MAX = 2_000;
const MEMO_MS = 30 * 60_000;
const memo = new Map<string, { at: number; stamp: string; value: EventLookup }>();

function remember(key: string, stamp: string, value: EventLookup) {
  if (memo.size >= MEMO_MAX) memo.delete(memo.keys().next().value!);
  memo.set(key, { at: Date.now(), stamp, value });
  return value;
}

/** The page a slug names, where to send a slug that has moved (a renamed or merged event), or null. */
export function findEvent(slug: string): EventLookup {
  const h = handles();
  if (!h) return null;
  const held = memo.get(slug);
  if (held && held.stamp === h.stamp && Date.now() - held.at < MEMO_MS) return held.value;
  const hit = stmt(h.pages, 'SELECT e.* FROM slug s JOIN event e ON e.key = s.key WHERE s.slug = ?').get(slug) as IndexRow | undefined;
  const row = hit && canonicalOf(h.pages, hit);
  if (!row) return remember(slug, h.stamp, null);
  if (row.slug !== slug) return remember(slug, h.stamp, { redirect: row.slug });
  const page = readPage(h, row);
  return remember(slug, h.stamp, page && { page });
}

/** The slug for a History event id (the map's popups know ids, not slugs). */
export function slugForEventId(id: number): string | null {
  const h = handles();
  return (h && rowsFor(h, [id])[0]?.slug) ?? null;
}
