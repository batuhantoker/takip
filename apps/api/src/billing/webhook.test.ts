import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GRACE_MS } from './subscriptions';
import { DAY, PRO_MONTHLY, startBilling, type BillingTest } from './testing';

let b: BillingTest;

beforeEach(async () => {
  b = await startBilling();
});

afterEach(() => {
  vi.useRealTimers();
  b.t.close();
});

function later(ms: number) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(Date.now() + ms);
}

const upserted = (overrides = {}) => ({ type: 'subscription.upserted' as const, eventId: b.nextEventId(), snapshot: b.snapshot(overrides) });

describe('a signed webhook', () => {
  it('upserts the subscription and changes access at once', async () => {
    expect((await b.accessOf()).plan.id).toBe('free');

    const res = await b.deliver([upserted()]);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, duplicate: false });

    // No manual invalidation: the webhook clears the cached "free" answer itself.
    expect(await b.accessOf()).toMatchObject({
      plan: { id: 'pro' },
      subscription: { provider: 'fake', status: 'active', until: null },
      entitlements: { 'api.enabled': true },
    });
    expect(b.subscription()).toMatchObject({ plan_id: 'pro', status: 'active', subject_id: b.userId, grace_until: null });
    expect(b.t.db.prepare('SELECT type, processed_at IS NOT NULL AS done, error FROM bill_event').all())
      .toEqual([{ type: 'subscription.upserted', done: 1, error: null }]);
    expect(b.t.db.prepare('SELECT customer_id, subject_id FROM bill_customer').all()).toEqual([{ customer_id: `cus_${b.userId}`, subject_id: b.userId }]);
    expect(b.audit()).toEqual([{ actor_type: 'provider', actor_id: 'fake', action: 'subscription.update', subject_id: b.userId }]);
  });

  it('finds the user through bill_customer when the event names only the customer', async () => {
    await b.deliver([upserted()]);
    const res = await b.deliver([upserted({ providerSubId: 'sub_2', subject: undefined })]);
    expect(res.status).toBe(200);
    expect(b.subscription('sub_2')?.subject_id).toBe(b.userId);
  });

  it('is applied once however often it is delivered', async () => {
    const event = upserted();
    expect(await (await b.deliver([event])).json()).toEqual({ ok: true, duplicate: false });

    const replay = await b.deliver([{ ...event, snapshot: { ...event.snapshot, status: 'canceled' } }]);
    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual({ ok: true, duplicate: true });
    expect(b.subscription()?.status).toBe('active');
    expect([b.count('bill_event'), b.count('bill_subscription'), b.audit().length]).toEqual([1, 1, 1]);
  });
});

describe('a webhook we refuse', () => {
  it('answers 400 for a bad signature and writes nothing', async () => {
    for (const options of [{ key: 'not-the-secret' }, { signedAt: Date.now() - 10 * 60_000 }]) {
      const res = await b.deliver([upserted()], options);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'invalid_signature' });
    }
    const unsigned = await b.t.app.request('/api/billing/webhook/fake', { method: 'POST', body: JSON.stringify({ events: [upserted()] }) });
    expect(unsigned.status).toBe(400);
    expect([b.count('bill_event'), b.count('bill_subscription'), b.count('bill_customer'), b.count('audit_event')]).toEqual([0, 0, 0, 0]);
    expect((await b.accessOf()).plan.id).toBe('free');
  });

  it('answers 404 for a provider that isn\'t configured', async () => {
    const res = await b.t.app.request('/api/billing/webhook/stripe', b.fake.delivery([upserted()]));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'unknown_provider' });
  });

  it('keeps an event it can\'t apply, so the provider\'s retry applies it once the price exists', async () => {
    const event = upserted({ priceId: 'price_new' });
    const res = await b.deliver([event]);
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ error: 'event_rejected', message: 'no plan has fake price price_new' });
    expect(b.t.db.prepare('SELECT processed_at, error FROM bill_event').get()).toEqual({ processed_at: null, error: 'no plan has fake price price_new' });
    expect([b.count('bill_subscription'), b.count('audit_event')]).toEqual([0, 0]);

    b.t.db.prepare("UPDATE bill_plan SET prices = ? WHERE plan_id = 'pro'").run(JSON.stringify({ fake: { monthly: PRO_MONTHLY, yearly: 'price_new' } }));
    const retry = await b.deliver([event]);
    expect(await retry.json()).toEqual({ ok: true, duplicate: false });
    expect(b.subscription()?.plan_id).toBe('pro');
    expect(b.t.db.prepare('SELECT processed_at IS NOT NULL AS done, error FROM bill_event').get()).toEqual({ done: 1, error: null });
  });

  it('rejects events for a subscription it has never seen', async () => {
    const res = await b.deliver([{ type: 'payment.failed', eventId: b.nextEventId(), providerSubId: 'sub_unknown' }]);
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ error: 'event_rejected', message: 'unknown subscription sub_unknown' });
  });
});

