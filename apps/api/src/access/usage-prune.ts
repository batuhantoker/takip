import type { Logger } from 'pino';
import type { AppDb } from '../db/app-db';
import type { JobQueue } from '../jobs/queue';
import type { JobHandlers } from '../jobs/runner';
import { silentLogger } from '../obs/logger';
import { DAY_MS, utcDay } from './usage';

export const PRUNE_USAGE_JOB = 'usage.prune';
const RUN_HOUR_MS = 4 * 60 * 60_000;

/** Days of usage_counter kept: `days` for accounts and their keys, `anonDays` for visitors. */
export type UsageRetention = { days: number; anonDays: number };
export const DEFAULT_RETENTION: UsageRetention = { days: 400, anonDays: 35 };

/** At most one run per UTC day, however often the api restarts. */
export function schedulePruneUsage(queue: JobQueue, runAt: number) {
  return queue.enqueue(PRUNE_USAGE_JOB, {}, { runAt, dedupeKey: `${PRUNE_USAGE_JOB}@${utcDay(runAt)}` });
}

/** Deletes the days older than the retention; returns how many rows went. */
export function pruneUsage(db: AppDb, { days, anonDays }: UsageRetention, now: number) {
  const today = utcDay(now);
  const anon = db.prepare("DELETE FROM usage_counter WHERE subject_type = 'anon' AND day < ?").run(today - anonDays).changes;
  const accounts = db.prepare("DELETE FROM usage_counter WHERE subject_type != 'anon' AND day < ?").run(today - days).changes;
  return { anon, accounts };
}

type Deps = { db: AppDb; queue: JobQueue; retention?: UsageRetention; now?: () => number; logger?: Logger };

export function usageJobs({ db, queue, retention = DEFAULT_RETENTION, now = () => Date.now(), logger = silentLogger }: Deps): JobHandlers {
  return {
    [PRUNE_USAGE_JOB]() {
      // Tomorrow's run is queued first, so a day whose run fails doesn't end the schedule.
      schedulePruneUsage(queue, (utcDay(now()) + 1) * DAY_MS + RUN_HOUR_MS);
      logger.info({ deleted: pruneUsage(db, retention, now()) }, 'usage_counter pruned');
    },
  };
}
