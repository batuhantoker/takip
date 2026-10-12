import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadEnv } from '../env';
import { GOOGLE, Jar, ORIGIN, SIGN_IN_FAILED, USER, consentUrl, googleApproves, startApp, viaGoogle, type TestApp } from '../testing/helpers';

const FACEBOOK = { FACEBOOK_CLIENT_ID: 'facebook-id', FACEBOOK_CLIENT_SECRET: 'facebook-secret' };

let t: TestApp;

afterEach(() => {
  vi.restoreAllMocks();
  t.close();
});

describe('provider list', () => {
  it('offers only the configured providers, in dialog order', async () => {
    t = await startApp({ ...FACEBOOK, ...GOOGLE });
    expect(await (await t.app.request('/api/v1/auth/providers')).json()).toEqual({ providers: ['google', 'facebook'] });
  });

  it('offers none when nothing is configured', async () => {
    t = await startApp();
    expect(await (await t.app.request('/api/v1/auth/providers')).json()).toEqual({ providers: [] });
  });

  it('refuses to boot with half a provider configured', () => {
    t = { close() {} } as TestApp;
    expect(() => loadEnv({ GOOGLE_CLIENT_ID: 'google-id' })).toThrow(/GOOGLE_CLIENT_SECRET/);
  });

  it('sends Facebook users to Facebook with our callback', async () => {
    t = await startApp(FACEBOOK);
    const url = await consentUrl(await t.post('/api/auth/sign-in/social', { provider: 'facebook', callbackURL: '/' }));
    expect(url.hostname).toBe('www.facebook.com');
    expect(url.searchParams.get('client_id')).toBe('facebook-id');
    expect(url.searchParams.get('redirect_uri')).toBe(`${ORIGIN}/api/auth/callback/facebook`);
  });
});

describe('Google sign-in', () => {
  beforeEach(async () => {
    t = await startApp(GOOGLE);
  });

  const signInWithGoogle = (jar = new Jar()) =>
    viaGoogle(t, jar, '/api/auth/sign-in/social', { callbackURL: '/?layers=ships', errorCallbackURL: SIGN_IN_FAILED }).then(r => ({ ...r, jar }));

  const accountsOf = (userId: string) =>
    t.db.prepare('SELECT providerId FROM auth_account WHERE userId = ? ORDER BY providerId').pluck().all(userId);

  it('signs a new user straight in when Google vouches for the email', async () => {
    googleApproves({ email: 'ada@gmail.com', email_verified: true });
    const { consent, jar, landed } = await signInWithGoogle();
    expect(`${consent.origin}${consent.pathname}`).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(consent.searchParams.get('redirect_uri')).toBe(`${ORIGIN}/api/auth/callback/google`);
    expect(`${landed.pathname}${landed.search}`).toBe('/?layers=ships');
    expect(await t.session(jar.get())).toMatchObject({ user: { email: 'ada@gmail.com', emailVerified: true } });
  });

  it('makes the user confirm by email when the provider does not vouch for it', async () => {
    googleApproves({ email: 'ada@gmail.com', email_verified: false });
    const { jar, landed } = await signInWithGoogle();
    expect(landed.searchParams.get('account')).toBe('sign-in-failed');
    expect(landed.searchParams.get('error')).toBe('email_not_verified');
    expect(await t.session(jar.get())).toBeNull();
    expect((await t.inbox.next()).to).toBe('ada@gmail.com');
  });

  it('joins an existing account whose email was confirmed', async () => {
    const userId = (await t.session((await t.signUpVerified()).get()))!.user.id;
    googleApproves({ email: USER.email, email_verified: true });
    const { jar } = await signInWithGoogle();
    expect((await t.session(jar.get()))?.user.id).toBe(userId);
    expect(accountsOf(userId)).toEqual(['credential', 'google']);
  });

  it('will not join an account whose email was never confirmed', async () => {
    // Someone registered this address with a password but never proved they own it.
    await t.post('/api/auth/sign-up/email', USER);
    await t.inbox.next();
    googleApproves({ email: USER.email, email_verified: true });

    const { jar, landed } = await signInWithGoogle();
    expect(landed.searchParams.get('error')).toBe('account_not_linked');
    expect(await t.session(jar.get())).toBeNull();
    const squatter = t.db.prepare('SELECT id FROM auth_user WHERE email = ?').pluck().get(USER.email) as string;
    expect(accountsOf(squatter)).toEqual(['credential']);
  });
});
