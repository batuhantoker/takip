import type { Subject } from '../access/resolver';
import { DAY_MS } from '../access/usage';
import type { AppDb } from '../db/app-db';
import type { BillingEvent, ProviderId, SubscriptionSnapshot, SubscriptionStatus } from './provider';

/** How long a failed renewal keeps its plan (backend.md §7.1). */
export const GRACE_MS = 7 * DAY_MS;

export type BillingActor = { type: 'provider' | 'system'; id: string };

/** A webhook or snapshot we can't apply: unknown price, subject or subscription. */
export class BillingError extends Error {}

type Row = {
  subscription_id: number;
  subject_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  current_period_end: number | null;
  cancel_at: number | null;
  grace_until: number | null;
};
type State = Pick<Row, 'plan_id' | 'status' | 'current_period_end' | 'cancel_at' | 'grace_until'>;

const sameState = (a: State, b: State) =>
  a.plan_id === b.plan_id && a.status === b.status && a.current_period_end === b.current_period_end
  && a.cancel_at === b.cancel_at && a.grace_until === b.grace_until;

const stateOf = ({ plan_id, status, current_period_end, cancel_at, grace_until }: State): State =>
  ({ plan_id, status, current_period_end, cancel_at, grace_until });

/**
 * Writes provider subscriptions into bill_subscription (backend.md §7.3). Each change writes an audit_event;
 * so does every webhook event, changed or not. Callers run these inside their transaction and invalidate
 * the access cache after it commits.
 */
