import { statSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';

/**
 * Read-only handles on data/db/event-pages.db (the slug index, tools/site/build-event-pages.ts) and history.db, held
 * for the process. Every query is a key lookup or an R*Tree box: better-sqlite3 blocks the event loop for a whole
 * statement, and the map shares this thread. A rebuilt index is picked up within RECHECK_MS.
 */

const RECHECK_MS = 60_000;

const dbDir = () => join(process.env.TAKIP_DATA_DIR || join(process.cwd(), 'data'), 'db');

type Db = Database.Database;
type Held = { db: Db | null; stamp: string | null; checked: number };

// On globalThis so dev's module reloads don't leak a handle each.
const HELD: Map<string, Held> = ((globalThis as { __takipEventDbs?: Map<string, Held> }).__takipEventDbs ??= new Map());

function stampOf(path: string): string | null {
  try {
    const s = statSync(path);
    return `${s.ino}:${s.size}:${s.mtimeMs}`;
  } catch {
    return null;
  }
}

function open(name: string): Db | null {
  const now = Date.now();
  const held = HELD.get(name);
  if (held && now - held.checked < RECHECK_MS) return held.db;
  const path = join(dbDir(), name);
  const stamp = stampOf(path);
  if (held && stamp === held.stamp) {
    held.checked = now;
    return held.db;
  }
  held?.db?.close();
  const db = stamp ? new Database(path, { readonly: true, fileMustExist: true }) : null;
  if (db) {
    db.pragma('busy_timeout = 2000');
    db.pragma('cache_size = -16384');
  }
  HELD.set(name, { db, stamp, checked: now });
  return db;
}

/** The slug index, or null where it hasn't been built. */
export const pagesDb = () => open('event-pages.db');

export const historyDb = () => open('history.db');

/** Changes whenever either file is replaced, for caches keyed on what they read. */
export function buildStamp(): string {
  pagesDb();
  historyDb();
  return `${HELD.get('event-pages.db')?.stamp}|${HELD.get('history.db')?.stamp}`;
}

const statements = new WeakMap<Db, Map<string, Database.Statement>>();

/** A prepared statement, kept per handle. */
export function stmt(db: Db, sql: string): Database.Statement {
  let m = statements.get(db);
  if (!m) statements.set(db, (m = new Map()));
  let s = m.get(sql);
  if (!s) m.set(sql, (s = db.prepare(sql)));
  return s;
}
