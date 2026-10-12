import { expect } from 'vitest';
import { Jar, ORIGIN, totp, type TestApp } from '../testing/helpers';

export const ADMIN = { name: 'Root', email: 'root@example.com', password: 'admin horse battery staple' };

/** Request helpers bound to one app, plus an admin with 2FA on, unlocked unless asked otherwise (as admin.test.ts does it). */
export function adminKit(t: TestApp) {
  const call = async (jar: Jar | null, method: string, path: string, body?: unknown) =>
    t.app.request(path, {
      method,
      headers: { origin: ORIGIN, ...(body !== undefined && { 'content-type': 'application/json' }), ...(jar && { cookie: jar.get() }) },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });
  const json = async <T = Record<string, unknown>>(res: Response) => (await res.json()) as T;
  const userIdOf = async (jar: Jar) => (await t.session(jar.get()))!.user.id;

  async function admin({ unlocked = true, user = ADMIN } = {}) {
    const jar = await t.signUpVerified(new Jar(), user);
    t.db.prepare("UPDATE auth_user SET role = 'admin' WHERE email = ?").run(user.email);
    const enabled = await json<{ totpURI: string }>(await call(jar, 'POST', '/api/auth/two-factor/enable', { password: user.password }));
    const secret = new URL(enabled.totpURI).searchParams.get('secret')!;
    expect(jar.take(await call(jar, 'POST', '/api/auth/two-factor/verify-totp', { code: totp(secret) })).status).toBe(200);
    if (unlocked) expect((await call(jar, 'POST', '/api/admin/unlock', { code: totp(secret) })).status).toBe(200);
    return { jar, id: await userIdOf(jar), secret };
  }

  let lockedAdmin: Promise<Jar> | undefined;

  /** Refused the same way as every other console route: visitor, ordinary user, admin without the step-up. */
  async function expectGated(method: string, path: string, user: Jar, body?: unknown) {
    lockedAdmin ??= admin({ unlocked: false, user: { ...ADMIN, email: 'locked@example.com' } }).then(a => a.jar);
    const locked = await lockedAdmin;
    expect(await json(await call(null, method, path, body))).toEqual({ error: 'sign_in_required' });
    const refused = await call(user, method, path, body);
    expect([refused.status, await json(refused)]).toEqual([403, { error: 'admin_only' }]);
    expect(await json(await call(locked, method, path, body))).toEqual({ error: 'unlock_required' });
  }

  return { call, json, userIdOf, admin, expectGated };
}
