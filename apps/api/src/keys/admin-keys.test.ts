import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Jar, USER, startApp, totp, type TestApp } from '../testing/helpers';

const ADMIN = { name: 'Root', email: 'root@example.com', password: 'admin horse battery staple' };

let t: TestApp;
let owner: Jar;
let ownerId: string;
let key: { id: string; key: string; prefix: string };

beforeEach(async () => {
  t = await startApp();
  owner = await t.signUpVerified();
  ownerId = (await t.session(owner.get()))!.user.id;
  key = await json<typeof key>(await call(owner, 'POST', '/api/v1/keys', { name: 'scraper' }));
});

afterEach(() => t.close());

const call = (jar: Jar | null, method: string, path: string, body?: unknown) =>
  t.app.request(path, {
    method,
    headers: { origin: 'http://localhost:3000', ...(body !== undefined && { 'content-type': 'application/json' }), ...(jar && { cookie: jar.get() }) },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
const json = async <T = Record<string, unknown>>(res: Response) => (await res.json()) as T;
const useKey = () => t.app.request('/api/v1/me/access', { headers: { authorization: `Bearer ${key.key}` } });

/** An admin with 2FA on, unlocked unless asked otherwise (as admin.test.ts does it). */
async function admin({ unlocked = true } = {}) {
  const jar = await t.signUpVerified(new Jar(), ADMIN);
  t.db.prepare("UPDATE auth_user SET role = 'admin' WHERE email = ?").run(ADMIN.email);
  const enabled = await json<{ totpURI: string }>(await call(jar, 'POST', '/api/auth/two-factor/enable', { password: ADMIN.password }));
  const secret = new URL(enabled.totpURI).searchParams.get('secret')!;
  expect(jar.take(await call(jar, 'POST', '/api/auth/two-factor/verify-totp', { code: totp(secret) })).status).toBe(200);
  if (unlocked) expect((await call(jar, 'POST', '/api/admin/unlock', { code: totp(secret) })).status).toBe(200);
  return jar;
}

describe("a user's keys in the admin console", () => {
  it('are behind the gate', async () => {
    const paths = [['GET', `/api/admin/users/${ownerId}/keys`], ['DELETE', `/api/admin/users/${ownerId}/keys/${key.id}`]] as const;
    const locked = await admin({ unlocked: false });
    for (const [method, path] of paths) {
      expect(await json(await call(null, method, path))).toEqual({ error: 'sign_in_required' });
      expect(await json(await call(owner, method, path))).toEqual({ error: 'admin_only' });
      expect(await json(await call(locked, method, path))).toEqual({ error: 'unlock_required' });
    }
    expect((await useKey()).status).toBe(200);
  });

  it('are listed, revoked ones included, and revoked at once with an audit row naming the admin', async () => {
    const root = await admin();
    const listed = await json<{ keys: { id: string; prefix: string; revokedAt: number | null }[] }>(await call(root, 'GET', `/api/admin/users/${ownerId}/keys`));
    expect(listed.keys).toMatchObject([{ id: key.id, prefix: key.prefix, name: 'scraper', revokedAt: null }]);
    expect(JSON.stringify(listed)).not.toContain(key.key);
    expect((await useKey()).status).toBe(200);

    expect(await json(await call(root, 'DELETE', `/api/admin/users/${ownerId}/keys/${key.id}`))).toEqual({ ok: true });
    expect(await json(await useKey())).toEqual({ error: 'invalid_api_key' });
    expect((await json<{ keys: { revokedAt: number | null }[] }>(await call(root, 'GET', `/api/admin/users/${ownerId}/keys`))).keys[0].revokedAt).toBeTypeOf('number');

    const { events } = await json<{ events: { action: string; actorType: string; actorEmail: string; subjectEmail: string; data: object }[] }>(
      await call(root, 'GET', '/api/admin/audit?action=apikey.'));
    expect(events[0]).toEqual(expect.objectContaining({
      action: 'apikey.revoke', actorType: 'admin', actorEmail: ADMIN.email, subjectEmail: USER.email, data: { keyId: key.id, prefix: key.prefix, name: 'scraper' },
    }));
    expect(events.map(e => e.action)).toEqual(['apikey.revoke', 'apikey.create']);
  });

  it("won't revoke a key through another user, or twice", async () => {
    const root = await admin();
    const rootId = (await t.session(root.get()))!.user.id;
    expect((await call(root, 'DELETE', `/api/admin/users/${rootId}/keys/${key.id}`)).status).toBe(404);
    expect((await useKey()).status).toBe(200);
    expect((await call(root, 'DELETE', `/api/admin/users/${ownerId}/keys/${key.id}`)).status).toBe(200);
    expect(await json(await call(root, 'DELETE', `/api/admin/users/${ownerId}/keys/${key.id}`))).toEqual({ error: 'not_found' });
  });

  it('stop working as soon as the owner is banned, and work again once unbanned', async () => {
    const root = await admin();
    expect((await useKey()).status).toBe(200);
    expect((await call(root, 'POST', `/api/admin/users/${ownerId}/ban`, { reason: 'scraping' })).status).toBe(200);
    const refused = await useKey();
    expect([refused.status, await json(refused)]).toEqual([403, { error: 'account_banned' }]);
    expect((await call(root, 'POST', `/api/admin/users/${ownerId}/unban`)).status).toBe(200);
    expect((await useKey()).status).toBe(200);
  });
});
