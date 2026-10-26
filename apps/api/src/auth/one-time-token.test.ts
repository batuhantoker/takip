import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Jar, startApp, type TestApp } from '../testing/helpers';

let t: TestApp;

beforeEach(async () => {
  t = await startApp();
});
afterEach(() => t.close());

/** An app's sign-in hand-off: the system browser holds the session, the app's web view does not. */
describe('one-time tokens', () => {
  const mint = async (browser: Jar) => {
    const res = await t.app.request('/api/auth/one-time-token/generate', { headers: { cookie: browser.get() } });
    return { status: res.status, token: res.ok ? ((await res.json()) as { token: string }).token : null };
  };
  const trade = async (app: Jar, token: string) => app.take(await t.post('/api/auth/one-time-token/verify', { token }, { cookie: app.get() }));

  it("moves the browser's session into the app's web view once", async () => {
    const browser = await t.signUpVerified();
    const { token } = await mint(browser);
    const app = new Jar();
    expect((await trade(app, token!)).status).toBe(200);
    expect((await t.session(app.get()))?.user.email).toBe((await t.session(browser.get()))?.user.email);
    expect((await trade(new Jar(), token!)).status).toBe(400);
  });

  it('mints nothing without a session', async () => {
    expect((await mint(new Jar())).status).toBe(401);
  });

  it('refuses a token it never made', async () => {
    expect((await trade(new Jar(), 'not-a-token')).status).toBe(400);
  });
});
