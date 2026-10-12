import { closeSync, fsyncSync, mkdirSync, openSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import type { Logger } from 'pino';
import { DAY_MS, utcDay } from '../access/usage';
import type { JobQueue } from '../jobs/queue';
import type { JobHandlers } from '../jobs/runner';
import { silentLogger } from '../obs/logger';
import type { AppDb } from './app-db';

export const BACKUP_JOB = 'db.backup';
export const DEFAULT_BACKUP_KEEP = 14;
const RUN_HOUR_MS = 2 * 60 * 60_000;
const SNAPSHOT = /^app-\d{4}-\d{2}-\d{2}\.db$/;

export const snapshotName = (at: number) => `app-${new Date(at).toISOString().slice(0, 10)}.db`;

export type SnapshotCheck = { problems: string[]; userVersion?: number };

/** What `PRAGMA integrity_check` finds wrong with a database file (nothing when it is sound), and its schema version. */
export function checkSnapshot(file: string): SnapshotCheck {
  let copy: AppDb | undefined;
  try {
    copy = new Database(file, { readonly: true, fileMustExist: true });
    const rows = copy.pragma('integrity_check') as { integrity_check: string }[];
    return { problems: rows.map(row => row.integrity_check).filter(line => line !== 'ok'), userVersion: copy.pragma('user_version', { simple: true }) as number };
  } catch (err) {
    return { problems: [err instanceof Error ? err.message : String(err)] };
  } finally {
    copy?.close();
  }
}

export type SnapshotOptions = { dir: string; keep: number; now?: number; logger?: Logger };

/**
 * Copies app.db to `dir`/app-<UTC date>.db with VACUUM INTO. The copy keeps a temporary name until it passes an
 * integrity check, so a crash or a bad copy never leaves a snapshot behind; a second one the same day replaces the
 * first. Then only the newest `keep` snapshots stay.
 */
export function snapshotAppDb(db: AppDb, { dir, keep, now = Date.now(), logger = silentLogger }: SnapshotOptions) {
  mkdirSync(dir, { recursive: true });
  const file = join(dir, snapshotName(now));
  const temp = `${file}.tmp`;
  const started = performance.now();
  rmSync(temp, { force: true });
  try {
    db.prepare('VACUUM INTO ?').run(temp);
    // SQLite doesn't fsync what VACUUM INTO writes.
    const fd = openSync(temp, 'r+');
    try {
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    const { problems } = checkSnapshot(temp);
    if (problems.length) throw new Error(`snapshot failed its integrity check: ${problems.slice(0, 5).join('; ')}`);
    renameSync(temp, file);
  } catch (err) {
    rmSync(temp, { force: true });
    throw err;
  }
  const snapshot = { file, bytes: statSync(file).size, ms: Math.round(performance.now() - started), removed: pruneSnapshots(dir, keep) };
  logger.info(snapshot, 'app.db snapshot written');
  return snapshot;
}

/** Deletes all but the newest `keep` snapshots; returns the names deleted. */
function pruneSnapshots(dir: string, keep: number) {
  const old = readdirSync(dir).filter(name => SNAPSHOT.test(name)).sort().reverse().slice(keep);
  for (const name of old) rmSync(join(dir, name));
  return old;
}

/** At most one run per UTC day, however often the api restarts. */
export function scheduleBackup(queue: JobQueue, runAt: number) {
  return queue.enqueue(BACKUP_JOB, {}, { runAt, dedupeKey: `${BACKUP_JOB}@${utcDay(runAt)}` });
}

type Deps = { db: AppDb; queue: JobQueue; dir: string; keep?: number; now?: () => number; logger?: Logger };

export function backupJobs({ db, queue, dir, keep = DEFAULT_BACKUP_KEEP, now = () => Date.now(), logger = silentLogger }: Deps): JobHandlers {
  return {
    [BACKUP_JOB]() {
      // Tomorrow's run is queued first, so a day whose run fails doesn't end the schedule.
      scheduleBackup(queue, (utcDay(now()) + 1) * DAY_MS + RUN_HOUR_MS);
      snapshotAppDb(db, { dir, keep, now: now(), logger });
    },
  };
}