describe('a failed payment', () => {
  it('keeps access through the grace period, without extending it, and loses it after', async () => {
    await b.deliver([upserted()]);
    later(0);
    const failedAt = Date.now();
    await b.deliver([{ type: 'payment.failed', eventId: b.nextEventId(), providerSubId: 'sub_1' }]);
    expect(b.subscription()).toMatchObject({ status: 'past_due', grace_until: failedAt + GRACE_MS });
    expect(await b.accessOf()).toMatchObject({ plan: { id: 'pro' }, subscription: { status: 'past_due' } });

    later(6 * DAY);
    // The provider's next retry fails too, and its update still says past_due.
    await b.deliver([{ type: 'payment.failed', eventId: b.nextEventId(), providerSubId: 'sub_1' }]);
    await b.deliver([upserted({ status: 'past_due' })]);
    expect(b.subscription()?.grace_until).toBe(failedAt + GRACE_MS);
    expect((await b.accessOf()).plan.id).toBe('pro');

    later(2 * DAY);
    expect((await b.accessOf()).plan.id).toBe('free');
    expect(b.audit().map(a => a.action)).toEqual(['subscription.update', 'subscription.payment_failed', 'subscription.payment_failed', 'subscription.update']);
  });

  it('clears the grace once a payment goes through', async () => {
    await b.deliver([upserted({ status: 'past_due' })]);
    expect(b.subscription()?.grace_until).not.toBeNull();
    await b.deliver([upserted({ status: 'active' })]);
    expect(b.subscription()).toMatchObject({ status: 'active', grace_until: null });
  });
});

describe('a cancellation', () => {
  it('at the period end keeps access until that date', async () => {
    const periodEnd = Date.now() + 10 * DAY;
    await b.deliver([upserted({ currentPeriodEnd: periodEnd })]);
    await b.deliver([{ type: 'subscription.canceled', eventId: b.nextEventId(), providerSubId: 'sub_1', endsAt: periodEnd }]);
    expect(b.subscription()).toMatchObject({ status: 'active', cancel_at: periodEnd });
    expect(await b.accessOf()).toMatchObject({ plan: { id: 'pro' }, subscription: { status: 'active', until: periodEnd } });

    later(9 * DAY);
    expect((await b.accessOf()).plan.id).toBe('pro');
    later(2 * DAY);
    // No final webhook has arrived; the date alone ends it.
    expect((await b.accessOf()).plan.id).toBe('free');

    await b.deliver([{ type: 'subscription.canceled', eventId: b.nextEventId(), providerSubId: 'sub_1', endsAt: periodEnd }]);
    expect(b.subscription()?.status).toBe('canceled');
    expect(b.audit().map(a => a.action)).toEqual(['subscription.update', 'subscription.cancel', 'subscription.cancel']);
  });

  it('effective now ends access at once', async () => {
    await b.deliver([upserted()]);
    expect((await b.accessOf()).plan.id).toBe('pro');
    await b.deliver([{ type: 'subscription.canceled', eventId: b.nextEventId(), providerSubId: 'sub_1', endsAt: Date.now() }]);
    expect(b.subscription()?.status).toBe('canceled');
    expect((await b.accessOf()).plan.id).toBe('free');
  });
});
