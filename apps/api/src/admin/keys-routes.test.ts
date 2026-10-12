import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Jar, USER, startApp, type TestApp } from '../testing/helpers';
import { adminKit } from './testing';

const BOB = { name: 'Bob', email: 'bob@example.com', password: 'bob horse battery staple' };

let t: TestApp;
let kit: ReturnType<typeof adminKit>;
let ada: Jar;
let bob: Jar;

type Listed = {
  counts: { all: number; active: number; expired: number; revoked: number };
  total: number;
  keys: { id: string; name: string; prefix: string; userId: string; email: string; revokedAt: number | null; expiresAt: number | null }[];
};

beforeEach(async () => {
  t = await startApp();
  kit = adminKit(t);
  ada = await t.signUpVerified();
  bob = await t.signUpVerified(new Jar(), BOB);
});

afterEach(() => {
  vi.useRealTimers();
  t.close();
});

const createKey = async (jar: Jar, name: string) => kit.json<{ id: string; key: string; prefix: string }>(await kit.call(jar, 'POST', '/api/v1/keys', { name }));
const list = async (root: Jar, query = '') => kit.json<Listed>(await kit.call(root, 'GET', `/api/admin/keys${query}`));

describe('every API key in the console', () => {
  it('is behind the gate', async () => {
    await kit.expectGated('GET', '/api/admin/keys', ada);
  });

  it('lists keys across users with their owner, filtered by state or search, never the secret', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const later = () => vi.setSystemTime(Date.now() + 1000);
    const scraper = await createKey(ada, 'scraper');
    later();
    const old = await createKey(bob, 'old');
    expect((await kit.call(bob, 'DELETE', `/api/v1/keys/${old.id}`)).status).toBe(200);
    later();
    const fresh = await createKey(bob, 'fresh');
    t.db.prepare('UPDATE api_key SET expires_at = ? WHERE key_id = ?').run(Date.now() - 1000, scraper.id);
    const { jar: root } = await kit.admin();

    const all = await list(root);
    expect(all.counts).toEqual({ all: 3, active: 1, expired: 1, revoked: 1 });
    expect(all.total).toBe(3);
    expect(all.keys.map(k => [k.name, k.email])).toEqual([['fresh', BOB.email], ['old', BOB.email], ['scraper', USER.email]]);
    for (const secret of [scraper.key, old.key, fresh.key]) expect(JSON.stringify(all)).not.toContain(secret);

    expect((await list(root, '?state=active')).keys.map(k => k.id)).toEqual([fresh.id]);
    expect((await list(root, '?state=revoked')).keys.map(k => k.id)).toEqual([old.id]);
    const expired = await list(root, '?state=expired');
    expect([expired.total, expired.keys.map(k => k.id)]).toEqual([1, [scraper.id]]);

    const ofAda = await list(root, `?q=${encodeURIComponent('ada@')}`);
    expect([ofAda.counts, ofAda.keys.map(k => k.id)]).toEqual([{ all: 1, active: 0, expired: 1, revoked: 0 }, [scraper.id]]);
    expect((await list(root, `?q=${fresh.prefix}`)).keys.map(k => k.id)).toEqual([fresh.id]);
    expect((await list(root, '?limit=1&offset=1')).keys.map(k => k.id)).toEqual([old.id]);

    const bad = await kit.call(root, 'GET', '/api/admin/keys?state=lost');
    expect([bad.status, (await kit.json(bad)).error]).toEqual([400, 'invalid_request']);
  });

  it('revokes from the list through the owner, audited', async () => {
    const key = await createKey(ada, 'scraper');
    const { jar: root, id: rootId } = await kit.admin();
    const [listed] = (await list(root, '?state=active')).keys;
    expect((await kit.call(root, 'DELETE', `/api/admin/users/${listed.userId}/keys/${listed.id}`)).status).toBe(200);

    expect((await list(root, '?state=revoked')).keys.map(k => k.id)).toEqual([key.id]);
    expect(t.db.prepare("SELECT actor_type, actor_id FROM audit_event WHERE action = 'apikey.revoke'").all()).toEqual([{ actor_type: 'admin', actor_id: rootId }]);
  });
});
