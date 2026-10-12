import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IMPERSONATION_S } from '../auth/auth';
import { Jar, USER, startApp, type TestApp } from '../testing/helpers';
import { ADMIN, adminKit } from './testing';

let t: TestApp;
let kit: ReturnType<typeof adminKit>;
let root: { jar: Jar; id: string };
let target: Jar;
let targetId: string;

beforeEach(async () => {
  t = await startApp();
  kit = adminKit(t);
  root = await kit.admin();
  target = await t.signUpVerified();
  targetId = await kit.userIdOf(target);
});

afterEach(() => {
  vi.useRealTimers();
  t.close();
});

type SessionView = { session: { id: string; impersonatedBy?: string | null; expiresAt: string }; user: { id: string; email: string } } | null;
const sessionOf = async (jar: Jar, query = '') => kit.json<SessionView>(await t.app.request(`/api/auth/get-session${query}`, { headers: { cookie: jar.get() } }));
const start = (jar: Jar, userId = targetId, body: unknown = { reason: 'support ticket 42' }) =>
  kit.call(jar, 'POST', `/api/admin/users/${userId}/impersonate`, body).then(res => jar.take(res));
const stop = (jar: Jar | null) => kit.call(jar, 'POST', '/api/admin/impersonation/stop').then(res => (jar ? jar.take(res) : res));
const auditRows = () =>
  t.db.prepare("SELECT actor_type, actor_id, impersonator, action, subject_id, data FROM audit_event WHERE action LIKE 'impersonation.%' ORDER BY audit_id").all() as
    { actor_type: string; actor_id: string; impersonator: string; action: string; subject_id: string; data: string }[];

describe('starting to impersonate', () => {
  it('is behind the gate', async () => {
    await kit.expectGated('POST', `/api/admin/users/${targetId}/impersonate`, target, { reason: 'x' });
    expect(auditRows()).toEqual([]);
  });

  it('needs a reason, and refuses admins (the caller included) and banned users', async () => {
    expect(await kit.json(await start(root.jar, targetId, {}))).toMatchObject({ error: 'invalid_request' });
    expect(await kit.json(await start(root.jar, targetId, { reason: '  ' }))).toMatchObject({ error: 'invalid_request' });
    expect((await start(root.jar, 'nobody')).status).toBe(404);

    const other = await kit.admin({ user: { ...ADMIN, email: 'other@example.com' } });
    for (const id of [other.id, root.id]) {
      const refused = await start(root.jar, id);
      expect([refused.status, await kit.json(refused)]).toEqual([403, { error: 'cannot_impersonate_admin' }]);
    }

    expect((await kit.call(root.jar, 'POST', `/api/admin/users/${targetId}/ban`, { reason: 'abuse' })).status).toBe(200);
    const banned = await start(root.jar);
    expect([banned.status, await kit.json(banned)]).toEqual([409, { error: 'cannot_impersonate_banned' }]);

    expect(auditRows()).toEqual([]);
    expect((await sessionOf(root.jar))?.user.id).toBe(root.id);
  });
});

