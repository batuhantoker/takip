import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Jar, USER, startApp, totp, type TestApp } from '../testing/helpers';

const ADMIN = { name: 'Root', email: 'root@example.com', password: 'admin horse battery staple' };
const HOURS = 60 * 60 * 1000;

let t: TestApp;

beforeEach(async () => {
  t = await startApp();
});

afterEach(() => {
  vi.useRealTimers();
  t.close();
});

const call = (jar: Jar | null, method: string, path: string, body?: unknown) =>
  t.app.request(path, {
    method,
    headers: { origin: 'http://localhost:3000', ...(body !== undefined && { 'content-type': 'application/json' }), ...(jar && { cookie: jar.get() }) },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
const json = async <T = Record<string, unknown>>(res: Response) => (await res.json()) as T;
const userIdOf = async (jar: Jar) => (await t.session(jar.get()))!.user.id;
const promote = (id: string) => t.db.prepare("UPDATE auth_user SET role = 'admin' WHERE id = ?").run(id);

/** Turns on 2FA the way the settings screen does; the confirming code replaces the session. */
async function enableTwoFactor(jar: Jar, password: string) {
  const enabled = await json<{ totpURI: string; backupCodes: string[] }>(await call(jar, 'POST', '/api/auth/two-factor/enable', { password }));
  const secret = new URL(enabled.totpURI).searchParams.get('secret')!;
  const verified = jar.take(await call(jar, 'POST', '/api/auth/two-factor/verify-totp', { code: totp(secret) }));
  expect(verified.status).toBe(200);
  return { secret, backupCodes: enabled.backupCodes };
}

async function admin({ unlocked = true } = {}) {
  const jar = await t.signUpVerified(new Jar(), ADMIN);
  promote(await userIdOf(jar));
  const twoFactor = await enableTwoFactor(jar, ADMIN.password);
  if (unlocked) expect((await call(jar, 'POST', '/api/admin/unlock', { code: totp(twoFactor.secret) })).status).toBe(200);
  return { jar, ...twoFactor };
}

describe('admin gate', () => {
  it('turns away visitors, ordinary users and admins without 2FA, reading the role fresh', async () => {
    expect(await json(await call(null, 'GET', '/api/admin/users'))).toEqual({ error: 'sign_in_required' });

    const jar = await t.signUpVerified(new Jar(), ADMIN);
    const refused = await call(jar, 'GET', '/api/admin/users');
    expect([refused.status, await json(refused)]).toEqual([403, { error: 'admin_only' }]);

    promote(await userIdOf(jar));
    expect(await json(await call(jar, 'GET', '/api/admin/users'))).toEqual({ error: 'two_factor_required' });
  });

  it('asks each session for a code, then stays open for 12 hours', async () => {
    const { jar, secret } = await admin({ unlocked: false });
    expect(await json(await call(jar, 'GET', '/api/admin/users'))).toEqual({ error: 'unlock_required' });
    expect(await json(await call(jar, 'GET', '/api/admin/status'))).toEqual({
      signedIn: true, admin: true, twoFactor: true, impersonating: false, unlockedUntil: null, retryAfterSeconds: null,
    });

    expect((await call(jar, 'POST', '/api/admin/unlock', { code: '000000' })).status).toBe(401);
    expect((await call(jar, 'POST', '/api/admin/unlock', { code: totp(secret) })).status).toBe(200);
    expect((await call(jar, 'GET', '/api/admin/users')).status).toBe(200);

    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 13 * HOURS);
    expect(await json(await call(jar, 'GET', '/api/admin/users'))).toEqual({ error: 'unlock_required' });
  });

  it('stops accepting codes after five wrong ones, saying when it will again', async () => {
    const { jar, secret } = await admin({ unlocked: false });
    vi.useFakeTimers({ toFake: ['Date'] });
    for (let i = 0; i < 4; i++) expect(await json(await call(jar, 'POST', '/api/admin/unlock', { code: '000000' }))).toEqual({ error: 'invalid_code' });
    vi.setSystemTime(Date.now() + 60_000);
    const fifth = await call(jar, 'POST', '/api/admin/unlock', { code: '000000' });
    expect([fifth.status, await json(fifth)]).toEqual([401, { error: 'invalid_code', retryAfterSeconds: 14 * 60 }]);

    const locked = await call(jar, 'POST', '/api/admin/unlock', { code: totp(secret) });
    expect([locked.status, await json(locked)]).toEqual([429, { error: 'too_many_attempts', retryAfterSeconds: 14 * 60 }]);
    vi.setSystemTime(Date.now() + 10 * 60_000);
    expect(await json(await call(jar, 'GET', '/api/admin/status'))).toMatchObject({ unlockedUntil: null, retryAfterSeconds: 4 * 60 });

    vi.setSystemTime(Date.now() + 4 * 60_000);
    expect(await json(await call(jar, 'GET', '/api/admin/status'))).toMatchObject({ retryAfterSeconds: null });
    expect((await call(jar, 'POST', '/api/admin/unlock', { code: totp(secret) })).status).toBe(200);
  });

  it('accepts each backup code once', async () => {
    const { jar, backupCodes } = await admin({ unlocked: false });
    expect((await call(jar, 'POST', '/api/admin/unlock', { code: backupCodes[0] })).status).toBe(200);
    expect((await call(jar, 'POST', '/api/admin/unlock', { code: backupCodes[0] })).status).toBe(401);
  });

  it("keeps the admin plugin's own endpoints closed, even to an unlocked admin", async () => {
    const { jar } = await admin();
    expect((await call(jar, 'GET', '/api/auth/admin/list-users')).status).toBe(404);
    expect((await call(jar, 'POST', '/api/auth/admin/set-role', { userId: 'x', role: 'admin' })).status).toBe(404);
  });

  it('applies a demotion at once', async () => {
    const { jar } = await admin();
    t.db.prepare("UPDATE auth_user SET role = 'user' WHERE email = ?").run(ADMIN.email);
    expect(await json(await call(jar, 'GET', '/api/admin/users'))).toEqual({ error: 'admin_only' });
  });
});

describe('2FA at sign-in', () => {
  it('asks for a code after the password and signs in only with it', async () => {
    const jar = await t.signUpVerified();
    const { secret } = await enableTwoFactor(jar, USER.password);

    const next = new Jar();
    const first = next.take(await call(null, 'POST', '/api/auth/sign-in/email', { email: USER.email, password: USER.password }));
    expect(await json(first)).toMatchObject({ twoFactorRedirect: true });
    expect(await t.session(next.get())).toBeNull();

    expect(next.take(await call(next, 'POST', '/api/auth/two-factor/verify-totp', { code: totp(secret) })).status).toBe(200);
    expect((await t.session(next.get()))?.user.email).toBe(USER.email);
  });
});

describe('console actions', () => {
  let root: Jar;
  let target: Jar;
  let targetId: string;

  beforeEach(async () => {
    root = (await admin()).jar;
    target = await t.signUpVerified();
    targetId = await userIdOf(target);
  });

  const planOf = async (jar: Jar) => (await json<{ plan: { id: string } }>(await call(jar, 'GET', '/api/v1/me/access'))).plan.id;

  it('lists and searches users with their plan', async () => {
    const all = await json<{ total: number; users: { email: string; plan: string }[] }>(await call(root, 'GET', '/api/admin/users'));
    expect(all.total).toBe(2);
    const found = await json<{ total: number; users: { email: string; plan: string }[] }>(await call(root, 'GET', '/api/admin/users?q=ada'));
    expect(found.users).toMatchObject([{ email: USER.email, plan: 'free' }]);
  });

  it('shows one user with sign-in methods, devices, access and history', async () => {
    const detail = await json(await call(root, 'GET', `/api/admin/users/${targetId}`));
    expect(detail).toMatchObject({ user: { email: USER.email, emailVerified: true }, access: { plan: { id: 'free' } }, accounts: [{ providerId: 'credential' }] });
    expect(detail.sessions).toHaveLength(1);
    expect((await call(root, 'GET', '/api/admin/users/nobody')).status).toBe(404);
  });

  it('grants and revokes a plan, effective at once', async () => {
    expect((await call(root, 'PUT', `/api/admin/users/${targetId}/plan`, { planId: 'pro', until: '2026-12-31', reason: 'beta' })).status).toBe(200);
    expect(await planOf(target)).toBe('pro');
    expect((await call(root, 'DELETE', `/api/admin/users/${targetId}/plan`, { reason: 'beta over' })).status).toBe(200);
    expect(await planOf(target)).toBe('free');
  });

  it('sets and clears a per-user override', async () => {
    await call(root, 'PUT', `/api/admin/users/${targetId}/overrides/workspaces.max`, { value: '500', reason: 'partner' });
    const limit = async () => (await json<{ entitlements: Record<string, unknown> }>(await call(target, 'GET', '/api/v1/me/access'))).entitlements['workspaces.max'];
    expect(await limit()).toBe(500);
    await call(root, 'DELETE', `/api/admin/users/${targetId}/overrides/workspaces.max`);
    expect(await limit()).toBe(5);
  });

  it('refuses bad changes with a reason', async () => {
    const plan = await call(root, 'PUT', `/api/admin/users/${targetId}/plan`, { planId: 'gold' });
    expect([plan.status, await json(plan)]).toEqual([400, { error: 'invalid_change', message: 'unknown plan "gold"' }]);
    expect((await call(root, 'PUT', `/api/admin/users/${targetId}/plan`, { planId: 'pro', until: 'tomorrow' })).status).toBe(400);
    expect((await call(root, 'PUT', '/api/admin/plans/free/entitlements/api.enabled', { value: 'yes' })).status).toBe(400);
  });

  it('bans a user, ending their sessions and refusing sign-in, then unbans', async () => {
    const token = target.get('takip.session_token');
    expect((await call(root, 'POST', `/api/admin/users/${targetId}/ban`, { reason: 'abuse' })).status).toBe(200);
    expect(await t.session(token)).toBeNull();
    expect((await call(null, 'POST', '/api/auth/sign-in/email', { email: USER.email, password: USER.password })).status).toBe(403);

    expect((await call(root, 'POST', `/api/admin/users/${targetId}/unban`)).status).toBe(200);
    expect((await call(null, 'POST', '/api/auth/sign-in/email', { email: USER.email, password: USER.password })).status).toBe(200);
  });

  it('will not let an admin ban themselves', async () => {
    const res = await call(root, 'POST', `/api/admin/users/${await userIdOf(root)}/ban`, { reason: 'oops' });
    expect([res.status, await json(res)]).toEqual([400, { error: 'cannot_ban_self' }]);
  });

  it('signs a user out everywhere', async () => {
    const token = target.get('takip.session_token');
    expect((await call(root, 'POST', `/api/admin/users/${targetId}/sign-out`)).status).toBe(200);
    expect(await t.session(token)).toBeNull();
  });

  it('edits what a plan includes', async () => {
    expect((await call(root, 'PUT', '/api/admin/plans/free/entitlements/web.rps', { value: '25' })).status).toBe(200);
    const { plans } = await json<{ plans: { id: string; values: Record<string, string> }[] }>(await call(root, 'GET', '/api/admin/plans'));
    expect(plans.find(p => p.id === 'free')?.values['web.rps']).toBe('25');
    expect((await json<{ entitlements: Record<string, unknown> }>(await call(target, 'GET', '/api/v1/me/access'))).entitlements['web.rps']).toBe(25);
  });

  it('records every change with the admin as the actor', async () => {
    await call(root, 'PUT', `/api/admin/users/${targetId}/plan`, { planId: 'pro' });
    await call(root, 'POST', `/api/admin/users/${targetId}/ban`, { reason: 'abuse' });
    const { events } = await json<{ events: { action: string; actorEmail: string; subjectEmail: string }[] }>(await call(root, 'GET', '/api/admin/audit'));
    expect(events.map(e => e.action)).toEqual(['user.ban', 'plan.grant', 'admin.unlock']);
    expect(events[0]).toMatchObject({ actorEmail: ADMIN.email, subjectEmail: USER.email });
  });

  it('summarises the user base on the overview', async () => {
    await call(root, 'PUT', `/api/admin/users/${targetId}/plan`, { planId: 'pro' });
    expect(await json(await call(root, 'GET', '/api/admin/overview'))).toMatchObject({
      users: 2, newThisWeek: 2, admins: 1, banned: 0, onPaidOrGrantedPlans: { pro: 1 },
    });
  });
});
