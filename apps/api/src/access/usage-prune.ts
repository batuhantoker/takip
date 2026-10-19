import type { Logger } from 'pino';
import type { AppDb } from '../db/app-db';
import type { JobQueue } from '../jobs/queue';
import type { JobHandlers } from '../jobs/runner';
import { silentLogger } from '../obs/logger';
import { DAY_MS, utcDay } from './usage';

export const PRUNE_USAGE_JOB = 'usage.prune';
const RUN_HOUR_MS = 4 * 60 * 60_000;

/**
 * Days kept. API counts (usage_counter): `days` for accounts and their keys, `anonDays` for visitors' daily hashes.
 * User activity (map time and what it went on, visitor ids, places, shared locations, actions, sign-ins): `activityDays` for everyone.
 */
export type UsageRetention = { days: number; anonDays: number; activityDays: number };
export const DEFAULT_RETENTION: UsageRetention = { days: 400, anonDays: 35, activityDays: 90 };

/** At most one run per UTC day, however often the api restarts. */
export function schedulePruneUsage(queue: JobQueue, runAt: number) {
  return queue.enqueue(PRUNE_USAGE_JOB, {}, { runAt, dedupeKey: `${PRUNE_USAGE_JOB}@${utcDay(runAt)}` });
}

const ACTIVITY_TABLES = ['map_time', 'feature_time', 'activity_hour', 'user_hour', 'visitor_day', 'visitor_feature', 'visitor_hour', 'action_count', 'page_read'] as const;

/** Deletes the days older than the retention; returns how many rows went. */
export function pruneUsage(db: AppDb, { days, anonDays, activityDays }: UsageRetention, now: number) {
  const today = utcDay(now);
  const anon = db.prepare("DELETE FROM usage_counter WHERE subject_type = 'anon' AND day < ?").run(today - anonDays).changes;
  const accounts = db.prepare("DELETE FROM usage_counter WHERE subject_type != 'anon' AND day < ?").run(today - days).changes;
  const from = today - activityDays;
  let activity = 0;
  for (const table of ACTIVITY_TABLES) activity += db.prepare(`DELETE FROM ${table} WHERE day < ?`).run(from).changes;
  activity += db.prepare('DELETE FROM visitor WHERE last_seen_at < ?').run(from * DAY_MS).changes;
  activity += db.prepare('DELETE FROM place_seen WHERE last_seen_at < ?').run(from * DAY_MS).changes;
  activity += db.prepare('DELETE FROM device_place WHERE last_seen_at < ?').run(from * DAY_MS).changes;
  activity += db.prepare('DELETE FROM sign_in WHERE at < ?').run(from * DAY_MS).changes;
  return { anon, accounts, activity };
}

type Deps = { db: AppDb; queue: JobQueue; retention?: UsageRetention; now?: () => number; logger?: Logger };

export function usageJobs({ db, queue, retention = DEFAULT_RETENTION, now = () => Date.now(), logger = silentLogger }: Deps): JobHandlers {
  return {
    [PRUNE_USAGE_JOB]() {
      // Tomorrow's run is queued first, so a day whose run fails doesn't end the schedule.
      schedulePruneUsage(queue, (utcDay(now()) + 1) * DAY_MS + RUN_HOUR_MS);
      logger.info({ deleted: pruneUsage(db, retention, now()) }, 'usage counts and activity pruned');
    },
  };
}
