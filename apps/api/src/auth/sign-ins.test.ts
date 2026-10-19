import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Jar, ORIGIN, USER, startApp, type TestApp } from '../testing/helpers';

let t: TestApp;

beforeEach(async () => {
  t = await startApp();
});

afterEach(() => t.close());

describe('the sign-in log', () => {
  it('keeps every sign-in after the session is gone', async () => {
    const jar = await t.signUpVerified();
    const userId = (await t.session(jar.get()))!.user.id;
    jar.take(await t.post('/api/auth/sign-out', {}, { cookie: jar.get() }));
    const again = new Jar();
    again.take(await t.app.request('/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGIN, 'user-agent': 'Mozilla/5.0 (iPhone) Safari/605.1' },
      body: JSON.stringify({ email: USER.email, password: USER.password }),
    }));

    const rows = t.db.prepare('SELECT user_id AS userId, user_agent AS userAgent, impersonated_by AS impersonatedBy FROM sign_in ORDER BY sign_in_id').all() as { userId: string; userAgent: string | null }[];
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows.every(r => r.userId === userId)).toBe(true);
    expect(rows.at(-1)).toMatchObject({ userAgent: 'Mozilla/5.0 (iPhone) Safari/605.1', impersonatedBy: null });
    expect(t.db.prepare('SELECT count(*) FROM auth_session WHERE userId = ?').pluck().get(userId)).toBe(1);
  });
});
