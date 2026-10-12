import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DAY_MS, utcDay } from '../access/usage';
import { loadEnv } from '../env';
import { startApp, type TestApp } from '../testing/helpers';
import { PRUNE_JOBS_JOB, jobQueueJobs, schedulePruneJobs } from './jobs-prune';
import { createJobRunner } from './runner';

const NOW = Date.parse('2026-10-12T12:00:00.000Z');
const TOMORROW_RUN = (utcDay(NOW) + 1) * DAY_MS + 4 * 3_600_000;
const LEASE_END = NOW + 5 * 60_000;

let t: TestApp;

beforeEach(async () => {
  t = await startApp();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
  t.close();
});

type Seed = { label: string; done?: number; failed?: number; attempts?: number; lockedUntil?: number; runAt?: number; lastError?: string };

/** `done` and `failed` are ages in days before NOW; every row was created 30 days before it. */
const seed = (rows: Seed[]) => {
  const insert = t.db.prepare(`
    INSERT INTO job (kind, payload, run_at, attempts, locked_until, last_error, done_at, failed_at, dedupe_key, created_at)
    VALUES ('email.send', '{"to":"ada@example.com"}', @runAt, @attempts, @lockedUntil, @lastError, @doneAt, @failedAt, @key, @createdAt)`);
  const at = (age?: number) => (age === undefined ? null : NOW - age * DAY_MS);
  for (const { label, done, failed, attempts = 1, lockedUntil = null, runAt = NOW - 30 * DAY_MS, lastError = null } of rows) {
    insert.run({ runAt, attempts, lockedUntil, lastError, doneAt: at(done), failedAt: at(failed), key: `test:${label}`, createdAt: NOW - 30 * DAY_MS });
  }
};
const kept = () => (t.db.prepare("SELECT dedupe_key FROM job WHERE dedupe_key LIKE 'test:%' ORDER BY job_id").pluck().all() as string[]).map(key => key.slice(5));
const runner = (days?: number) => createJobRunner(t.jobs.queue, jobQueueJobs({ db: t.db, queue: t.jobs.queue, days }));

describe('pruning finished jobs', () => {
  it('runs once a day and deletes jobs that finished more than 7 days ago, never pending or leased ones', async () => {
    seed([
      { label: 'done 0', done: 0 },
      { label: 'done 6.9', done: 6.9 },
      { label: 'done 7', done: 7 },
      { label: 'done 7.5', done: 7.5 },
      { label: 'failed 1', failed: 1, lastError: 'smtp refused ada@example.com' },
      { label: 'failed 8', failed: 8, lastError: 'smtp refused ada@example.com' },
      { label: 'never ran', attempts: 0 },
      { label: 'retrying', attempts: 3, lastError: 'smtp down', runAt: NOW + 60_000 },
      { label: 'leased', lockedUntil: LEASE_END },
      { label: 'done 30, leased', done: 30, lockedUntil: LEASE_END },
    ]);
    const jobs = runner();
    expect(schedulePruneJobs(t.jobs.queue, Date.now())).not.toBeNull();
    expect(await jobs.runDue()).toBe(1);
    expect(kept()).toEqual(['done 0', 'done 6.9', 'done 7', 'failed 1', 'never ran', 'retrying', 'leased', 'done 30, leased']);

    // A restart the same day queues nothing new; tomorrow's run was queued by today's.
    expect(schedulePruneJobs(t.jobs.queue, Date.now())).toBeNull();
    vi.setSystemTime(TOMORROW_RUN - 1);
    expect(await jobs.runDue()).toBe(0);
    vi.setSystemTime(TOMORROW_RUN);
    expect(await jobs.runDue()).toBe(1);
    // 16 hours on, anything that finished more than 6⅓ days before NOW has passed 7 days, and the lease has run out.
    expect(kept()).toEqual(['done 0', 'failed 1', 'never ran', 'retrying', 'leased']);
    expect(t.db.prepare('SELECT count(*) FROM job WHERE kind = ? AND done_at IS NULL').pluck().get(PRUNE_JOBS_JOB)).toBe(1);
  });

  it('keeps the window it is configured with', async () => {
    seed([{ label: 'done 29', done: 29 }, { label: 'failed 29.5', failed: 29.5 }, { label: 'done 31', done: 31 }, { label: 'failed 90', failed: 90 }]);
    schedulePruneJobs(t.jobs.queue, Date.now());
    await runner(30).runDue();
    expect(kept()).toEqual(['done 29', 'failed 29.5']);
  });

  it('reads its window from the environment', () => {
    expect(loadEnv({})).toMatchObject({ JOB_RETENTION_DAYS: 7 });
    expect(loadEnv({ JOB_RETENTION_DAYS: '30' })).toMatchObject({ JOB_RETENTION_DAYS: 30 });
    for (const bad of ['0', '-1', '1.5', 'forever']) expect(() => loadEnv({ JOB_RETENTION_DAYS: bad }), bad).toThrow(/JOB_RETENTION_DAYS/);
  });
});