describe('an impersonated session', () => {
  it('signs the browser in as the user, audited, with no console powers, and stop hands the admin back their own session', async () => {
    const adminSession = (await sessionOf(root.jar))!.session.id;
    const started = await start(root.jar);
    expect(started.status).toBe(200);

    const viewing = await sessionOf(root.jar);
    expect(viewing).toMatchObject({ user: { id: targetId, email: USER.email }, session: { impersonatedBy: root.id } });
    // The user's own session is untouched.
    expect((await sessionOf(target))?.session.impersonatedBy).toBeFalsy();

    for (const [method, path] of [['GET', '/api/admin/users'], ['GET', '/api/admin/overview'], ['POST', `/api/admin/users/${targetId}/sign-out`]] as const) {
      const refused = await kit.call(root.jar, method, path);
      expect([refused.status, await kit.json(refused)]).toEqual([403, { error: 'impersonating' }]);
    }
    expect(await kit.json(await kit.call(root.jar, 'GET', '/api/admin/status'))).toMatchObject({ signedIn: true, admin: false, impersonating: true, unlockedUntil: null });
    // Promoting the user mid-way doesn't open the console either.
    t.db.prepare("UPDATE auth_user SET role = 'admin' WHERE id = ?").run(targetId);
    expect(await kit.json(await kit.call(root.jar, 'GET', '/api/admin/users'))).toEqual({ error: 'impersonating' });
    t.db.prepare("UPDATE auth_user SET role = 'user' WHERE id = ?").run(targetId);

    const stopped = await stop(root.jar);
    expect([stopped.status, await kit.json(stopped)]).toEqual([200, { ok: true, userId: targetId, restored: true }]);
    expect(await sessionOf(root.jar)).toMatchObject({ user: { id: root.id }, session: { id: adminSession } });
    // Still unlocked: the step-up belongs to the admin's own session, which came back unchanged.
    expect((await kit.call(root.jar, 'GET', '/api/admin/users')).status).toBe(200);
    expect(t.db.prepare('SELECT count(*) FROM auth_session WHERE impersonatedBy IS NOT NULL').pluck().get()).toBe(0);
    expect(root.jar.get('takip.dont_remember')).toBe('');

    const rows = auditRows();
    expect(rows.map(row => ({ ...row, data: undefined }))).toEqual([
      { actor_type: 'admin', actor_id: root.id, impersonator: root.id, action: 'impersonation.start', subject_id: targetId, data: undefined },
      { actor_type: 'admin', actor_id: root.id, impersonator: root.id, action: 'impersonation.stop', subject_id: targetId, data: undefined },
    ]);
    expect(JSON.parse(rows[0].data)).toMatchObject({ reason: 'support ticket 42', expiresAt: expect.any(Number) });
    expect(JSON.parse(rows[1].data)).toMatchObject({ restored: true });

    const { events } = await kit.json<{ events: { action: string; impersonatorEmail: string | null }[] }>(
      await kit.call(root.jar, 'GET', '/api/admin/audit?action=impersonation.'));
    expect(events.map(e => [e.action, e.impersonatorEmail])).toEqual([['impersonation.stop', ADMIN.email], ['impersonation.start', ADMIN.email]]);
  });

  it('ends on its own after the impersonation window, however often it is used', async () => {
    const before = Date.now();
    await start(root.jar);
    const row = () => t.db.prepare('SELECT expiresAt FROM auth_session WHERE impersonatedBy IS NOT NULL').pluck().get() as string | undefined;
    const expiresAt = row()!;
    expect(Date.parse(expiresAt) - before).toBeLessThanOrEqual(IMPERSONATION_S * 1000 + 1000);
    expect(IMPERSONATION_S).toBeLessThanOrEqual(60 * 60);

    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(before + (IMPERSONATION_S - 60) * 1000);
    // Each of these would extend an ordinary session (expiresIn 30 days, updateAge 1 day).
    for (const query of ['', '?disableCookieCache=true', '?disableCookieCache=true']) expect((await sessionOf(root.jar, query))?.user.id).toBe(targetId);
    // Without the dont_remember cookie Better Auth itself would refresh it.
    const tokenOnly = await t.app.request('/api/auth/get-session?disableCookieCache=true', { headers: { cookie: root.jar.get('takip.session_token') } });
    expect((await kit.json<SessionView>(tokenOnly))?.user.id).toBe(targetId);
    expect(row()).toBe(expiresAt);

    vi.setSystemTime(before + (IMPERSONATION_S + 60) * 1000);
    expect(await sessionOf(root.jar, '?disableCookieCache=true')).toBeNull();
    expect((await stop(root.jar)).status).toBe(401);
  });

  it("can't mint an API key, and what it does to the user's keys names the admin", async () => {
    const own = await kit.json<{ id: string }>(await kit.call(target, 'POST', '/api/v1/keys', { name: 'mine' }));
    await start(root.jar);
    const minted = await kit.call(root.jar, 'POST', '/api/v1/keys', { name: 'backdoor' });
    expect([minted.status, await kit.json(minted)]).toEqual([403, { error: 'impersonating' }]);
    expect((await kit.call(root.jar, 'DELETE', `/api/v1/keys/${own.id}`)).status).toBe(200);

    const rows = t.db.prepare("SELECT actor_type, actor_id, impersonator, action FROM audit_event WHERE action LIKE 'apikey.%' ORDER BY audit_id").all();
    expect(rows).toEqual([
      { actor_type: 'user', actor_id: targetId, impersonator: null, action: 'apikey.create' },
      { actor_type: 'user', actor_id: targetId, impersonator: root.id, action: 'apikey.revoke' },
    ]);
  });

  it('can be stopped though it has no admin powers; nobody else can stop anything', async () => {
    expect(await kit.json(await stop(null))).toEqual({ error: 'sign_in_required' });
    const refused = await stop(target);
    expect([refused.status, await kit.json(refused)]).toEqual([400, { error: 'not_impersonating' }]);
    expect((await stop(root.jar)).status).toBe(400);
    expect(auditRows()).toEqual([]);
  });

  it("still ends when the admin's own session is gone, signing the browser out", async () => {
    const adminSession = (await sessionOf(root.jar))!.session.id;
    await start(root.jar);
    t.db.prepare('DELETE FROM auth_session WHERE id = ?').run(adminSession);

    const stopped = await stop(root.jar);
    expect([stopped.status, await kit.json(stopped)]).toEqual([200, { ok: true, userId: targetId, restored: false }]);
    expect(await sessionOf(root.jar)).toBeNull();
    expect(t.db.prepare('SELECT count(*) FROM auth_session WHERE impersonatedBy IS NOT NULL').pluck().get()).toBe(0);
    expect(auditRows().map(r => r.action)).toEqual(['impersonation.start', 'impersonation.stop']);
  });
});
