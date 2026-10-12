import type { Db } from './open';
import { type FileKind, MIGRATIONS } from './schema';

/**
 * Applies a file kind's pending migrations, tracked by PRAGMA user_version.
 * Append new entries to a kind's list; never edit applied ones.
 */
export function migrate(db: Db, kind: FileKind) {
  const steps = MIGRATIONS[kind];
  const applied = db.pragma('user_version', { simple: true }) as number;
  if (applied > steps.length) throw new Error(`${db.name} is at schema ${applied}, newer than this code's ${steps.length} (${kind})`);
  for (let version = applied; version < steps.length; version++) {
    db.transaction(() => {
      db.exec(steps[version]);
      db.pragma(`user_version = ${version + 1}`);
    })();
  }
}
