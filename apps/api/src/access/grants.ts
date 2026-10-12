import type { AppDb } from '../db/app-db';
import { isEntitlementKey, parseValue } from '@takip/core/entitlements';

/*
 * Operator changes to plans and access. Each writes an audit_event in the same transaction.
 * A running api picks them up within its cache lifetime (60 s) unless it is told to invalidate.
 */
export type Actor = { type: 'admin' | 'system'; id: string };

const MANUAL = 'manual';
const manualSubId = (userId: string) => `${MANUAL}:user:${userId}`;

function audit(db: AppDb, actor: Actor, action: string, subjectId: string | null, data: object) {
  db.prepare(`
    INSERT INTO audit_event (at, actor_type, actor_id, action, subject_type, subject_id, data)
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(Date.now(), actor.type, actor.id, action, subjectId && 'user', subjectId, JSON.stringify(data));
}

function assertPlan(db: AppDb, planId: string) {
  if (!db.prepare('SELECT 1 FROM bill_plan WHERE plan_id = ? AND archived_at IS NULL').get(planId)) {
    throw new Error(`unknown plan "${planId}"`);
  }
}

function assertValue(key: string, value: string) {
  if (!isEntitlementKey(key)) throw new Error(`unknown entitlement "${key}"`);
  if (parseValue(key, value) === undefined) throw new Error(`"${value}" isn't a valid value for ${key}`);
}

/** Gives a user a plan without a payment provider: a comp, a trial, or a test account. */
export function grantPlan(db: AppDb, p: { userId: string; planId: string; until?: number | null; actor: Actor; reason?: string }) {
  db.transaction(() => {
    assertPlan(db, p.planId);
    const now = Date.now();
    db.prepare(`
      INSERT INTO bill_subscription
        (provider, provider_sub_id, subject_type, subject_id, plan_id, status, current_period_end, created_at, updated_at)
      VALUES (?, ?, 'user', ?, ?, 'active', ?, ?, ?)
      ON CONFLICT (provider, provider_sub_id) DO UPDATE SET
        plan_id = excluded.plan_id, status = 'active', current_period_end = excluded.current_period_end, updated_at = excluded.updated_at`,
    ).run(MANUAL, manualSubId(p.userId), p.userId, p.planId, p.until ?? null, now, now);
    audit(db, p.actor, 'plan.grant', p.userId, { plan: p.planId, until: p.until ?? null, reason: p.reason ?? null });
  })();
}

export function revokePlan(db: AppDb, p: { userId: string; actor: Actor; reason?: string }) {
  db.transaction(() => {
    const { changes } = db.prepare(`
      UPDATE bill_subscription SET status = 'canceled', updated_at = ?
      WHERE provider = ? AND provider_sub_id = ? AND status != 'canceled'`,
    ).run(Date.now(), MANUAL, manualSubId(p.userId));
    if (!changes) throw new Error('this user has no granted plan');
    audit(db, p.actor, 'plan.revoke', p.userId, { reason: p.reason ?? null });
  })();
}

/** Changes what a plan includes, for everyone on it. `value` is a JSON scalar: true, 500, "paid". */
export function setPlanValue(db: AppDb, p: { planId: string; key: string; value: string; actor: Actor }) {
  db.transaction(() => {
    assertPlan(db, p.planId);
    assertValue(p.key, p.value);
    const before = db.prepare('SELECT value FROM bill_plan_entitlement WHERE plan_id = ? AND key = ?').pluck().get(p.planId, p.key);
    db.prepare(`
      INSERT INTO bill_plan_entitlement (plan_id, key, value) VALUES (?, ?, ?)
      ON CONFLICT (plan_id, key) DO UPDATE SET value = excluded.value`,
    ).run(p.planId, p.key, p.value);
    audit(db, p.actor, 'plan.entitlement.set', null, { plan: p.planId, key: p.key, before: before ?? null, after: p.value });
  })();
}

/** One user's exception to their plan, such as a higher limit for a partner. */
export function setOverride(db: AppDb, p: { userId: string; key: string; value: string; until?: number | null; actor: Actor; reason?: string }) {
  db.transaction(() => {
    assertValue(p.key, p.value);
    db.prepare(`
      INSERT INTO bill_subject_override (subject_type, subject_id, key, value, expires_at, granted_by, reason)
      VALUES ('user', ?, ?, ?, ?, ?, ?)
      ON CONFLICT (subject_type, subject_id, key) DO UPDATE SET
        value = excluded.value, expires_at = excluded.expires_at, granted_by = excluded.granted_by, reason = excluded.reason`,
    ).run(p.userId, p.key, p.value, p.until ?? null, p.actor.id, p.reason ?? null);
    audit(db, p.actor, 'override.set', p.userId, { key: p.key, value: p.value, until: p.until ?? null, reason: p.reason ?? null });
  })();
}

export function clearOverride(db: AppDb, p: { userId: string; key: string; actor: Actor }) {
  db.transaction(() => {
    db.prepare("DELETE FROM bill_subject_override WHERE subject_type = 'user' AND subject_id = ? AND key = ?").run(p.userId, p.key);
    audit(db, p.actor, 'override.clear', p.userId, { key: p.key });
  })();
}
