import type Database from 'better-sqlite3';
import type { Db } from '../open';

/** better-sqlite3 frees a statement only after GC; stores called once per row must reuse theirs. */
export function statements(db: Db) {
  const cache = new Map<string, Database.Statement<unknown[]>>();
  return (sql: string) => {
    let s = cache.get(sql);
    if (!s) cache.set(sql, (s = db.prepare<unknown[]>(sql)));
    return s;
  };
}
