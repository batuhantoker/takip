// The index behind /event/<slug>: every event in history.db with its slug, whether search should see it, and what
// its page lists without opening history.db (titles, years and places of related and nearby events). Writes
// data/db/event-pages.db next to history.db, which it must match; run it after every import:
//
//   nice npx tsx tools/site/build-event-pages.ts
//
// Reads history.db and catalog.db read-only and the previous event-pages.db, whose slugs it keeps (plan.ts says how
// slugs are given and never moved). The new file is written beside the old and renamed over it, so a running server
// never reads half a file; it notices the new one within a minute (src/lib/platform/site/events/store.ts).
import { existsSync, renameSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import Database from 'better-sqlite3';
import { KINDS } from '../../src/lib/history/popup';
import { emptyLedger, type EventRow, type Ledger, planPages, yearOf } from './events/plan';

const DATA = resolve(process.env.TAKIP_DATA_DIR ?? 'data');
const DB = join(DATA, 'db');
export const OUT = join(DB, 'event-pages.db');

const SCHEMA = `
  CREATE TABLE event (
    key TEXT PRIMARY KEY, event_id INTEGER NOT NULL UNIQUE, canonical_id INTEGER NOT NULL, slug TEXT NOT NULL, base TEXT NOT NULL,
    indexed INTEGER NOT NULL, seq INTEGER, sources INTEGER NOT NULL, wiki TEXT,
    title TEXT, kind TEXT NOT NULL, family TEXT NOT NULL, source_id INTEGER NOT NULL, t_start INTEGER NOT NULL, prec INTEGER NOT NULL,
    lon REAL, lat REAL, magnitude REAL
  ) STRICT;
  CREATE INDEX event_canonical ON event (canonical_id);
  CREATE UNIQUE INDEX event_seq ON event (seq) WHERE seq IS NOT NULL;
  CREATE INDEX event_kind_t ON event (kind, t_start);
  CREATE INDEX event_kind_indexed_t ON event (kind, indexed, t_start);
  CREATE INDEX event_kind_mag ON event (kind, magnitude);
  -- Every slug ever handed out: current ones, old ones that redirect, and those of events since removed.
  CREATE TABLE slug (slug TEXT PRIMARY KEY, key TEXT NOT NULL) STRICT, WITHOUT ROWID;
  CREATE TABLE source (
    source_id INTEGER PRIMARY KEY, code TEXT NOT NULL, name TEXT NOT NULL, owner TEXT, url TEXT,
    licence TEXT, licence_url TEXT, attribution TEXT
  ) STRICT;
  -- Indexed events by place and year, for "nearby in time and place".
  CREATE VIRTUAL TABLE near USING rtree(id, min_x, max_x, min_y, max_y, min_t, max_t);
  CREATE TABLE meta (k TEXT PRIMARY KEY, v TEXT NOT NULL) STRICT;
`;

type Source = { source_id: number; code: string; name: string; owner: string | null; url: string | null; licence: string; licence_url: string | null; attribution: string | null; viewable: number };

/** The previous build's slugs; empty on a first build or an unreadable file. */
function readLedger(path: string): Ledger {
  const ledger = emptyLedger();
  if (!existsSync(path)) return ledger;
  const db = new Database(path, { readonly: true, fileMustExist: true });
  try {
    for (const r of db.prepare('SELECT slug, key FROM slug').all() as { slug: string; key: string }[]) ledger.slugs.set(r.slug, r.key);
    for (const r of db.prepare('SELECT key, slug, base FROM event').all() as { key: string; slug: string; base: string }[]) ledger.byKey.set(r.key, { slug: r.slug, base: r.base });
  } finally {
    db.close();
  }
  return ledger;
}

export function build(dataDb = DB, out = OUT) {
  const t0 = Date.now();
  const history = new Database(join(dataDb, 'history.db'), { readonly: true, fileMustExist: true });
  const catalog = new Database(join(dataDb, 'catalog.db'), { readonly: true, fileMustExist: true });
  // Pages are public: only sources the anonymous tier may see, as History's map applies it.
  const sources = catalog.prepare(`
    SELECT s.source_id, s.code, s.name, s.owner, s.url, l.name AS licence, l.url AS licence_url, l.attribution,
      coalesce((SELECT p.can_view FROM meta_access_policy p WHERE p.licence_id = s.licence_id AND p.tier = 'anon'), 0) AS viewable
    FROM meta_source s JOIN meta_licence l USING (licence_id)
  `).all() as Source[];
  catalog.close();
  const byId = new Map(sources.map(s => [s.source_id, s]));

  type Raw = { id: number; canonical: number | null; kind: string; family: string; source_id: number; record: string; title: string | null; start: number; prec: number; lon: number | null; lat: number | null; magnitude: number | null; wiki: string | null; wikidata: string | null; retracted: number | null };
  const raw = history.prepare(`
    SELECT e.event_id AS id, e.canonical_id AS canonical, k.code AS kind, k.family, e.source_id, e.source_record_id AS record, e.title,
      e.t_start AS start, e.t_start_prec AS prec, coalesce(e.lon, (e.x0 + e.x1) / 2) AS lon, coalesce(e.lat, (e.y0 + e.y1) / 2) AS lat,
      e.magnitude, e.attrs ->> 'wiki' AS wiki, e.attrs ->> '$.ids.wikidata' AS wikidata, e.retracted_at AS retracted
    FROM ev_event e JOIN ev_kind k USING (kind_id) ORDER BY e.event_id
  `).all() as Raw[];
  history.close();

  const extra = new Map<number, Raw>(raw.map(r => [r.id, r]));
  const rows: EventRow[] = raw.flatMap(r => {
    const source = byId.get(r.source_id);
    if (!source) return [];
    return [{
      id: r.id, key: `${source.code}:${r.record}`, canonical: r.canonical ?? r.id, kind: r.kind, title: r.title, start: r.start,
      magnitude: r.magnitude, wiki: typeof r.wiki === 'string' && r.wiki.trim() ? r.wiki.trim() : null, sourceId: r.source_id,
      // A year-page line names its event's article only when it links a dated Wikidata event.
      ownWiki: r.family !== 'events' || r.wikidata !== null,
      gone: r.retracted !== null || !source.viewable,
    }];
  });
  const ledger = readLedger(out);
  const label = (kind: string) => KINDS[kind] ?? kind.split('.').reverse().join('-');
  const { pages, aliases } = planPages(rows, ledger, label);

  const tmp = `${out}.tmp`;
  rmSync(tmp, { force: true });
  const db = new Database(tmp);
  db.pragma('journal_mode = OFF');
  db.pragma('synchronous = OFF');
  db.exec(SCHEMA);
  const indexed = pages.filter(p => p.indexed).sort((a, b) => a.row.start - b.row.start || a.row.id - b.row.id);
  const seq = new Map(indexed.map((p, i) => [p, i]));
  db.transaction(() => {
    const insEvent = db.prepare(`INSERT INTO event VALUES (@key, @id, @canonical, @slug, @base, @indexed, @seq, @sources, @wiki, @title, @kind, @family, @source, @start, @prec, @lon, @lat, @magnitude)`);
    const insSlug = db.prepare('INSERT OR IGNORE INTO slug VALUES (?, ?)');
    const insNear = db.prepare('INSERT INTO near VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const p of pages) {
      const r = extra.get(p.row.id)!;
      insEvent.run({
        key: p.row.key, id: p.row.id, canonical: p.row.canonical, slug: p.slug, base: p.base, indexed: Number(p.indexed), seq: seq.get(p) ?? null,
        sources: p.sources, wiki: p.wiki, title: r.title, kind: r.kind, family: r.family, source: r.source_id, start: r.start, prec: r.prec,
        lon: r.lon, lat: r.lat, magnitude: r.magnitude,
      });
      insSlug.run(p.slug, p.row.key);
      if (p.indexed && r.lon !== null && r.lat !== null) {
        const year = yearOf(r.start);
        insNear.run(p.row.id, r.lon, r.lon, r.lat, r.lat, year, year);
      }
    }
    for (const [slug, key] of aliases) insSlug.run(slug, key);
    // Slugs of events no longer imported stay taken, so they are never given to another event.
    for (const [slug, key] of ledger.slugs) insSlug.run(slug, key);
    const insSource = db.prepare('INSERT INTO source VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    for (const s of sources) insSource.run(s.source_id, s.code, s.name, s.owner, s.url, s.licence, s.licence_url, s.attribution);
    const meta = db.prepare('INSERT INTO meta VALUES (?, ?)');
    meta.run('built_at', new Date().toISOString());
    meta.run('events', String(pages.length));
    meta.run('indexed', String(indexed.length));
  })();
  db.close();
  renameSync(tmp, out);
  return { pages: pages.length, indexed: indexed.length, aliases: aliases.size, ms: Date.now() - t0 };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const r = build();
  console.log(`${OUT}: ${r.pages} event pages, ${r.indexed} indexed, ${r.pages - r.indexed} noindex, ${r.aliases} renamed, in ${r.ms} ms`);
}
