import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { grantPlan } from '../access/grants';
import { DAY_MS, utcDay } from '../access/usage';
import { RECONCILE_JOB, scheduleReconcile } from './reconcile';
import { startBilling, type BillingTest } from './testing';

let b: BillingTest;

beforeEach(async () => {
  b = await startBilling();
});

afterEach(() => {
  vi.useRealTimers();
  b.t.close();
});

const jobs = () => b.t.db.prepare('SELECT kind, run_at, attempts, done_at IS NOT NULL AS done, last_error, dedupe_key FROM job WHERE kind = ? ORDER BY job_id').all(RECONCILE_JOB) as {
  kind: string; run_at: number; attempts: number; done: number; last_error: string | null; dedupe_key: string;
}[];

async function subscribe(providerSubId = 'sub_1') {
  const snapshot = b.snapshot({ providerSubId });
  await b.deliver([{ type: 'subscription.upserted', eventId: b.nextEventId(), snapshot }]);
  b.fake.subscriptions.set(providerSubId, snapshot);
  return snapshot;
}

describe('reconciliation', () => {
  it('repairs a webhook that never arrived', async () => {
    const snapshot = await subscribe();
    expect((await b.accessOf()).plan.id).toBe('pro');
    // Canceled at the provider; the webhook is lost.
    b.fake.subscriptions.set('sub_1', { ...snapshot, status: 'canceled', cancelAt: Date.now() - 1000 });

    expect(scheduleReconcile(b.t.jobs.queue, Date.now())).not.toBeNull();
    expect(await b.t.jobs.runner.runDue()).toBe(1);

    expect(b.subscription()?.status).toBe('canceled');
    expect((await b.accessOf()).plan.id).toBe('free');
    expect(b.audit()).toEqual([
      { actor_type: 'provider', actor_id: 'fake', action: 'subscription.update', subject_id: b.userId },
      { actor_type: 'system', actor_id: RECONCILE_JOB, action: 'subscription.update', subject_id: b.userId },
    ]);
  });

  it('writes nothing when the provider agrees', async () => {
    await subscribe();
    scheduleReconcile(b.t.jobs.queue, Date.now());
    await b.t.jobs.runner.runDue();
    expect(b.audit()).toHaveLength(1);
  });

  it('runs once a day, queueing tomorrow\'s run before doing the work', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.UTC(2026, 9, 12, 15));
    const today = utcDay(Date.now());
    expect(scheduleReconcile(b.t.jobs.queue, Date.now())).not.toBeNull();
    expect(scheduleReconcile(b.t.jobs.queue, Date.now() + 60_000)).toBeNull();

    await b.t.jobs.runner.runDue();
    expect(jobs()).toEqual([
      expect.objectContaining({ kind: RECONCILE_JOB, done: 1, dedupe_key: `${RECONCILE_JOB}@${today}` }),
      expect.objectContaining({ kind: RECONCILE_JOB, done: 0, run_at: (today + 1) * DAY_MS + 3 * 3_600_000, dedupe_key: `${RECONCILE_JOB}@${today + 1}` }),
    ]);
  });

  it('skips manual grants and subscriptions that have ended', async () => {
    grantPlan(b.t.db, { userId: b.userId, planId: 'pro', actor: { type: 'admin', id: 'test' } });
    const snapshot = await subscribe();
    await b.deliver([{ type: 'subscription.canceled', eventId: b.nextEventId(), providerSubId: 'sub_1', endsAt: Date.now() - 1 }]);
    const fetched = vi.spyOn(b.fake, 'fetchSubscription');
    b.fake.subscriptions.set('sub_1', { ...snapshot, status: 'active' });

    scheduleReconcile(b.t.jobs.queue, Date.now());
    await b.t.jobs.runner.runDue();
    expect(fetched).not.toHaveBeenCalled();
    expect(b.subscription()?.status).toBe('canceled');
  });

  it('refreshes the rest when one subscription can\'t be fetched, and retries the run', async () => {
    const second = await subscribe('sub_2');
    await subscribe('sub_1');
    b.fake.subscriptions.delete('sub_1');
    b.fake.subscriptions.set('sub_2', { ...second, status: 'past_due' });

    scheduleReconcile(b.t.jobs.queue, Date.now());
    await b.t.jobs.runner.runDue();
    expect(b.subscription('sub_2')?.status).toBe('past_due');
    const [run] = jobs();
    expect(run).toMatchObject({ attempts: 1, done: 0, last_error: '1 of 2 subscriptions not refreshed: sub_1' });
    expect(run.run_at).toBeGreaterThan(Date.now());
  });
});
