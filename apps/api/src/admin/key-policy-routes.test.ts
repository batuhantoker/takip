import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startApp, type TestApp } from '../testing/helpers';
import { adminKit, ADMIN } from './testing';

const SEARCH = '/api/v1/geo/search?q=a';

let t: TestApp;
let kit: ReturnType<typeof adminKit>;

beforeEach(async () => {
  t = await startApp({}, undefined, { enforceKeyPolicy: true });
  kit = adminKit(t);
});

afterEach(() => t.close());

type Group = { group: string; keyRequired: boolean; updatedBy: string | null; week: { keys: number; accounts: number; anonymous: number; refused: number } };
const groups = async (jar: Parameters<typeof kit.call>[0]) => (await kit.json<{ groups: Group[] }>(await kit.call(jar, 'GET', '/api/admin/key-policy'))).groups;

describe('API access in the console', () => {
  it('is behind the gate', async () => {
    const user = await t.signUpVerified();
    await kit.expectGated('GET', '/api/admin/key-policy', user);
    await kit.expectGated('PUT', '/api/admin/key-policy/geo', user, { keyRequired: false });
    await kit.expectGated('PUT', '/api/admin/key-policy', user, { keyRequired: false });
  });

  it('opens and closes one group or all of them, and says who did it', async () => {
    const { jar } = await kit.admin();
    expect((await t.app.request(SEARCH)).status).toBe(401);

    expect((await kit.call(jar, 'PUT', '/api/admin/key-policy/geo', { keyRequired: false })).status).toBe(200);
    expect((await t.app.request(SEARCH)).status).toBe(200);
    expect((await groups(jar)).find(g => g.group === 'geo')).toMatchObject({ keyRequired: false, updatedBy: ADMIN.email });

    expect((await kit.call(jar, 'PUT', '/api/admin/key-policy', { keyRequired: false })).status).toBe(200);
    expect((await groups(jar)).every(g => !g.keyRequired)).toBe(true);
    expect((await kit.call(jar, 'PUT', '/api/admin/key-policy', { keyRequired: true })).status).toBe(200);
    expect((await t.app.request(SEARCH)).status).toBe(401);
  });

  it('refuses unknown groups, meta groups and bad bodies', async () => {
    const { jar } = await kit.admin();
    expect((await kit.call(jar, 'PUT', '/api/admin/key-policy/nope', { keyRequired: false })).status).toBe(404);
    expect((await kit.call(jar, 'PUT', '/api/admin/key-policy/keys', { keyRequired: true })).status).toBe(404);
    expect((await kit.call(jar, 'PUT', '/api/admin/key-policy/geo', { keyRequired: 'no' })).status).toBe(400);
    expect((await kit.call(jar, 'PUT', '/api/admin/key-policy/geo', {})).status).toBe(400);
  });

  it('shows each group\'s week split by keys, accounts, visitors and refusals', async () => {
    const { jar } = await kit.admin();
    const key = (await kit.json<{ key: string }>(await kit.call(jar, 'POST', '/api/v1/keys', { name: 'script' }))).key;
    await t.app.request(SEARCH, { headers: { authorization: `Bearer ${key}` } });
    await t.app.request(SEARCH, { headers: { cookie: jar.get() } });
    await t.app.request(SEARCH, { headers: { 'sec-fetch-site': 'same-origin' } });
    await t.app.request(SEARCH);
    await t.app.request(SEARCH);
    expect((await groups(jar)).find(g => g.group === 'geo')!.week).toEqual({ keys: 1, accounts: 1, anonymous: 1, refused: 2 });
  });
});
