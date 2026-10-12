import { symmetricEncrypt } from 'better-auth/crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTH_SECRET, GOOGLE, Jar, ORIGIN, USER, googleApproves, startApp, viaGoogle, type TestApp } from '../testing/helpers';
import { createAuth } from './auth';
import { clearPlaintextOAuthTokens } from './oauth-tokens';

const SETTINGS = '/?account=settings';
const HEX = /^[0-9a-f]+$/;

let t: TestApp;

beforeEach(async () => {
  t = await startApp(GOOGLE);
});

afterEach(() => {
  vi.restoreAllMocks();
  t.close();
});

type Tokens = { accessToken: string | null; refreshToken: string | null; idToken: string | null };
const tokens = (providerId: string) =>
  t.db.prepare('SELECT accessToken, refreshToken, idToken FROM auth_account WHERE providerId = ?').get(providerId) as Tokens | undefined;
const providers = (userId: string) => t.db.prepare('SELECT providerId FROM auth_account WHERE userId = ? ORDER BY providerId').pluck().all(userId);
const reboot = () => createAuth(t.db, { BETTER_AUTH_URL: ORIGIN, BETTER_AUTH_SECRET: AUTH_SECRET, ...GOOGLE }, t.inbox);

/** A password account with Google connected, its tokens as Better Auth wrote them before encryption was on. */
async function legacyGoogleAccount() {
  const jar = await t.signUpVerified();
  const userId = (await t.session(jar.get()))!.user.id;
  googleApproves({ email: USER.email, email_verified: true });
  await viaGoogle(t, jar, '/api/auth/link-social', { callbackURL: SETTINGS, errorCallbackURL: SETTINGS });
  t.db.prepare("UPDATE auth_account SET accessToken = 'ya29.plain', refreshToken = '1//plain', idToken = 'eyJ.plain.jwt' WHERE providerId = 'google'").run();
  return { jar, userId };
}

describe('OAuth tokens stored before encryption', () => {
  it('are cleared at the next boot, once, and encrypted tokens are left alone', async () => {
    const { userId } = await legacyGoogleAccount();
    const encrypted = { accessToken: await symmetricEncrypt({ key: AUTH_SECRET, data: 'gho_token' }), refreshToken: '$ba$1$00ff' };
    const now = new Date().toISOString();
    t.db.prepare(`
      INSERT INTO auth_account (id, accountId, providerId, userId, accessToken, refreshToken, createdAt, updatedAt)
      VALUES ('github-row', 'github-1', 'github', ?, ?, ?, ?, ?)`).run(userId, encrypted.accessToken, encrypted.refreshToken, now, now);

    await reboot();
    expect(tokens('google')).toEqual({ accessToken: null, refreshToken: null, idToken: null });
    expect(tokens('github')).toEqual({ ...encrypted, idToken: null });
    expect(clearPlaintextOAuthTokens(t.db)).toEqual({ accessToken: 0, refreshToken: 0, idToken: 0 });
  });

  it('leave Google sign-in, disconnecting and connecting again working', async () => {
    const { jar, userId } = await legacyGoogleAccount();
    await reboot();

    const browser = new Jar();
    await viaGoogle(t, browser, '/api/auth/sign-in/social', { callbackURL: '/' });
    expect((await t.session(browser.get()))?.user.id).toBe(userId);
    expect(tokens('google')?.accessToken).toMatch(HEX);

    const accounts = (await (await t.app.request('/api/auth/list-accounts', { headers: { cookie: jar.get() } })).json()) as { id: string; providerId: string }[];
    const google = accounts.find(a => a.providerId === 'google')!;
    expect((await t.post('/api/auth/unlink-account', { accountId: google.id }, { cookie: jar.get() })).status).toBe(200);
    expect(providers(userId)).toEqual(['credential']);

    await viaGoogle(t, jar, '/api/auth/link-social', { callbackURL: SETTINGS, errorCallbackURL: SETTINGS });
    expect(providers(userId)).toEqual(['credential', 'google']);
    expect(tokens('google')).toMatchObject({ accessToken: expect.stringMatching(HEX), idToken: null });
  });
});
