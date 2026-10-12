import type { Logger } from 'pino';
import { DAY_MS, utcDay } from '../access/usage';
import type { AppDb } from '../db/app-db';
import { silentLogger } from '../obs/logger';
import type { JobQueue } from './queue';
import type { JobHandlers } from './runner';

export const PRUNE_JOBS_JOB = 'jobs.prune';
export const DEFAULT_JOB_RETENTION_DAYS = 7;
const RUN_HOUR_MS = 4 * 60 * 60_000;

/** At most one run per UTC day, however often the api restarts. */
export function schedulePruneJobs(queue: JobQueue, runAt: number) {
  return queue.enqueue(PRUNE_JOBS_JOB, {}, { runAt, dedupeKey: `${PRUNE_JOBS_JOB}@${utcDay(runAt)}` });
}

/** Deletes jobs that finished, done or failed, more than `days` ago; returns how many went. Pending and leased jobs stay. */
export function pruneJobs(db: AppDb, days: number, now: number) {
  return db
    .prepare('DELETE FROM job WHERE COALESCE(done_at, failed_at) < @before AND (locked_until IS NULL OR locked_until <= @now)')
    .run({ before: now - days * DAY_MS, now }).changes;
}

type Deps = { db: AppDb; queue: JobQueue; days?: number; now?: () => number; logger?: Logger };

export function jobQueueJobs({ db, queue, days = DEFAULT_JOB_RETENTION_DAYS, now = () => Date.now(), logger = silentLogger }: Deps): JobHandlers {
  return {
    [PRUNE_JOBS_JOB]() {
      // Tomorrow's run is queued first, so a day whose run fails doesn't end the schedule.
      schedulePruneJobs(queue, (utcDay(now()) + 1) * DAY_MS + RUN_HOUR_MS);
      logger.info({ deleted: pruneJobs(db, days, now()) }, 'finished jobs pruned');
    },
  };
}
