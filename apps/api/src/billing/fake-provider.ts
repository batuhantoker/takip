import { createHmac, timingSafeEqual } from 'node:crypto';
import { WebhookError, type BillingEvent, type BillingProvider, type SubscriptionSnapshot } from './provider';

export const FAKE_SIGNATURE_HEADER = 'x-fake-signature';
const TOLERANCE_MS = 5 * 60_000;

type CheckoutRequest = Parameters<BillingProvider['checkout']>[0];

/**
 * The test double: JSON webhooks signed like Stripe's (`t=<ms>,v1=<hmac of "t.body">`) and subscriptions
 * held in memory for reconciliation. It refuses to exist outside NODE_ENV=test.
 */
export function createFakeProvider({ secret = 'fake-webhook-secret', now = () => Date.now() } = {}) {
  if (process.env.NODE_ENV !== 'test') throw new Error('the fake billing provider is for tests only');

  const subscriptions = new Map<string, SubscriptionSnapshot>();
  const checkouts: CheckoutRequest[] = [];
  const hmac = (key: string, at: number, body: string) => createHmac('sha256', key).update(`${at}.${body}`).digest('hex');

  function signatureValid(header: string, body: string) {
    const parts = Object.fromEntries(header.split(',').map(part => part.split('=', 2)));
    const at = Number(parts.t);
    if (!Number.isFinite(at) || Math.abs(now() - at) > TOLERANCE_MS || !parts.v1) return false;
    const expected = Buffer.from(hmac(secret, at, body));
    const given = Buffer.from(parts.v1);
    return given.length === expected.length && timingSafeEqual(given, expected);
  }

  const provider: BillingProvider = {
    id: 'fake',

    async checkout(p) {
      checkouts.push(p);
      return { url: `https://billing.example/checkout/${checkouts.length}`, customerId: p.customerId ?? `cus_${p.subject.id}` };
    },

    async portal({ customerId }) {
      return { url: `https://billing.example/portal/${customerId}` };
    },

    async verifyWebhook(req) {
      const body = await req.text();
      if (!signatureValid(req.headers.get(FAKE_SIGNATURE_HEADER) ?? '', body)) throw new WebhookError('invalid_signature');
      let events: unknown;
      try {
        events = (JSON.parse(body) as { events?: unknown }).events;
      } catch {
        events = null;
      }
      if (!Array.isArray(events)) throw new WebhookError('invalid_payload');
      return events as BillingEvent[];
    },

    async fetchSubscription(providerSubId) {
      const snapshot = subscriptions.get(providerSubId);
      if (!snapshot) throw new Error(`fake: no subscription ${providerSubId}`);
      return structuredClone(snapshot);
    },
  };

  return {
    ...provider,
    /** What the provider holds; tests change it to stage a webhook that never arrived. */
    subscriptions,
    checkouts,
    /** A delivery as the provider would send it, ready for app.request(). */
    delivery(events: BillingEvent[], { signedAt = now(), key = secret } = {}) {
      const body = JSON.stringify({ events });
      return {
        method: 'POST',
        headers: { 'content-type': 'application/json', [FAKE_SIGNATURE_HEADER]: `t=${signedAt},v1=${hmac(key, signedAt, body)}` },
        body,
      };
    },
  };
}

export type FakeProvider = ReturnType<typeof createFakeProvider>;
