import { dataLayout, openReader, type Db } from '@takip/db';
import { DAY_MS, isoDay } from '../access/usage';
import { breathe } from '../db/breathe';
import { dayStartMs, eachDay, type Range } from './range';

type SourceRun = { code: string; name: string; record: number; build: number; runs: number; failed: number; records: number; inserted: number; bytes: number };
type LastRun = { code: string; startedAt: number; status: string; error: string | null };

const withReader = <T>(path: string, read: (db: Db) => T): T | undefined => {
  const db = openReader(path);
  if (!db) return undefined;
  try {
    return read(db);
  } finally {
    db.close();
  }
};

/** A table with fewer rows than this is counted in one statement. */
const SMALL = 50_000;
const SLICES = 256;

const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;

/** count(*), over slices of the table's key when it's big, so other requests run in between. */
async function countRows(db: Db, name: string, withoutRowid: boolean) {
  const table = quote(name);
  const head = db.prepare(`SELECT count(*) FROM (SELECT 1 FROM ${table} LIMIT ${SMALL})`).pluck().get() as number;
  if (head < SMALL) return head;
  const pk = withoutRowid ? (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string; pk: number }[]).find(c => c.pk === 1) : undefined;
  const key = withoutRowid ? pk && quote(pk.name) : 'rowid';
  const lo = key && db.prepare(`SELECT min(${key}) FROM ${table}`).pluck().get();
  const hi = key && db.prepare(`SELECT max(${key}) FROM ${table}`).pluck().get();
  if (typeof lo !== 'number' || typeof hi !== 'number') return db.prepare(`SELECT count(*) FROM ${table}`).pluck().get() as number;
  const slice = db.prepare(`SELECT count(*) FROM ${table} WHERE ${key} >= ? AND ${key} < ?`).pluck();
  const step = Math.ceil((hi - lo + 1) / SLICES);
  let rows = 0;
  for (let from = lo; from <= hi; from += step) {
    await breathe();
    rows += slice.get(from, from + step) as number;
  }
  return rows;
}

/** Row counts of a database's tables, leaving out SQLite's own, virtual tables (R*Tree, full-text) and their shadow tables. */
export async function tableCounts(db: Db) {
  const tables = db.prepare("SELECT name, sql FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all() as { name: string; sql: string }[];
  const virtual = tables.filter(t => /^CREATE VIRTUAL/i.test(t.sql)).map(t => t.name);
  const counts: { table: string; rows: number }[] = [];
  for (const t of tables.filter(t => !virtual.some(v => t.name === v || t.name.startsWith(`${v}_`)))) {
    counts.push({ table: t.name, rows: await countRows(db, t.name, /\bWITHOUT\s+ROWID\b/i.test(t.sql)) });
  }
  return counts.sort((a, b) => b.rows - a.rows || a.table.localeCompare(b.table));
}

// One count(*) pass over history.db (1 GB, 16 M ts_point rows) took 2–4 s on the NUC, with the whole api waiting on it.
export async function historyCounts(dataDir: string) {
  const db = openReader(dataLayout(dataDir).history);
  if (!db) return [];
  try {
    return await tableCounts(db);
  } finally {
    db.close();
  }
}

/** What the ingest worker has gathered, from catalog.db (GET /api/admin/analytics/data). `history` comes in cached. */
export function dataAccumulation(dataDir: string | undefined, r: Range, history: { table: string; rows: number }[]) {
  const days = eachDay(r, day => ({ day, runs: 0, failed: 0, records: 0, inserted: 0, bytes: 0 }));
  const empty = { today: isoDay(r.today), since: null, available: false, sources: [], days, shards: [], history };
  if (!dataDir) return empty;
  const from = dayStartMs(r.first);
  return withReader(dataLayout(dataDir).catalog, db => {
    const runs = db.prepare(`
      SELECT s.code, s.name, s.record, s.build,
             count(r.run_id) AS runs, count(CASE WHEN r.status = 'failed' THEN 1 END) AS failed,
             coalesce(sum(r.records), 0) AS records, coalesce(sum(r.inserted), 0) AS inserted, coalesce(sum(r.bytes), 0) AS bytes
      FROM meta_source s LEFT JOIN meta_ingest_run r ON r.source_id = s.source_id AND r.started_at >= ?
      GROUP BY s.source_id ORDER BY bytes DESC, runs DESC, s.code`).all(from) as SourceRun[];
    const last = new Map((db.prepare(`
      SELECT s.code, r.started_at AS startedAt, r.status, r.error FROM meta_ingest_run r JOIN meta_source s ON s.source_id = r.source_id
      WHERE r.run_id IN (SELECT max(run_id) FROM meta_ingest_run GROUP BY source_id)`).all() as LastRun[]).map(row => [row.code, row]));
    const sources = runs.map(({ record, build, ...row }) => {
      const lastRun = last.get(row.code);
      return { ...row, record: record === 1, build: build === 1, lastRunAt: lastRun?.startedAt ?? null, lastStatus: lastRun?.status ?? null, lastError: lastRun?.error ?? null };
    });

    for (const row of db.prepare(`
      SELECT started_at / 86400000 AS day, count(*) AS runs, count(CASE WHEN status = 'failed' THEN 1 END) AS failed,
             coalesce(sum(records), 0) AS records, coalesce(sum(inserted), 0) AS inserted, coalesce(sum(bytes), 0) AS bytes
      FROM meta_ingest_run WHERE started_at >= ? GROUP BY 1`).all(from) as ({ day: number } & Omit<(typeof days)[number], 'day'>)[]) {
      const { day, ...counts } = row;
      if (days[day - r.first]) Object.assign(days[day - r.first], counts);
    }

    const shards = db.prepare(`
      SELECT kind, lod, status, count(*) AS shards, coalesce(sum(rows), 0) AS rows, coalesce(sum(bytes), 0) AS bytes
      FROM meta_shard GROUP BY kind, lod, status ORDER BY kind, lod, status`).all() as { kind: string; lod: number | null; status: string; shards: number; rows: number; bytes: number }[];
    const first = db.prepare('SELECT min(started_at) FROM meta_ingest_run').pluck().get() as number | null;
    // The contract's range `days` (a count) gives way to the per-day rows here.
    return { today: isoDay(r.today), since: first == null ? null : isoDay(Math.floor(first / DAY_MS)), available: true, sources, days, shards, history };
  }) ?? empty;
}
