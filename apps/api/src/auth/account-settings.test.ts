import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GOOGLE, Jar, RESET, USER, googleApproves, landing, linkIn, startApp, viaGoogle, type TestApp } from '../testing/helpers';

// The web app's landing URLs (src/lib/account-links.ts).
const SETTINGS = '/?account=settings';
const DELETED = '/?account=deleted';
const NEW_PASSWORD = 'a different horse entirely';
const CREDENTIALS = { email: USER.email, password: USER.password };

let t: TestApp;

beforeEach(async () => {
  t = await startApp(GOOGLE);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  t.close();
});

const get = (path: string, cookie: string) => t.app.request(path, { headers: { cookie } });
const json = async <T>(res: Response) => (await res.json()) as T;

async function secondDevice() {
  const jar = new Jar();
  expect(jar.take(await t.post('/api/auth/sign-in/email', CREDENTIALS)).status).toBe(200);
  return jar;
}

const accountsOf = async (jar: Jar) => json<{ id: string; providerId: string }[]>(await get('/api/auth/list-accounts', jar.get()));
const providersOf = async (jar: Jar) => (await accountsOf(jar)).map(a => a.providerId).sort();

async function unlink(jar: Jar, providerId: string) {
  // Better Auth's own account row id, not the provider's.
  const account = (await accountsOf(jar)).find(a => a.providerId === providerId)!;
  return t.post('/api/auth/unlink-account', { accountId: account.id }, { cookie: jar.get() });
}

describe('profile', () => {
  it('renames the user', async () => {
    const jar = await t.signUpVerified();
    expect(jar.take(await t.post('/api/auth/update-user', { name: 'Ada L' }, { cookie: jar.get() })).status).toBe(200);
    expect((await t.session(jar.get()))?.user.name).toBe('Ada L');
  });
});

describe('password', () => {
  it('changes it and signs other devices out', async () => {
    const here = await t.signUpVerified();
    const there = await secondDevice();

    const res = here.take(await t.post(
      '/api/auth/change-password',
      { currentPassword: USER.password, newPassword: NEW_PASSWORD, revokeOtherSessions: true },
      { cookie: here.get() },
    ));
    expect(res.status).toBe(200);
    expect(await t.session(here.get())).not.toBeNull();
    expect(await t.session(there.get('takip.session_token'))).toBeNull();
    expect((await t.post('/api/auth/sign-in/email', CREDENTIALS)).status).toBe(401);
    expect((await t.post('/api/auth/sign-in/email', { ...CREDENTIALS, password: NEW_PASSWORD })).status).toBe(200);
  });

  it('needs the current password', async () => {
    const here = await t.signUpVerified();
    const res = await t.post('/api/auth/change-password', { currentPassword: 'not it at all', newPassword: NEW_PASSWORD }, { cookie: here.get() });
    expect(res.status).toBe(400);
  });

  it('lets someone who signed up with Google set one through the reset email', async () => {
    googleApproves({ email: 'ada@gmail.com', email_verified: true });
    await viaGoogle(t, new Jar(), '/api/auth/sign-in/social', { callbackURL: '/' });

    await t.post('/api/auth/request-password-reset', { email: 'ada@gmail.com', redirectTo: RESET });
    const token = landing(await t.app.request(linkIn(await t.inbox.next()))).searchParams.get('token');
    expect((await t.post('/api/auth/reset-password', { token, newPassword: NEW_PASSWORD })).status).toBe(200);
    expect((await t.post('/api/auth/sign-in/email', { email: 'ada@gmail.com', password: NEW_PASSWORD })).status).toBe(200);
  });
});

