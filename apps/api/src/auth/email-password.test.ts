import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Jar, RESET, USER, VERIFIED, landing, linkIn, startApp, tick, type TestApp } from '../testing/helpers';

let t: TestApp;

beforeEach(async () => {
  t = await startApp();
});

afterEach(() => t.close());

describe('sign-up and email verification', () => {
  it('gives no session until the emailed link is opened, then signs in', async () => {
    const jar = new Jar();
    expect(jar.take(await t.post('/api/auth/sign-up/email', USER)).status).toBe(200);
    expect(await t.session(jar.get())).toBeNull();

    const mail = await t.inbox.next();
    expect(mail.to).toBe(USER.email);
    jar.take(await t.app.request(linkIn(mail)));
    expect(await t.session(jar.get())).toMatchObject({ user: { email: USER.email, emailVerified: true } });
  });

  it('refuses an unverified sign-in; a fresh link is sent on request', async () => {
    await t.post('/api/auth/sign-up/email', USER);
    await t.inbox.next();

    const res = await t.post('/api/auth/sign-in/email', { email: USER.email, password: USER.password });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: 'EMAIL_NOT_VERIFIED' });
    await tick();
    expect(t.inbox.size).toBe(0);

    expect((await t.post('/api/auth/send-verification-email', { email: USER.email, callbackURL: VERIFIED })).status).toBe(200);
    const jar = new Jar();
    expect(landing(jar.take(await t.app.request(linkIn(await t.inbox.next())))).search).toBe('?account=verified');
    expect((await t.session(jar.get()))?.user.email).toBe(USER.email);
  });

  it('lands a bad link back on the map with the error', async () => {
    const res = await t.app.request(`/api/auth/verify-email?token=not-a-token&callbackURL=${encodeURIComponent(VERIFIED)}`);
    expect(res.status).toBe(302);
    expect(landing(res).searchParams.get('account')).toBe('verified');
    expect(landing(res).searchParams.get('error')).toBeTruthy();
  });

  it('answers a repeat sign-up the same way, and tells the owner instead', async () => {
    await t.signUpVerified();
    const again = await t.post('/api/auth/sign-up/email', USER);
    expect(again.status).toBe(200);
    expect(again.headers.getSetCookie()).toEqual([]);
    expect(await t.inbox.next()).toMatchObject({ to: USER.email, subject: expect.stringContaining('already have') });
  });
});

describe('sign-in and sign-out', () => {
  it('signs out, revoking the session on the server', async () => {
    const jar = await t.signUpVerified();
    const token = jar.get('takip.session_token');
    expect(jar.take(await t.post('/api/auth/sign-out', {}, { cookie: jar.get() })).status).toBe(200);
    expect(await t.session(jar.get())).toBeNull();
    expect(await t.session(token)).toBeNull();
  });

  it('signs back in with the right password only', async () => {
    await t.signUpVerified();
    expect((await t.post('/api/auth/sign-in/email', { email: USER.email, password: 'not it at all' })).status).toBe(401);

    const jar = new Jar();
    expect(jar.take(await t.post('/api/auth/sign-in/email', { email: USER.email, password: USER.password })).status).toBe(200);
    expect((await t.session(jar.get()))?.user.email).toBe(USER.email);
  });

  it('rejects a sign-in from another origin', async () => {
    await t.signUpVerified();
    const res = await t.post('/api/auth/sign-in/email', { email: USER.email, password: USER.password }, { origin: 'https://evil.example' });
    expect(res.status).toBe(403);
  });
});

describe('password reset', () => {
  it('sets a new password from the emailed link and ends existing sessions', async () => {
    const oldToken = (await t.signUpVerified()).get('takip.session_token');

    expect((await t.post('/api/auth/request-password-reset', { email: USER.email, redirectTo: RESET })).status).toBe(200);
    const opened = await t.app.request(linkIn(await t.inbox.next()));
    expect(opened.status).toBe(302);
    expect(landing(opened).searchParams.get('account')).toBe('reset-password');
    const token = landing(opened).searchParams.get('token');
    expect(token).toBeTruthy();

    const newPassword = 'a different horse entirely';
    expect((await t.post('/api/auth/reset-password', { token, newPassword })).status).toBe(200);
    expect((await t.post('/api/auth/sign-in/email', { email: USER.email, password: USER.password })).status).toBe(401);
    expect((await t.post('/api/auth/sign-in/email', { email: USER.email, password: newPassword })).status).toBe(200);
    expect(await t.session(oldToken)).toBeNull();
  });

  it('answers for an unknown address the same way, and sends nothing', async () => {
    const res = await t.post('/api/auth/request-password-reset', { email: 'nobody@example.com', redirectTo: RESET });
    expect(res.status).toBe(200);
    await tick();
    expect(t.inbox.size).toBe(0);
  });
});

describe('storage', () => {
  it('keeps its tables under the auth_ prefix', () => {
    const tables = t.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name GLOB 'auth_*' ORDER BY name").pluck().all();
    expect(tables).toEqual(['auth_account', 'auth_session', 'auth_two_factor', 'auth_user', 'auth_verification']);
  });
});
