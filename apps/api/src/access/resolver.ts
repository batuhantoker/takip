import type { AppDb } from '../db/app-db';
import { fallbacks, isEntitlementKey, parseValue, type Access, type Entitlements, type PlanAccess } from '@takip/core/entitlements';

export type Subject = { type: 'user'; id: string };


type SubscriptionRow = {
  provider: string;
  plan_id: string;
  status: string;
  current_period_end: number | null;
  cancel_at: number | null;
  grace_until: number | null;
};

const MAX_CACHED = 10_000;

export function isActive(sub: SubscriptionRow, at: number) {
  if (sub.status === 'past_due') return (sub.grace_until ?? 0) > at;
  if (sub.status !== 'active' && sub.status !== 'trialing') return false;
  // A provider's subscription ends through its webhooks; a manual grant ends on its own date.
  return sub.provider !== 'manual' || sub.current_period_end === null || sub.current_period_end > at;
}

/** Plan → entitlements ⊕ per-user overrides (backend.md §7.1), cached per subject. */
export function createAccess(db: AppDb, { ttlMs = 60_000, now = () => Date.now() } = {}) {
  const planRow = db.prepare('SELECT plan_id AS id, name FROM bill_plan WHERE plan_id = ?');
  const planValues = db.prepare('SELECT key, value FROM bill_plan_entitlement WHERE plan_id = ?');
  const publicPlans = db.prepare('SELECT plan_id FROM bill_plan WHERE public = 1 AND archived_at IS NULL ORDER BY sort').pluck();
  // Highest plan first, so overlapping subscriptions resolve to the better one.
  const subscriptions = db.prepare(`
    SELECT s.provider, s.plan_id, s.status, s.current_period_end, s.cancel_at, s.grace_until
    FROM bill_subscription s JOIN bill_plan p USING (plan_id)
    WHERE s.subject_type = 'user' AND s.subject_id = ?
    ORDER BY p.sort DESC`);
  const overrides = db.prepare(`
    SELECT key, value FROM bill_subject_override
    WHERE subject_type = 'user' AND subject_id = ? AND (expires_at IS NULL OR expires_at > ?)`);

  const cache = new Map<string, { at: number; value: unknown }>();

  function cached<T>(key: string, compute: () => T): T {
    const hit = cache.get(key);
    if (hit && now() - hit.at < ttlMs) return hit.value as T;
    if (cache.size >= MAX_CACHED) cache.clear();
    const value = compute();
    cache.set(key, { at: now(), value });
    return value;
  }

  function overlay(target: Entitlements, rows: { key: string; value: string }[], source: string) {
    for (const { key, value } of rows) {
      const parsed = isEntitlementKey(key) ? parseValue(key, value) : undefined;
      if (parsed === undefined) console.warn(`[access] ignoring ${source} ${key}=${value}`);
      else (target as Record<string, unknown>)[key] = parsed;
    }
    return target;
  }

  function plan(planId: string): PlanAccess {
    return cached(`plan:${planId}`, () => {
      const row = planRow.get(planId) as { id: string; name: string } | undefined;
      const entitlements = overlay(fallbacks(), planValues.all(planId) as { key: string; value: string }[], `plan ${planId}`);
      return { id: planId, name: row?.name ?? planId, entitlements };
    });
  }

  function resolve(subject: Subject | null): Access {
    if (!subject) {
      const { entitlements, ...anon } = plan('anon');
      return { plan: anon, entitlements, subscription: null };
    }
    return cached(`user:${subject.id}`, () => {
      const at = now();
      const active = (subscriptions.all(subject.id) as SubscriptionRow[]).find(sub => isActive(sub, at));
      const { entitlements, ...chosen } = plan(active?.plan_id ?? 'free');
      const rows = overrides.all(subject.id, at) as { key: string; value: string }[];
      return {
        plan: chosen,
        entitlements: overlay({ ...entitlements }, rows, `override for ${subject.id}`),
        subscription: active
          ? { provider: active.provider, status: active.status, until: active.provider === 'manual' ? active.current_period_end : active.cancel_at }
          : null,
      };
    });
  }

  return {
    resolve,
    plan,
    publicPlans: () => (publicPlans.all() as string[]).map(plan),
    invalidate: () => cache.clear(),
  };
}

export type AccessResolver = ReturnType<typeof createAccess>;
