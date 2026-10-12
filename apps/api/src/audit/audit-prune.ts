import type { Logger } from 'pino';
import { DAY_MS, utcDay } from '../access/usage';
import type { AppDb } from '../db/app-db';
import type { JobQueue } from '../jobs/queue';
import type { JobHandlers } from '../jobs/runner';
import { silentLogger } from '../obs/logger';

export const PRUNE_AUDIT_JOB = 'audit.prune';
export const DEFAULT_AUDIT_RETENTION_DAYS = 30;
const RUN_HOUR_MS = 4 * 60 * 60_000;

/** At most one run per UTC day, however often the api restarts. */
export function schedulePruneAudit(queue: JobQueue, runAt: number) {
  return queue.enqueue(PRUNE_AUDIT_JOB, {}, { runAt, dedupeKey: `${PRUNE_AUDIT_JOB}@${utcDay(runAt)}` });
}

/** Deletes audit_event rows more than `days` old; returns how many went. */
export function pruneAudit(db: AppDb, days: number, now: number) {
  return db.prepare('DELETE FROM audit_event WHERE at < ?').run(now - days * DAY_MS).changes;
}

type Deps = { db: AppDb; queue: JobQueue; days?: number; now?: () => number; logger?: Logger };

export function auditJobs({ db, queue, days = DEFAULT_AUDIT_RETENTION_DAYS, now = () => Date.now(), logger = silentLogger }: Deps): JobHandlers {
  return {
    [PRUNE_AUDIT_JOB]() {
      // Tomorrow's run is queued first, so a day whose run fails doesn't end the schedule.
      schedulePruneAudit(queue, (utcDay(now()) + 1) * DAY_MS + RUN_HOUR_MS);
      logger.info({ deleted: pruneAudit(db, days, now()) }, 'audit_event pruned');
    },
  };
}
