import { expect } from 'vitest';
import type { Access } from '@takip/core/entitlements';
import { startApp } from '../testing/helpers';
import { createFakeProvider } from './fake-provider';
import type { BillingEvent, SubscriptionSnapshot } from './provider';

export const PRO_MONTHLY = 'price_pro_monthly';
export const DAY = 24 * 60 * 60 * 1000;

/** An app on the fake provider, `pro` priced for it, and one signed-in user. */
export async function startBilling() {
  const fake = createFakeProvider();
  const t = await startApp({}, undefined, { billing: fake });
  t.db.prepare("UPDATE bill_plan SET prices = ? WHERE plan_id = 'pro'").run(JSON.stringify({ fake: { monthly: PRO_MONTHLY } }));
  const jar = await t.signUpVerified();
  const userId = (await t.session(jar.get()))!.user.id;

  let events = 0;
  const snapshot = (overrides: Partial<SubscriptionSnapshot> = {}): SubscriptionSnapshot => ({
    providerSubId: 'sub_1',
    priceId: PRO_MONTHLY,
    status: 'active',
    currentPeriodEnd: Date.now() + 30 * DAY,
    cancelAt: null,
    customerId: `cus_${userId}`,
    subject: { type: 'user', id: userId },
    ...overrides,
  });

  return {
    t,
    fake,
    jar,
    userId,
    snapshot,
    nextEventId: () => `evt_${++events}`,
    deliver: (list: BillingEvent[], options?: Parameters<typeof fake.delivery>[1]) =>
      t.app.request('/api/billing/webhook/fake', fake.delivery(list, options)),
    async accessOf() {
      const res = await t.app.request('/api/v1/me/access', { headers: { cookie: jar.get() } });
      expect(res.status).toBe(200);
      return (await res.json()) as Access;
    },
    subscription: (providerSubId = 'sub_1') => t.db.prepare('SELECT * FROM bill_subscription WHERE provider_sub_id = ?').get(providerSubId) as {
      plan_id: string; status: string; current_period_end: number | null; cancel_at: number | null; grace_until: number | null; subject_id: string;
    } | undefined,
    audit: () => t.db.prepare("SELECT actor_type, actor_id, action, subject_id FROM audit_event WHERE action LIKE 'subscription.%' ORDER BY audit_id").all() as
      { actor_type: string; actor_id: string; action: string; subject_id: string }[],
    count: (table: 'bill_event' | 'bill_subscription' | 'bill_customer' | 'audit_event') => t.db.prepare(`SELECT COUNT(*) FROM ${table}`).pluck().get() as number,
  };
}

export type BillingTest = Awaited<ReturnType<typeof startBilling>>;
