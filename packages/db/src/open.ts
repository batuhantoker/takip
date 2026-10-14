import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { migrate } from './migrate';
import type { FileKind } from './schema';

export type Db = Database.Database;

/** Large pages suit the blob- and R*Tree-heavy files (§10.1). Fixed when a file is created. */
const PAGE_SIZE: Record<FileKind, number> = {
  catalog: 4096,
  history: 4096,
  cache: 4096,
  stream: 16384,
  tracks: 16384,
  tle: 16384,
  traces: 4096,
  geo: 16384,
};

/**
 * The one writer of a file: creates and migrates it if needed. Pragmas from replay-database.md §10.1.
 * Checkpoints stay automatic until the live ingest path exists to keep them off.
 */
export function openWriter(path: string, kind: FileKind): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  if (db.pragma('page_count', { simple: true }) === 0) db.pragma(`page_size = ${PAGE_SIZE[kind]}`);
  db.pragma('journal_mode = WAL');
  // NORMAL, not app.db's FULL: a power cut loses the last transactions, and the archive replays them.
  db.pragma('synchronous = NORMAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');
  db.pragma('temp_store = MEMORY');
  db.pragma('cache_size = -131072');
  db.pragma('mmap_size = 4294967296');
  db.pragma('journal_size_limit = 67108864');
  migrate(db, kind);
  return db;
}

/** A read-only handle for serving. Returns undefined when the file doesn't exist yet. */
export function openReader(path: string): Db | undefined {
  if (!existsSync(path)) return undefined;
  const db = new Database(path, { readonly: true, fileMustExist: true });
  db.pragma('busy_timeout = 5000');
  db.pragma('cache_size = -32768');
  db.pragma('mmap_size = 4294967296');
  return db;
}
