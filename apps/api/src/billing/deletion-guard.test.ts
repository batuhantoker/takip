import { afterEach, describe, expect, it, vi } from 'vitest';
import { Jar, landing, linkIn, startApp, tick, type TestApp } from '../testing/helpers';
import { SUBSCRIPTION_ACTIVE } from './deletion-guard';
import { createFakeProvider } from './fake-provider';
import { GRACE_MS } from './subscriptions';

const DAY = 24 * 60 * 60 * 1000;
const DELETED = '/?account=deleted';

type Subscription = { provider?: string; status: string; current_period_end?: number | null; cancel_at?: number | null; grace_until?: number | null };

let t: TestApp;

afterEach(() => {
  vi.useRealTimers();
  t.close();
});

async function signedIn(billing = true) {
  t = await startApp({}, undefined, { billing: billing ? createFakeProvider() : null });
  const jar = await t.signUpVerified();
  const userId = (await t.session(jar.get()))!.user.id;
  return { jar, userId };
}

let subs = 0;
function subscribe(userId: string, { provider = 'fake', status, current_period_end = Date.now() + 30 * DAY, cancel_at = null, grace_until = null }: Subscription) {
  t.db.prepare(`
    INSERT INTO bill_subscription (provider, provider_sub_id, subject_type, subject_id, plan_id, status, current_period_end, cancel_at, grace_until, created_at, updated_at)
    VALUES (?, ?, 'user', ?, 'pro', ?, ?, ?, ?, 0, 0)`).run(provider, `sub_${++subs}`, userId, status, current_period_end, cancel_at, grace_until);
}

const askToDelete = (jar: Jar) => t.post('/api/auth/delete-user', { callbackURL: DELETED }, { cookie: jar.get() });
const pendingLinks = () => t.db.prepare("SELECT count(*) FROM auth_verification WHERE identifier LIKE 'delete-account-%'").pluck().get();
const rows = (table: string, column: string, userId: string) => t.db.prepare(`SELECT count(*) FROM ${table} WHERE ${column} = ?`).pluck().get(userId);

async function expectRefused(jar: Jar, billingPortal = true) {
  const res = await askToDelete(jar);
  expect(res.status).toBe(409);
  expect(await res.json()).toEqual({ code: SUBSCRIPTION_ACTIVE, message: expect.stringMatching(/cancel/i), billing_portal: billingPortal });
  await tick();
  expect(t.inbox.size).toBe(0);
  expect(pendingLinks()).toBe(0);
}

async function expectLinkSent(jar: Jar) {
  expect((await askToDelete(jar)).status).toBe(200);
  return linkIn(await t.inbox.next());
}

describe('deleting an account with a subscription', () => {
  it('refuses while a paid subscription is active or trialing, and sends no email', async () => {
    const { jar, userId } = await signedIn();
    subscribe(userId, { status: 'active' });
    await expectRefused(jar);

    const trial = await t.signUpVerified(new Jar(), { name: 'Bo', email: 'bo@example.com', password: 'another horse battery' });
    subscribe((await t.session(trial.get()))!.user.id, { status: 'trialing' });
    await expectRefused(trial);
  });

  it('tells the client when there is no billing portal to offer', async () => {
    const { jar, userId } = await signedIn(false);
    subscribe(userId, { status: 'active' });
    await expectRefused(jar, false);
  });

  it('never counts a manual grant', async () => {
    const { jar, userId } = await signedIn();
    subscribe(userId, { provider: 'manual', status: 'active' });
    const link = await expectLinkSent(jar);
    const done = await t.app.request(link, { headers: { cookie: jar.get() } });
    expect(`${landing(done).pathname}${landing(done).search}`).toBe(DELETED);
    expect(rows('auth_user', 'id', userId)).toBe(0);
  });

  it('refuses past_due within its grace period, and allows it once the grace has run out', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const { jar, userId } = await signedIn();
    subscribe(userId, { status: 'past_due', grace_until: Date.now() + GRACE_MS });
    await expectRefused(jar);

    vi.setSystemTime(Date.now() + GRACE_MS);
    await expectLinkSent(jar);
  });

  it('allows a canceled subscription, and one past its cancel date', async () => {
    const { jar, userId } = await signedIn();
    subscribe(userId, { status: 'canceled' });
    subscribe(userId, { status: 'active', cancel_at: Date.now() - 1 });
    await expectLinkSent(jar);
  });

  it('checks again when the link is opened, and leaves the account whole', async () => {
    const { jar, userId } = await signedIn();
    const link = await expectLinkSent(jar);
    subscribe(userId, { status: 'active' });

    const res = await t.app.request(link, { headers: { cookie: jar.get() } });
    expect(res.status).toBe(302);
    expect(`${landing(res).pathname}${landing(res).search}`).toBe(`/?account=delete-failed&error=${SUBSCRIPTION_ACTIVE}`);
    expect([rows('auth_user', 'id', userId), rows('auth_account', 'userId', userId), rows('auth_session', 'userId', userId)]).toEqual([1, 1, 1]);
    expect(await t.session(jar.get())).toMatchObject({ user: { id: userId } });
  });
});
