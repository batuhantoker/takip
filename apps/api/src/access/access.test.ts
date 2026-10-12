import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Jar, startApp, type TestApp } from '../testing/helpers';
import { CATALOGUE, parseValue, type Access, type EntitlementKey } from '@takip/core/entitlements';
import { migrateAppSchema } from '../db/migrations';
import { clearOverride, grantPlan, revokePlan, setOverride, setPlanValue } from './grants';
import { requires, withAccess } from './middleware';

const OPERATOR = { type: 'admin', id: 'test' } as const;
const DAY = 24 * 60 * 60 * 1000;

let t: TestApp;

beforeEach(async () => {
  t = await startApp();
});

afterEach(() => {
  vi.useRealTimers();
  t.close();
});

async function accessOf(jar?: Jar) {
  const res = await t.app.request('/api/v1/me/access', { headers: jar ? { cookie: jar.get() } : {} });
  expect(res.status).toBe(200);
  return (await res.json()) as Access;
}

async function signedInUser() {
  const jar = await t.signUpVerified();
  return { jar, userId: (await t.session(jar.get()))!.user.id };
}

function later(ms: number) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(Date.now() + ms);
  t.access.invalidate();
}

const audit = () => t.db.prepare('SELECT action FROM audit_event ORDER BY audit_id').pluck().all();

describe('seeded plans', () => {
  it('give every plan a valid value for every entitlement', () => {
    const rows = t.db.prepare('SELECT plan_id, key, value FROM bill_plan_entitlement').all() as { plan_id: string; key: EntitlementKey; value: string }[];
    for (const plan of ['anon', 'free', 'pro']) {
      const own = rows.filter(r => r.plan_id === plan);
      expect(own.map(r => r.key).sort()).toEqual(Object.keys(CATALOGUE).sort());
      for (const row of own) expect(parseValue(row.key, row.value), `${plan} ${row.key}`).not.toBeUndefined();
    }
  });

  it('lists the public plans in order, without the anonymous one', async () => {
    const { plans } = (await (await t.app.request('/api/v1/plans')).json()) as { plans: { id: string; entitlements: Record<string, unknown> }[] };
    expect(plans.map(p => p.id)).toEqual(['free', 'pro']);
    expect(plans[1].entitlements['api.enabled']).toBe(true);
  });

  it('give free a small API and pro hosted AI', () => {
    expect(t.access.plan('free').entitlements).toMatchObject({ 'api.enabled': true, 'api.keys.max': 1, 'api.requests_per_day': 1000, 'api.rps': 2 });
    expect(t.access.plan('pro').entitlements).toMatchObject({ 'ai.hosted': true, 'api.rps': 20 });
  });

  it('keep an operator\'s edit when the seed update runs', () => {
    const value = (key: string) => t.db.prepare("SELECT value FROM bill_plan_entitlement WHERE plan_id = 'free' AND key = ?").pluck().get(key);
    // Back to before migration 3, with one row still at its seed and one edited by an operator.
    t.db.pragma('user_version = 3');
    t.db.prepare("UPDATE bill_plan_entitlement SET value = 'false' WHERE plan_id = 'free' AND key = 'api.enabled'").run();
    t.db.prepare("UPDATE bill_plan_entitlement SET value = '5' WHERE plan_id = 'free' AND key = 'api.rps'").run();
    migrateAppSchema(t.db);
    expect(value('api.enabled')).toBe('true');
    expect(value('api.rps')).toBe('5');
  });
});

