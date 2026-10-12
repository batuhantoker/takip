import type { Subject } from '../access/resolver';

/** The candidates of backend.md §7.4, plus the test double. */
export const PROVIDER_IDS = ['stripe', 'paddle', 'polar', 'lemonsqueezy', 'iyzico', 'fake'] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete' | 'paused' | 'expired';

/** A subscription as the provider reports it, normalised. Times are epoch ms. */
export type SubscriptionSnapshot = {
  providerSubId: string;
  /** Matched against bill_plan.prices[provider] to find the plan. */
  priceId: string;
  status: SubscriptionStatus;
  currentPeriodEnd: number | null;
  /** When access ends for a subscription canceled at its period end. */
  cancelAt: number | null;
  customerId?: string;
  /** Echoed back from checkout metadata; without it, bill_customer must know `customerId`. */
  subject?: Subject;
  /** Kept in bill_subscription.provider_data. */
  data?: Record<string, unknown>;
};

export type BillingEvent =
  | { type: 'subscription.upserted'; eventId: string; snapshot: SubscriptionSnapshot }
  | { type: 'subscription.canceled'; eventId: string; providerSubId: string; endsAt: number }
  | { type: 'payment.failed'; eventId: string; providerSubId: string };

/** One payment provider behind a common contract (backend.md §7.3). No card data ever reaches us. */
export interface BillingProvider {
  id: ProviderId;
  /** `customerId` reuses the subject's existing customer; the result's `customerId` is recorded in bill_customer. */
  checkout(p: { subject: Subject; planPriceId: string; successUrl: string; cancelUrl: string; customerId?: string; email?: string }): Promise<{ url: string; customerId?: string }>;
  portal(p: { customerId: string; returnUrl: string }): Promise<{ url: string }>;
  /** Checks the signature over the raw body, then normalises. Event types we don't use come back as []. */
  verifyWebhook(req: Request): Promise<BillingEvent[]>;
  fetchSubscription(providerSubId: string): Promise<SubscriptionSnapshot>;
}

/** A delivery we refuse outright: answered 400 and never stored. */
export class WebhookError extends Error {
  constructor(readonly code: 'invalid_signature' | 'invalid_payload') {
    super(code);
  }
}
