import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { createMiddleware } from 'hono/factory';
import { z } from 'zod';
import { withAccess, type AccessEnv } from '../access/middleware';
import type { AccessResolver } from '../access/resolver';
import type { Auth } from '../auth/auth';
import type { AppDb } from '../db/app-db';
import { createEventReceiver } from './events';
import { paidSubscriptionCheck } from './paid-subscription';
import { WebhookError, type BillingEvent, type BillingProvider } from './provider';
import { BillingError, createSubscriptions } from './subscriptions';

// Landing URLs on the map: the account dialog opens on settings, where the Plan section lives.
const CHECKOUT_SUCCESS = '/?account=settings&billing=success';
const CHECKOUT_CANCELED = '/?account=settings&billing=canceled';
const PORTAL_RETURN = '/?account=settings';
const MAX_WEBHOOK_BYTES = 1024 * 1024;

const checkoutBody = z.object({ plan: z.string().min(1), interval: z.enum(['monthly', 'yearly']).default('monthly') });

type BillingEnv = { Variables: AccessEnv['Variables'] & { userId: string } };
type Deps = { db: AppDb; auth: Auth; access: AccessResolver; provider: BillingProvider | null };

/** Mounted at /api/billing. The webhook sits outside the session and rate-limit middleware: providers carry neither. */
export function billingRoutes({ db, auth, access, provider }: Deps) {
  const app = new Hono<BillingEnv>();
  const receiver = createEventReceiver(db, createSubscriptions(db), access);

  app.post(
    '/webhook/:provider',
    bodyLimit({ maxSize: MAX_WEBHOOK_BYTES, onError: c => c.json({ error: 'payload_too_large' }, 413) }),
    async c => {
      if (!provider || c.req.param('provider') !== provider.id) return c.json({ error: 'unknown_provider' }, 404);
      // The signature covers the exact bytes, so the provider reads the untouched body; the copy is what we store.
      const copy = c.req.raw.clone();
      let events: BillingEvent[];
      try {
        events = await provider.verifyWebhook(c.req.raw);
      } catch (err) {
        if (err instanceof WebhookError) return c.json({ error: err.code }, 400);
        throw err;
      }
      const payload = await copy.text();
      let duplicates = 0;
      for (const event of events) {
        try {
          if (receiver.receive(provider.id, event, payload) === 'duplicate') duplicates++;
        } catch (err) {
          if (!(err instanceof BillingError)) throw err;
          c.var.logger.warn({ eventId: event.eventId, type: event.type, reason: err.message }, 'billing event rejected');
          return c.json({ error: 'event_rejected', message: err.message }, 422);
        }
      }
      return c.json({ ok: true, duplicate: events.length > 0 && duplicates === events.length });
    },
  );

  if (!provider) {
    app.post('/checkout', c => c.json({ error: 'billing_unavailable' }, 501));
    app.post('/portal', c => c.json({ error: 'billing_unavailable' }, 501));
    return app;
  }
  const billing = provider;
  const appUrl = auth.options.baseURL;
  const planPrices = db.prepare('SELECT prices FROM bill_plan WHERE plan_id = ? AND public = 1 AND archived_at IS NULL').pluck();
  const customerOf = db.prepare("SELECT customer_id FROM bill_customer WHERE subject_type = 'user' AND subject_id = ? AND provider = ?").pluck();
  const emailOf = db.prepare('SELECT email FROM auth_user WHERE id = ?').pluck();
  const hasPaidSubscription = paidSubscriptionCheck(db);
  const recordCustomer = db.prepare(`
    INSERT INTO bill_customer (provider, customer_id, subject_type, subject_id, created_at) VALUES (?, ?, 'user', ?, ?)
    ON CONFLICT DO NOTHING`);

  const signedIn = createMiddleware<BillingEnv>(async (c, next) => {
    const { principal } = c.var;
    if (principal.kind !== 'user') return c.json({ error: 'sign_in_required' }, 401);
    c.set('userId', principal.userId);
    c.header('Cache-Control', 'no-store');
    await next();
  });
  app.use('/checkout', withAccess(auth, access), signedIn);
  app.use('/portal', withAccess(auth, access), signedIn);

  async function callProvider<T>(c: Context<BillingEnv>, call: () => Promise<T>): Promise<T | Response> {
    try {
      return await call();
    } catch (err) {
      c.var.logger.error({ err }, 'billing provider call failed');
      return c.json({ error: 'provider_error' }, 502);
    }
  }

  app.post('/checkout', async c => {
    const parsed = checkoutBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: 'invalid_request', message: z.prettifyError(parsed.error) }, 400);
    const { plan, interval } = parsed.data;
    const prices = planPrices.get(plan) as string | undefined;
    const priceId = prices ? (JSON.parse(prices) as Record<string, Record<string, string>>)[billing.id]?.[interval] : undefined;
    if (!priceId) return c.json({ error: 'plan_unavailable', plan, interval }, 400);
    const { userId } = c.var;
    if (hasPaidSubscription(userId)) return c.json({ error: 'already_subscribed' }, 409);

    const customerId = customerOf.get(userId, billing.id) as string | undefined;
    const result = await callProvider(c, () => billing.checkout({
      subject: { type: 'user', id: userId },
      planPriceId: priceId,
      successUrl: new URL(CHECKOUT_SUCCESS, appUrl).href,
      cancelUrl: new URL(CHECKOUT_CANCELED, appUrl).href,
      customerId,
      email: emailOf.get(userId) as string | undefined,
    }));
    if (result instanceof Response) return result;
    if (result.customerId && !customerId) recordCustomer.run(billing.id, result.customerId, userId, Date.now());
    return c.json({ url: result.url });
  });

  app.post('/portal', async c => {
    const customerId = customerOf.get(c.var.userId, billing.id) as string | undefined;
    if (!customerId) return c.json({ error: 'no_customer' }, 404);
    const result = await callProvider(c, () => billing.portal({ customerId, returnUrl: new URL(PORTAL_RETURN, appUrl).href }));
    if (result instanceof Response) return result;
    return c.json({ url: result.url });
  });

  return app;
}
