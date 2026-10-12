import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadEnv } from '../env';
import { ORIGIN, startApp } from '../testing/helpers';
import { createFakeProvider } from './fake-provider';
import { billingProviderFor } from './registry';
import { PRO_MONTHLY, startBilling, type BillingTest } from './testing';

let b: BillingTest | undefined;

afterEach(() => {
  vi.unstubAllEnvs();
  b?.t.close();
  b = undefined;
});

const checkout = (body: unknown, cookie = b!.jar.get()) => b!.t.post('/api/billing/checkout', body, { cookie });
const portal = (cookie = b!.jar.get()) => b!.t.post('/api/billing/portal', {}, { cookie });

describe('without a provider', () => {
  it('answers 501 to checkout and portal, signed in or not', async () => {
    const t = await startApp();
    const jar = await t.signUpVerified();
    for (const path of ['/api/billing/checkout', '/api/billing/portal']) {
      for (const cookie of [jar.get(), '']) {
        const res = await t.post(path, { plan: 'pro' }, { cookie });
        expect(res.status).toBe(501);
        expect(await res.json()).toEqual({ error: 'billing_unavailable' });
      }
    }
    expect((await t.app.request('/api/billing/webhook/fake', { method: 'POST', body: '{}' })).status).toBe(404);
    t.close();
  });
});

describe('checkout', () => {
  it('asks the provider for a hosted page and records the customer it returns', async () => {
    b = await startBilling();
    const res = await checkout({ plan: 'pro' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: 'https://billing.example/checkout/1' });
    expect(b.fake.checkouts[0]).toEqual({
      subject: { type: 'user', id: b.userId },
      planPriceId: PRO_MONTHLY,
      successUrl: `${ORIGIN}/?account=settings&billing=success`,
      cancelUrl: `${ORIGIN}/?account=settings&billing=canceled`,
      customerId: undefined,
      email: 'ada@example.com',
    });
    expect(b.t.db.prepare('SELECT provider, customer_id, subject_id FROM bill_customer').all())
      .toEqual([{ provider: 'fake', customer_id: `cus_${b.userId}`, subject_id: b.userId }]);

    // A second attempt (the first was abandoned) reuses the customer.
    expect((await checkout({ plan: 'pro' })).status).toBe(200);
    expect(b.fake.checkouts[1].customerId).toBe(`cus_${b.userId}`);
    expect(b.count('bill_customer')).toBe(1);
  });

  it('needs a session', async () => {
    b = await startBilling();
    const res = await checkout({ plan: 'pro' }, '');
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'sign_in_required' });
    expect(b.fake.checkouts).toEqual([]);
  });

  it('sells only public plans priced for this provider', async () => {
    b = await startBilling();
    b.t.db.prepare("INSERT INTO bill_plan (plan_id, name, public, prices, created_at) VALUES ('team', 'Team', 0, ?, 0)")
      .run(JSON.stringify({ fake: { monthly: 'price_team' } }));
    for (const body of [{ plan: 'free' }, { plan: 'anon' }, { plan: 'team' }, { plan: 'gold' }, { plan: 'pro', interval: 'yearly' }]) {
      const res = await checkout(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(await res.json()).toMatchObject({ error: 'plan_unavailable' });
    }
    const bad = await checkout({ plan: 'pro', interval: 'weekly' });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toMatchObject({ error: 'invalid_request' });
    expect(b.fake.checkouts).toEqual([]);
  });

  it('refuses a second paid subscription, but not a comped one', async () => {
    b = await startBilling();
    b.t.db.prepare(`
      INSERT INTO bill_subscription (provider, provider_sub_id, subject_type, subject_id, plan_id, status, created_at, updated_at)
      VALUES ('manual', 'manual:user:x', 'user', ?, 'pro', 'active', 0, 0)`).run(b.userId);
    expect((await checkout({ plan: 'pro' })).status).toBe(200);

    await b.deliver([{ type: 'subscription.upserted', eventId: b.nextEventId(), snapshot: b.snapshot() }]);
    const res = await checkout({ plan: 'pro' });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'already_subscribed' });
  });

  it('answers 502 when the provider fails', async () => {
    b = await startBilling();
    vi.spyOn(b.fake, 'checkout').mockRejectedValue(new Error('provider down'));
    const res = await checkout({ plan: 'pro' });
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'provider_error' });
    expect(b.count('bill_customer')).toBe(0);
  });
});

describe('portal', () => {
  it('opens the provider\'s page for a known customer', async () => {
    b = await startBilling();
    const none = await portal();
    expect(none.status).toBe(404);
    expect(await none.json()).toEqual({ error: 'no_customer' });

    await checkout({ plan: 'pro' });
    const res = await portal();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: `https://billing.example/portal/cus_${b.userId}` });
    expect((await portal('')).status).toBe(401);
  });
});

describe('choosing the provider', () => {
  it('is off when BILLING_PROVIDER is unset or empty', () => {
    expect(billingProviderFor(loadEnv({}))).toBeNull();
    expect(billingProviderFor(loadEnv({ BILLING_PROVIDER: '' }))).toBeNull();
  });

  it('allows the fake only under NODE_ENV=test', () => {
    expect(billingProviderFor(loadEnv({ NODE_ENV: 'test', BILLING_PROVIDER: 'fake' }))?.id).toBe('fake');
    expect(() => loadEnv({ NODE_ENV: 'development', BILLING_PROVIDER: 'fake' })).toThrow(/tests only.*at BILLING_PROVIDER/s);
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => createFakeProvider()).toThrow(/tests only/);
  });

  it('refuses a provider that has no adapter yet', () => {
    expect(() => loadEnv({ BILLING_PROVIDER: 'stripe' })).toThrow(/no adapter for "stripe" yet/);
    expect(() => loadEnv({ BILLING_PROVIDER: 'paypal' })).toThrow(/BILLING_PROVIDER/);
  });
});