describe('who gets what', () => {
  it('gives visitors the anonymous plan and signed-in users the free one', async () => {
    expect(await accessOf()).toMatchObject({ plan: { id: 'anon' }, subscription: null, entitlements: { 'replay.lookback_days': 1 } });
    const { jar } = await signedInUser();
    expect(await accessOf(jar)).toMatchObject({ plan: { id: 'free' }, subscription: null, entitlements: { 'replay.lookback_days': 7 } });
  });

  it('applies a granted plan until its end date, then falls back to free', async () => {
    const { jar, userId } = await signedInUser();
    const until = Date.now() + DAY;
    grantPlan(t.db, { userId, planId: 'pro', until, actor: OPERATOR, reason: 'beta tester' });
    t.access.invalidate();
    expect(await accessOf(jar)).toMatchObject({
      plan: { id: 'pro' },
      subscription: { provider: 'manual', status: 'active', until },
      entitlements: { 'api.enabled': true, 'data.licence_tier': 'paid' },
    });

    later(2 * DAY);
    expect((await accessOf(jar)).plan.id).toBe('free');
  });

  it('drops a revoked plan and records both changes', async () => {
    const { jar, userId } = await signedInUser();
    grantPlan(t.db, { userId, planId: 'pro', actor: OPERATOR });
    revokePlan(t.db, { userId, actor: OPERATOR });
    t.access.invalidate();
    expect((await accessOf(jar)).plan.id).toBe('free');
    expect(audit()).toEqual(['plan.grant', 'plan.revoke']);
  });

  it('keeps a lapsed payment working through its grace period', async () => {
    const { jar, userId } = await signedInUser();
    // As a billing webhook would leave it after a failed renewal.
    t.db.prepare(`
      INSERT INTO bill_subscription (provider, provider_sub_id, subject_type, subject_id, plan_id, status, grace_until, created_at, updated_at)
      VALUES ('stripe', 'sub_1', 'user', ?, 'pro', 'past_due', ?, 0, 0)`).run(userId, Date.now() + DAY);
    t.access.invalidate();
    expect((await accessOf(jar)).plan.id).toBe('pro');

    later(2 * DAY);
    expect((await accessOf(jar)).plan.id).toBe('free');
  });

  it('lets an override lift one limit for one user, until it expires', async () => {
    const { jar, userId } = await signedInUser();
    setOverride(t.db, { userId, key: 'workspaces.max', value: '500', until: Date.now() + DAY, actor: OPERATOR, reason: 'partner' });
    t.access.invalidate();
    expect(await accessOf(jar)).toMatchObject({ plan: { id: 'free' }, entitlements: { 'workspaces.max': 500, 'export.enabled': false } });

    later(2 * DAY);
    expect((await accessOf(jar)).entitlements['workspaces.max']).toBe(5);
  });

  it('can clear an override early', async () => {
    const { jar, userId } = await signedInUser();
    setOverride(t.db, { userId, key: 'export.enabled', value: 'true', actor: OPERATOR });
    clearOverride(t.db, { userId, key: 'export.enabled', actor: OPERATOR });
    t.access.invalidate();
    expect((await accessOf(jar)).entitlements['export.enabled']).toBe(false);
  });

  it('changes a plan for everyone on it', async () => {
    const { jar } = await signedInUser();
    setPlanValue(t.db, { planId: 'free', key: 'export.enabled', value: 'true', actor: OPERATOR });
    t.access.invalidate();
    expect((await accessOf(jar)).entitlements['export.enabled']).toBe(true);
  });

  it('refuses unknown plans, unknown keys and values of the wrong type', async () => {
    const { userId } = await signedInUser();
    expect(() => grantPlan(t.db, { userId, planId: 'gold', actor: OPERATOR })).toThrow(/unknown plan/);
    expect(() => setPlanValue(t.db, { planId: 'free', key: 'api.unlimited', value: 'true', actor: OPERATOR })).toThrow(/unknown entitlement/);
    expect(() => setPlanValue(t.db, { planId: 'free', key: 'api.enabled', value: '"yes"', actor: OPERATOR })).toThrow(/valid value/);
    expect(() => setOverride(t.db, { userId, key: 'workspaces.max', value: '-1', actor: OPERATOR })).toThrow(/valid value/);
    expect(() => setPlanValue(t.db, { planId: 'pro', key: 'data.licence_tier', value: '"gold"', actor: OPERATOR })).toThrow(/valid value/);
    expect(audit()).toEqual([]);
  });

  it('serves cached access until the cache is invalidated', async () => {
    const { jar, userId } = await signedInUser();
    expect((await accessOf(jar)).plan.id).toBe('free');
    grantPlan(t.db, { userId, planId: 'pro', actor: OPERATOR });
    expect((await accessOf(jar)).plan.id).toBe('free');
    t.access.invalidate();
    expect((await accessOf(jar)).plan.id).toBe('pro');
  });
});

describe('entitlement guard', () => {
  it('answers 403 with an upgrade hint unless the plan allows it', async () => {
    const guarded = new Hono();
    guarded.get('/export', withAccess(t.auth, t.access), requires('export.enabled'), c => c.text('exported'));
    const call = (jar?: Jar) => guarded.request('/export', { headers: jar ? { cookie: jar.get() } : {} });

    const refused = await call();
    expect(refused.status).toBe(403);
    expect(await refused.json()).toEqual({ error: 'entitlement_required', entitlement: 'export.enabled', upgrade_url: '/pricing' });

    const { jar, userId } = await signedInUser();
    expect((await call(jar)).status).toBe(403);
    grantPlan(t.db, { userId, planId: 'pro', actor: OPERATOR });
    t.access.invalidate();
    expect((await call(jar)).status).toBe(200);
  });
});
