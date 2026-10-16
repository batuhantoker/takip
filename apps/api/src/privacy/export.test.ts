import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BYSTANDER, startPrivacyApp, type PrivacyApp } from './testing';
import type { AccountExport } from './export';

const EXPORT = '/api/v1/account/export';
const HOUR = 60 * 60 * 1000;

let p: PrivacyApp;

beforeEach(async () => {
  p = await startPrivacyApp();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  p.t.close();
});

const get = (headers: Record<string, string> = {}) => p.t.app.request(EXPORT, { headers });

/** Every key at every depth of a JSON value. */
function keysOf(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(keysOf);
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([key, v]) => [key, ...keysOf(v)]);
  return [];
}

describe('GET /api/v1/account/export', () => {
  it('hands a signed-in user their data as a dated JSON file', async () => {
    const ada = await p.withEverything();
    await p.withEverything(BYSTANDER, { google: false });

    const res = await get({ cookie: ada.jar.get() });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(res.headers.get('content-disposition')).toBe(`attachment; filename="takip-account-${new Date().toISOString().slice(0, 10)}.json"`);
    expect(res.headers.get('cache-control')).toBe('private, no-store');

    const data = (await res.json()) as AccountExport;
    expect(data).toMatchObject({
      format: 1,
      profile: { id: ada.userId, name: 'Ada', email: 'ada@example.com', emailVerified: true, role: 'admin', banned: false },
      twoFactor: { enabled: true },
      plan: { id: 'pro', entitlements: { 'api.keys.max': 3 } },
      overrides: [{ key: 'api.keys.max', value: '3', expiresAt: null, reason: 'partner' }],
      billingCustomers: [{ provider: 'fake', customerId: `cus_${ada.userId}` }],
      apiKeys: [{ name: 'laptop', revokedAt: null }],
      workspaces: [{
        id: ada.workspaceId, name: 'Black Sea', rev: 1, visibility: 'link', shareSlug: expect.any(String), deletedAt: null,
        state: { v: 1, layers: { ships: true }, recentPlaces: [{ label: 'Home', lat: 41, lng: 29, at: 1 }] },
      }],
      issueReports: [{ message: 'The ferry is drawn on land.', view: { link: '/?lat=41.0&lon=29.0', mode: 'live' }, status: 'open', resolvedAt: null }],
    });
    expect(data.signInMethods.map(m => m.provider).sort()).toEqual(['credential', 'google']);
    expect(data.sessions).toHaveLength(2);
    expect(data.sessions.filter(s => s.current)).toHaveLength(1);
    expect(Object.keys(data.sessions[0]).sort()).toEqual(['createdAt', 'current', 'expiresAt', 'ipAddress', 'lastActiveAt', 'userAgent']);
    expect(data.subscriptions.map(s => s.provider).sort()).toEqual(['fake', 'manual']);
    expect(data.usage.length).toBeGreaterThan(0);
    expect(data.usage[0]).toMatchObject({ day: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
    expect(data.audit.map(e => e.action)).toEqual(expect.arrayContaining(['admin.unlock', 'apikey.create', 'plan.grant', 'override.set', 'subscription.update']));
    expect(data.adminUnlocks).toHaveLength(1);
    expect(JSON.stringify(data)).not.toContain('bo@example.com');
  });

  it('never includes a token, password hash, 2FA secret, backup code or key hash', async () => {
    const ada = await p.withEverything();
    const body = await (await get({ cookie: ada.jar.get() })).text();

    const forbidden = /token|hash|secret|password|backup/i;
    expect(keysOf(JSON.parse(body)).filter(key => forbidden.test(key))).toEqual([]);

    const column = (sql: string) => (p.t.db.prepare(sql).all(ada.userId) as Record<string, unknown>[]).flatMap(row => Object.values(row));
    const stored = [
      ...column('SELECT token FROM auth_session WHERE userId = ?'),
      ...column('SELECT password, accessToken, refreshToken, idToken FROM auth_account WHERE userId = ?'),
      ...column('SELECT secret, backupCodes FROM auth_two_factor WHERE userId = ?'),
      ...column('SELECT key_hash FROM api_key WHERE user_id = ?').flatMap(hash => [(hash as Buffer).toString('hex'), (hash as Buffer).toString('base64url')]),
    ].filter((value): value is string => typeof value === 'string' && value.length > 0);
    expect(stored.length).toBeGreaterThanOrEqual(8);
    const secrets = [...stored, ada.key, ada.totpSecret, ...ada.backupCodes, ...ada.jar.get().split('; ').map(pair => pair.split('=')[1])];
    for (const secret of secrets) expect(body).not.toContain(secret);
  });

  it('answers only a session: never an API key, and not a visitor', async () => {
    const ada = await p.withEverything();
    const byKey = await get({ authorization: `Bearer ${ada.key}` });
    expect([byKey.status, await byKey.json()]).toEqual([403, { error: 'session_required' }]);
    const anon = await get();
    expect([anon.status, await anon.json()]).toEqual([401, { error: 'sign_in_required' }]);
  });

  it('asks for a recent sign-in, like the device list', async () => {
    const ada = await p.withEverything();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 25 * HOUR);
    const res = await get({ cookie: ada.jar.get() });
    expect([res.status, await res.json()]).toEqual([403, { error: 'session_not_fresh' }]);
  });
});
