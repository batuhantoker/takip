import { expect, vi } from 'vitest';
import { grantPlan, setOverride } from '../access/grants';
import { createFakeProvider } from '../billing/fake-provider';
import { DAY, PRO_MONTHLY } from '../billing/testing';
import { GOOGLE, Jar, ORIGIN, RESET, USER, googleApproves, linkIn, startApp, totp, viaGoogle } from '../testing/helpers';

export const BYSTANDER = { name: 'Bo', email: 'bo@example.com', password: 'another horse battery' };
const SETTINGS = '/?account=settings';
const DELETED = '/?account=deleted';
const OPERATOR = { type: 'admin', id: 'operator' } as const;

/** An app with Google sign-in and the fake billing provider, `pro` priced for it. */
export async function startPrivacyApp() {
  const fake = createFakeProvider();
  const t = await startApp(GOOGLE, undefined, { billing: fake });
  t.db.prepare("UPDATE bill_plan SET prices = ? WHERE plan_id = 'pro'").run(JSON.stringify({ fake: { monthly: PRO_MONTHLY } }));

  const call = (jar: Jar | null, method: string, path: string, body?: unknown) =>
    t.app.request(path, {
      method,
      headers: { origin: ORIGIN, ...(body !== undefined && { 'content-type': 'application/json' }), ...(jar && { cookie: jar.get() }) },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });

  /**
   * Signs `person` up with a row of every kind app.db keeps about a user: two sessions, a Google account, 2FA,
   * an admin unlock, an API key and its usage, a granted and a paid plan, an override, a pending reset link,
   * and audit rows, one carrying an IP address, a user agent and the email.
   */
  async function withEverything(person = USER, { google = true } = {}) {
    const jar = await t.signUpVerified(new Jar(), person);
    const userId = (await t.session(jar.get()))!.user.id;
    const elsewhere = new Jar();
    expect(elsewhere.take(await t.post('/api/auth/sign-in/email', { email: person.email, password: person.password })).status).toBe(200);

    if (google) {
      googleApproves({ email: person.email, email_verified: true });
      await viaGoogle(t, jar, '/api/auth/link-social', { callbackURL: SETTINGS, errorCallbackURL: SETTINGS });
      vi.restoreAllMocks();
    }

    t.db.prepare("UPDATE auth_user SET role = 'admin' WHERE id = ?").run(userId);
    const enabled = (await (await call(jar, 'POST', '/api/auth/two-factor/enable', { password: person.password })).json()) as { totpURI: string; backupCodes: string[] };
    const totpSecret = new URL(enabled.totpURI).searchParams.get('secret')!;
    expect(jar.take(await call(jar, 'POST', '/api/auth/two-factor/verify-totp', { code: totp(totpSecret) })).status).toBe(200);
    expect((await call(jar, 'POST', '/api/admin/unlock', { code: totp(totpSecret) })).status).toBe(200);

    const created = await call(jar, 'POST', '/api/v1/keys', { name: 'laptop' });
    expect(created.status).toBe(201);
    const { key } = (await created.json()) as { key: string };
    expect((await t.app.request('/api/v1/me/access', { headers: { authorization: `Bearer ${key}` } })).status).toBe(200);

    grantPlan(t.db, { userId, planId: 'pro', actor: OPERATOR, reason: `asked by ${person.email}` });
    setOverride(t.db, { userId, key: 'api.keys.max', value: '3', actor: OPERATOR, reason: 'partner' });
    t.access.invalidate();
    const snapshot = {
      providerSubId: `sub_${userId}`, priceId: PRO_MONTHLY, status: 'active' as const, currentPeriodEnd: Date.now() + 30 * DAY, cancelAt: null,
      customerId: `cus_${userId}`, subject: { type: 'user' as const, id: userId }, data: { email: person.email },
    };
    expect((await t.app.request('/api/billing/webhook/fake', fake.delivery([{ type: 'subscription.upserted', eventId: `evt_${userId}`, snapshot }]))).status).toBe(200);

    expect((await t.post('/api/auth/request-password-reset', { email: person.email, redirectTo: RESET })).status).toBe(200);
    await t.inbox.next();

    // Nothing writes ip_hash or addresses into audit data yet; this row stands in for whatever will.
    t.db.prepare(`
      INSERT INTO audit_event (at, actor_type, actor_id, action, subject_type, subject_id, ip_hash, data)
      VALUES (?, 'user', ?, 'test.sign_in', 'user', ?, 'f00d', ?)`,
    ).run(Date.now(), userId, userId, JSON.stringify({ ip: '203.0.113.7', userAgent: 'Firefox', from: '198.51.100.9', note: `signed in as ${person.email.toUpperCase()}` }));
    t.usage.flush();

    return { jar, elsewhere, userId, key, totpSecret, backupCodes: enabled.backupCodes };
  }

  /** The self-service flow: ask for the emailed link, then open it in the signed-in browser. */
  async function deleteViaLink(jar: Jar) {
    expect((await t.post('/api/auth/delete-user', { callbackURL: DELETED }, { cookie: jar.get() })).status).toBe(200);
    return jar.take(await t.app.request(linkIn(await t.inbox.next()), { headers: { cookie: jar.get() } }));
  }

  return { t, call, withEverything, deleteViaLink };
}

export type PrivacyApp = Awaited<ReturnType<typeof startPrivacyApp>>;
