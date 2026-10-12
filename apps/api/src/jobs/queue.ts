import type { AppDb } from '../db/app-db';

export const DEFAULT_MAX_ATTEMPTS = 8;

export type Job = { id: number; kind: string; payload: unknown; attempts: number; maxAttempts: number };
export type EnqueueOptions = { runAt?: number; dedupeKey?: string; maxAttempts?: number };

type ClaimedRow = Omit<Job, 'payload'> & { payload: string };

/**
 * The `job` table in app.db (backend.md §4). A claim takes a lease, so a second api process can poll the
 * same table: a job whose worker died is claimed again once its lease runs out.
 */
export function createJobQueue(db: AppDb, { now = () => Date.now() } = {}) {
  const insert = db.prepare(`
    INSERT INTO job (kind, payload, run_at, max_attempts, dedupe_key, created_at) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (dedupe_key) DO NOTHING`);
  // Attempts count claims, so a finished claim can tell whether its lease was taken over meanwhile.
  const claimOne = db.prepare(`
    UPDATE job SET locked_until = @until, attempts = attempts + 1
    WHERE job_id = (
      SELECT job_id FROM job
      WHERE done_at IS NULL AND failed_at IS NULL AND run_at <= @now AND attempts < max_attempts
        AND (locked_until IS NULL OR locked_until <= @now)
        AND kind IN (SELECT value FROM json_each(@kinds))
      ORDER BY run_at, job_id LIMIT 1)
    RETURNING job_id AS id, kind, payload, attempts, max_attempts AS maxAttempts`);
  // A worker that died on the last attempt leaves a job nothing may claim again.
  const sweepAbandoned = db.prepare(`
    UPDATE job SET failed_at = @now, locked_until = NULL, last_error = COALESCE(last_error, 'lease expired on the last attempt')
    WHERE done_at IS NULL AND failed_at IS NULL AND attempts >= max_attempts AND locked_until <= @now`);
  const markDone = db.prepare('UPDATE job SET done_at = ?, locked_until = NULL WHERE job_id = ? AND attempts = ? AND done_at IS NULL AND failed_at IS NULL');
  const markRetry = db.prepare('UPDATE job SET run_at = ?, locked_until = NULL, last_error = ? WHERE job_id = ? AND attempts = ? AND done_at IS NULL AND failed_at IS NULL');
  const markFailed = db.prepare('UPDATE job SET failed_at = ?, locked_until = NULL, last_error = ? WHERE job_id = ? AND attempts = ? AND done_at IS NULL AND failed_at IS NULL');

  return {
    /** Adds a job; returns its id, or null when `dedupeKey` was already taken. */
    enqueue(kind: string, payload: unknown = {}, { runAt = now(), dedupeKey, maxAttempts = DEFAULT_MAX_ATTEMPTS }: EnqueueOptions = {}): number | null {
      const { changes, lastInsertRowid } = insert.run(kind, JSON.stringify(payload), runAt, maxAttempts, dedupeKey ?? null, now());
      return changes ? Number(lastInsertRowid) : null;
    },
    /** Leases the next due job of one of `kinds`, or returns null. */
    claim(kinds: readonly string[], leaseMs: number): Job | null {
      const at = now();
      const row = claimOne.get({ now: at, until: at + leaseMs, kinds: JSON.stringify(kinds) }) as ClaimedRow | undefined;
      return row ? { ...row, payload: JSON.parse(row.payload) } : null;
    },
    sweep: () => sweepAbandoned.run({ now: now() }).changes,
    /** Each returns false when the lease was lost and another claim owns the job now. */
    complete: (job: Job) => markDone.run(now(), job.id, job.attempts).changes > 0,
    retry: (job: Job, error: string, runAt: number) => markRetry.run(runAt, error, job.id, job.attempts).changes > 0,
    fail: (job: Job, error: string) => markFailed.run(now(), error, job.id, job.attempts).changes > 0,
  };
}

export type JobQueue = ReturnType<typeof createJobQueue>;
