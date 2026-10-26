import { statSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';

/**
 * Read-only handles on the SQLite files in data/db, held for the process; a rebuilt file is picked up within
 * RECHECK_MS. better-sqlite3 blocks the event loop for a whole statement, and the map shares this thread, so every
 * query should be a key lookup or an R*Tree box.
 */

const RECHECK_MS = 60_000;

export type Db = Database.Database;
type Held = { db: Db | null; stamp: string | null; checked: number };

export const dbDir = () => join(process.env.TAKIP_DATA_DIR || join(process.cwd(), 'data'), 'db');

// On globalThis so dev's module reloads don't leak a handle each.
const HELD: Map<string, Held> = ((globalThis as { __takipReadDbs?: Map<string, Held> }).__takipReadDbs ??= new Map());

function stampOf(path: string): string | null {
  try {
    const s = statSync(path);
    return `${s.ino}:${s.size}:${s.mtimeMs}`;
  } catch {
    return null;
  }
}

/** data/db/<name>, or null where it hasn't been built. */
export function readDb(name: string): Db | null {
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

/** Changes whenever the file is replaced, for caches keyed on what it holds; null while it is missing. */
export function dbStamp(name: string): string | null {
  readDb(name);
  return HELD.get(name)?.stamp ?? null;
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
