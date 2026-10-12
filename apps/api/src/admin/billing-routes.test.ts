import { afterEach, describe, expect, it } from 'vitest';
import { RECONCILE_JOB } from '../billing/reconcile';
import { startBilling } from '../billing/testing';
import { USER, startApp, type TestApp } from '../testing/helpers';
import { adminKit } from './testing';

let t: TestApp;

afterEach(() => t.close());

type Billing = {
  provider: string | null;
  subscriptions: { byStatus: { provider: string; status: string; count: number }[]; recent: { email: string; planId: string; status: string }[] };
  events: { eventId: string; type: string; processedAt: number | null; error: string | null }[];
  jobs: { counts: { pending: number; failed: number; done: number }; pending: { id: number; kind: string }[]; recent: { id: number; kind: string }[] };
};

const reconcileAudit = () => t.db.prepare("SELECT actor_type, actor_id, subject_type, subject_id, data FROM audit_event WHERE action = 'billing.reconcile'").all();

describe('billing in the console', () => {
  it('is behind the gate', async () => {
    t = await startApp();
    const kit = adminKit(t);
    const user = await t.signUpVerified();
    await kit.expectGated('GET', '/api/admin/billing', user);
    await kit.expectGated('POST', '/api/admin/billing/reconcile', user);
    expect(t.db.prepare('SELECT count(*) FROM job').pluck().get()).toBe(0);
  });

  it('says plainly when no provider is configured, and queues nothing', async () => {
    t = await startApp();
    const kit = adminKit(t);
    const { jar } = await kit.admin();
    expect(await kit.json(await kit.call(jar, 'GET', '/api/admin/billing'))).toMatchObject({ provider: null, events: [], jobs: { counts: { pending: 0, failed: 0, done: 0 } } });
    const refused = await kit.call(jar, 'POST', '/api/admin/billing/reconcile');
    expect([refused.status, await kit.json(refused)]).toEqual([501, { error: 'billing_unavailable' }]);
    expect(t.db.prepare('SELECT count(*) FROM job').pluck().get()).toBe(0);
    expect(reconcileAudit()).toEqual([]);
  });

  it('shows subscriptions, provider events and jobs, and queues one reconciliation at a time, audited', async () => {
    const b = await startBilling();
    t = b.t;
    const kit = adminKit(t);
    await b.deliver([{ type: 'subscription.upserted', eventId: b.nextEventId(), snapshot: b.snapshot() }]);
    b.fake.subscriptions.set('sub_1', b.snapshot());
    const { jar, id: rootId } = await kit.admin();

    const before = await kit.json<Billing>(await kit.call(jar, 'GET', '/api/admin/billing'));
    expect(before.provider).toBe('fake');
    expect(before.subscriptions.byStatus).toEqual([{ provider: 'fake', status: 'active', count: 1 }]);
    expect(before.subscriptions.recent).toMatchObject([{ email: USER.email, planId: 'pro', status: 'active' }]);
    expect(before.events).toMatchObject([{ eventId: 'evt_1', type: 'subscription.upserted', processedAt: expect.any(Number), error: null }]);
    expect(JSON.stringify(before.events)).not.toContain('payload');

    const queued = await kit.json<{ jobId: number; queued: boolean }>(await kit.call(jar, 'POST', '/api/admin/billing/reconcile'));
    expect(queued).toEqual({ ok: true, jobId: expect.any(Number), queued: true });
    expect(await kit.json(await kit.call(jar, 'POST', '/api/admin/billing/reconcile'))).toEqual({ ok: true, jobId: queued.jobId, queued: false });
    expect(reconcileAudit()).toEqual([{ actor_type: 'admin', actor_id: rootId, subject_type: 'billing', subject_id: 'fake', data: JSON.stringify({ jobId: queued.jobId }) }]);
    expect((await kit.json<Billing>(await kit.call(jar, 'GET', '/api/admin/billing'))).jobs.pending).toMatchObject([{ id: queued.jobId, kind: RECONCILE_JOB }]);

    // The handler also queues tomorrow's daily run.
    expect(await t.jobs.runner.runDue()).toBe(1);
    const after = await kit.json<Billing>(await kit.call(jar, 'GET', '/api/admin/billing'));
    expect(after.jobs.counts).toEqual({ pending: 1, failed: 0, done: 1 });
    expect(after.jobs.recent).toMatchObject([{ id: queued.jobId, kind: RECONCILE_JOB }]);

    expect(await kit.json(await kit.call(jar, 'POST', '/api/admin/billing/reconcile'))).toMatchObject({ queued: true });
    expect(reconcileAudit()).toHaveLength(2);
  });
});