describe('devices', () => {
  it('lists each signed-in device and signs the others out', async () => {
    const here = await t.signUpVerified();
    const there = await secondDevice();
    expect(await json<unknown[]>(await get('/api/auth/list-sessions', here.get()))).toHaveLength(2);

    expect((await t.post('/api/auth/revoke-other-sessions', {}, { cookie: here.get() })).status).toBe(200);
    expect(await json<unknown[]>(await get('/api/auth/list-sessions', here.get()))).toHaveLength(1);
    expect(await t.session(there.get('takip.session_token'))).toBeNull();
  });

  it('signs out one chosen device', async () => {
    const here = await t.signUpVerified();
    const there = await secondDevice();
    const sessions = await json<{ token: string }[]>(await get('/api/auth/list-sessions', here.get()));
    // The cookie carries the token plus a signature.
    const theirs = sessions.find(s => there.get('takip.session_token').includes(s.token))!;

    expect((await t.post('/api/auth/revoke-session', { token: theirs.token }, { cookie: here.get() })).status).toBe(200);
    expect(await t.session(there.get('takip.session_token'))).toBeNull();
    expect(await t.session(here.get('takip.session_token'))).not.toBeNull();
  });

  it('asks for a fresh sign-in once the session is a day old', async () => {
    const here = await t.signUpVerified();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 2 * 24 * 60 * 60 * 1000);

    const res = await get('/api/auth/list-sessions', here.get());
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: 'SESSION_NOT_FRESH' });
  });
});

describe('connected accounts', () => {
  it('connects Google to a password account and disconnects it again', async () => {
    const here = await t.signUpVerified();
    googleApproves({ email: USER.email, email_verified: true });

    const { landed } = await viaGoogle(t, here, '/api/auth/link-social', { callbackURL: SETTINGS, errorCallbackURL: SETTINGS });
    expect(`${landed.pathname}${landed.search}`).toBe(SETTINGS);
    expect(await providersOf(here)).toEqual(['credential', 'google']);

    expect((await unlink(here, 'google')).status).toBe(200);
    expect(await providersOf(here)).toEqual(['credential']);
  });

  it('refuses a Google account under a different email', async () => {
    const here = await t.signUpVerified();
    googleApproves({ email: 'someone.else@gmail.com', email_verified: true });

    const { landed } = await viaGoogle(t, here, '/api/auth/link-social', { callbackURL: SETTINGS, errorCallbackURL: SETTINGS });
    expect(landed.searchParams.get('error')).toBe('email_does_not_match');
    expect(await providersOf(here)).toEqual(['credential']);
  });

  it('never removes the last way to sign in', async () => {
    const here = await t.signUpVerified();
    const res = await unlink(here, 'credential');
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: 'FAILED_TO_UNLINK_LAST_ACCOUNT' });
    expect(await providersOf(here)).toEqual(['credential']);
  });
});

describe('account deletion', () => {
  it('deletes everything once the emailed link is opened where the user is signed in', async () => {
    const here = await t.signUpVerified();
    const userId = (await t.session(here.get()))!.user.id;
    const rows = (table: string, column: string) =>
      t.db.prepare(`SELECT count(*) FROM ${table} WHERE ${column} = ?`).pluck().get(userId);

    expect((await t.post('/api/auth/delete-user', { callbackURL: DELETED }, { cookie: here.get() })).status).toBe(200);
    expect(rows('auth_user', 'id')).toBe(1);
    const link = linkIn(await t.inbox.next());

    expect((await t.app.request(link)).status).toBe(404);
    expect(rows('auth_user', 'id')).toBe(1);

    const confirmed = here.take(await t.app.request(link, { headers: { cookie: here.get() } }));
    expect(confirmed.status).toBe(302);
    expect(`${landing(confirmed).pathname}${landing(confirmed).search}`).toBe(DELETED);
    expect([rows('auth_user', 'id'), rows('auth_account', 'userId'), rows('auth_session', 'userId')]).toEqual([0, 0, 0]);
    expect(await t.session(here.get('takip.session_token'))).toBeNull();
    // Every cookie, including the 5-minute session cache: the browser must not still look signed in.
    expect(await t.session(here.get())).toBeNull();
  });
});
