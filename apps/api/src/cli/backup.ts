import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { openAppDb } from '../db/app-db';
import { checkSnapshot, snapshotAppDb } from '../db/backup';
import { migrateAppSchema } from '../db/migrations';
import { loadEnv, loadEnvFiles } from '../env';

const USAGE = `Snapshots of app.db. Restoring one: docs/runbooks/app-db-restore.md.

  npm run backup -w @takip/api                  take a snapshot now, the way the nightly job does
  npm run backup -w @takip/api -- check <file>  check a snapshot's integrity and schema version`;

const [command, file] = process.argv.slice(2);

loadEnvFiles();
const env = loadEnv();

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

/** The user_version this code migrates app.db to. */
function codeVersion() {
  const empty = openAppDb(':memory:');
  migrateAppSchema(empty);
  const version = empty.pragma('user_version', { simple: true }) as number;
  empty.close();
  return version;
}

switch (command) {
  case undefined:
  case 'now': {
    // Not migrated first: the snapshot keeps the schema it was taken from.
    if (!existsSync(env.APP_DB_PATH)) fail(`No database at ${env.APP_DB_PATH}.`);
    const db = openAppDb(env.APP_DB_PATH);
    try {
      const { file: written, bytes, ms, removed } = snapshotAppDb(db, { dir: env.APP_BACKUP_DIR, keep: env.APP_BACKUP_KEEP });
      console.log(`Wrote ${written} (${Math.ceil(bytes / 1024)} KiB, ${ms} ms).${removed.length ? ` Removed ${removed.join(', ')}.` : ''}`);
    } finally {
      db.close();
    }
    break;
  }
  case 'check': {
    if (!file) fail(USAGE);
    // npm runs this in apps/api; the path was typed relative to where npm was started.
    const path = resolve(process.env.INIT_CWD ?? process.cwd(), file);
    const { problems, userVersion = 0 } = checkSnapshot(path);
    if (problems.length) fail(`${path} failed its check; choose another snapshot.\n  ${problems.slice(0, 10).join('\n  ')}`);
    const expected = codeVersion();
    console.log(`${path}: integrity ok, user_version ${userVersion} (this code migrates to ${expected}).`);
    if (userVersion > expected) fail('The snapshot is newer than this code: deploy the code it was taken with, then restore it.');
    break;
  }
  default:
    console.log(USAGE);
}
