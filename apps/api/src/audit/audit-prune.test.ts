import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DAY_MS, utcDay } from '../access/usage';
import { loadEnv } from '../env';
import { createJobRunner } from '../jobs/runner';
import { startApp, type TestApp } from '../testing/helpers';
import { PRUNE_AUDIT_JOB, auditJobs, schedulePruneAudit } from './audit-prune';

const NOW = Date.parse('2026-10-12T12:00:00.000Z');
const TOMORROW_RUN = (utcDay(NOW) + 1) * DAY_MS + 4 * 3_600_000;

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

/** One row per age, in days before NOW (fractions allowed). */
const seed = (ages: number[]) => {
  const insert = t.db.prepare("INSERT INTO audit_event (at, actor_type, actor_id, action, data) VALUES (?, 'system', NULL, ?, '{}')");
  for (const age of ages) insert.run(NOW - age * DAY_MS, `test.${age}`);
};
/** Ages, in days before NOW, of the rows left. */
const kept = () => (t.db.prepare("SELECT at FROM audit_event WHERE action LIKE 'test.%' ORDER BY at DESC").pluck().all() as number[]).map(at => (NOW - at) / DAY_MS);
const runner = (days?: number) => createJobRunner(t.jobs.queue, auditJobs({ db: t.db, queue: t.jobs.queue, days }));

describe('pruning audit_event', () => {
  it('runs once a day and deletes rows more than 30 days old', async () => {
    seed([0, 29, 29.5, 30, 30.5, 400]);
    const jobs = runner();
    expect(schedulePruneAudit(t.jobs.queue, Date.now())).not.toBeNull();
    expect(await jobs.runDue()).toBe(1);
    expect(kept()).toEqual([0, 29, 29.5, 30]);

    // A restart the same day queues nothing new; tomorrow's run was queued by today's.
    expect(schedulePruneAudit(t.jobs.queue, Date.now())).toBeNull();
    vi.setSystemTime(TOMORROW_RUN - 1);
    expect(await jobs.runDue()).toBe(0);
    vi.setSystemTime(TOMORROW_RUN);
    expect(await jobs.runDue()).toBe(1);
    // 16 hours on, anything seeded more than 29⅓ days before NOW has passed 30 days.
    expect(kept()).toEqual([0, 29]);
    expect(t.db.prepare('SELECT count(*) FROM job WHERE kind = ? AND done_at IS NULL').pluck().get(PRUNE_AUDIT_JOB)).toBe(1);
  });

  it('keeps the window it is configured with', async () => {
    seed([0, 7, 7.5, 90]);
    schedulePruneAudit(t.jobs.queue, Date.now());
    await runner(7).runDue();
    expect(kept()).toEqual([0, 7]);
  });

  it('reads its window from the environment', () => {
    expect(loadEnv({})).toMatchObject({ AUDIT_RETENTION_DAYS: 30 });
    expect(loadEnv({ AUDIT_RETENTION_DAYS: '90' })).toMatchObject({ AUDIT_RETENTION_DAYS: 90 });
    for (const bad of ['0', '-1', '1.5', 'forever']) expect(() => loadEnv({ AUDIT_RETENTION_DAYS: bad }), bad).toThrow(/AUDIT_RETENTION_DAYS/);
  });
});