export function createSubscriptions(db: AppDb, { now = () => Date.now() } = {}) {
  const byProviderId = db.prepare(`
    SELECT subscription_id, subject_id, plan_id, status, current_period_end, cancel_at, grace_until
    FROM bill_subscription WHERE provider = ? AND provider_sub_id = ?`);
  const insert = db.prepare(`
    INSERT INTO bill_subscription
      (provider, provider_sub_id, subject_type, subject_id, plan_id, status, current_period_end, cancel_at, grace_until, provider_data, created_at, updated_at)
    VALUES (@provider, @providerSubId, 'user', @subjectId, @plan_id, @status, @current_period_end, @cancel_at, @grace_until, @data, @at, @at)`);
  const update = db.prepare(`
    UPDATE bill_subscription SET plan_id = @plan_id, status = @status, current_period_end = @current_period_end,
      cancel_at = @cancel_at, grace_until = @grace_until, provider_data = COALESCE(@data, provider_data), updated_at = @at
    WHERE subscription_id = @id`);
  const plans = db.prepare('SELECT plan_id, prices FROM bill_plan');
  const customerSubject = db.prepare("SELECT subject_id FROM bill_customer WHERE provider = ? AND customer_id = ? AND subject_type = 'user'").pluck();
  const userExists = db.prepare('SELECT 1 FROM auth_user WHERE id = ?').pluck();
  const recordCustomer = db.prepare(`
    INSERT INTO bill_customer (provider, customer_id, subject_type, subject_id, created_at) VALUES (?, ?, 'user', ?, ?)
    ON CONFLICT DO NOTHING`);
  const audit = db.prepare(`
    INSERT INTO audit_event (at, actor_type, actor_id, action, subject_type, subject_id, data)
    VALUES (?, ?, ?, ?, 'user', ?, ?)`);

  /** Archived plans included: a subscriber keeps a plan that is no longer sold. */
  function planFor(provider: ProviderId, priceId: string): string {
    for (const { plan_id, prices } of plans.all() as { plan_id: string; prices: string }[]) {
      const own = (JSON.parse(prices) as Record<string, Record<string, string>>)[provider] ?? {};
      if (Object.values(own).includes(priceId)) return plan_id;
    }
    throw new BillingError(`no plan has ${provider} price ${priceId}`);
  }

  function subjectFor(provider: ProviderId, snapshot: SubscriptionSnapshot): Subject {
    const id = snapshot.subject?.id ?? (snapshot.customerId ? (customerSubject.get(provider, snapshot.customerId) as string | undefined) : undefined);
    if (!id) throw new BillingError(`subscription ${snapshot.providerSubId} names no known customer`);
    if (!userExists.get(id)) throw new BillingError(`subscription ${snapshot.providerSubId} belongs to an unknown user`);
    return { type: 'user', id };
  }

  function existing(provider: ProviderId, providerSubId: string) {
    return byProviderId.get(provider, providerSubId) as Row | undefined;
  }

  function write(provider: ProviderId, providerSubId: string, before: Row | undefined, after: State, p: {
    actor: BillingActor; action: string; eventId?: string; subjectId?: string; data?: Record<string, unknown>;
  }): boolean {
    const at = now();
    const changed = !before || !sameState(before, after);
    const data = p.data ? JSON.stringify(p.data) : null;
    if (before) {
      if (changed || data) update.run({ ...after, data, at, id: before.subscription_id });
    } else {
      insert.run({ ...after, provider, providerSubId, subjectId: p.subjectId, data: data ?? '{}', at });
    }
    if (changed || p.eventId) {
      audit.run(at, p.actor.type, p.actor.id, p.action, before?.subject_id ?? p.subjectId, JSON.stringify({
        provider, providerSubId, event: p.eventId ?? null, before: before ? stateOf(before) : null, after,
      }));
    }
    return changed;
  }

  /** Creates or updates a subscription from the provider's view of it; returns whether anything changed. */
  function upsert(provider: ProviderId, snapshot: SubscriptionSnapshot, actor: BillingActor, eventId?: string): boolean {
    const before = existing(provider, snapshot.providerSubId);
    const subjectId = before?.subject_id ?? subjectFor(provider, snapshot).id;
    if (snapshot.customerId) recordCustomer.run(provider, snapshot.customerId, subjectId, now());
    const pastDue = snapshot.status === 'past_due';
    return write(provider, snapshot.providerSubId, before, {
      plan_id: planFor(provider, snapshot.priceId),
      status: snapshot.status,
      current_period_end: snapshot.currentPeriodEnd,
      cancel_at: snapshot.cancelAt,
      // A renewal that keeps failing doesn't extend its grace.
      grace_until: pastDue ? (before?.status === 'past_due' && before.grace_until !== null ? before.grace_until : now() + GRACE_MS) : null,
    }, { actor, action: 'subscription.update', eventId, subjectId, data: snapshot.data });
  }

  function mustExist(provider: ProviderId, providerSubId: string) {
    const row = existing(provider, providerSubId);
    if (!row) throw new BillingError(`unknown subscription ${providerSubId}`);
    return row;
  }

  /** Access ends at `endsAt`: now if it has passed, else at the end of the paid period. */
  function cancel(provider: ProviderId, providerSubId: string, endsAt: number, actor: BillingActor, eventId?: string) {
    const before = mustExist(provider, providerSubId);
    const ended = endsAt <= now();
    return write(provider, providerSubId, before, {
      ...stateOf(before),
      status: ended ? 'canceled' : before.status,
      cancel_at: endsAt,
      grace_until: ended ? null : before.grace_until,
    }, { actor, action: 'subscription.cancel', eventId });
  }

  function paymentFailed(provider: ProviderId, providerSubId: string, actor: BillingActor, eventId?: string) {
    const before = mustExist(provider, providerSubId);
    const live = before.status === 'active' || before.status === 'trialing' || before.status === 'past_due';
    return write(provider, providerSubId, before, live
      ? { ...stateOf(before), status: 'past_due', grace_until: before.grace_until ?? now() + GRACE_MS }
      : stateOf(before), { actor, action: 'subscription.payment_failed', eventId });
  }

  return {
    upsert,
    apply(provider: ProviderId, event: BillingEvent, actor: BillingActor): boolean {
      switch (event.type) {
        case 'subscription.upserted': return upsert(provider, event.snapshot, actor, event.eventId);
        case 'subscription.canceled': return cancel(provider, event.providerSubId, event.endsAt, actor, event.eventId);
        case 'payment.failed': return paymentFailed(provider, event.providerSubId, actor, event.eventId);
        default: throw new BillingError(`unknown event type ${(event as { type: string }).type}`);
      }
    },
  };
}

export type Subscriptions = ReturnType<typeof createSubscriptions>;
