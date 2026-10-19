import { afterEach, describe, expect, it, vi } from 'vitest';
import { ORIGIN, USER, startApp } from '../testing/helpers';

const from = (remoteAddress: string) => ({ incoming: { socket: { remoteAddress } } });

afterEach(() => vi.unstubAllEnvs());

describe('the sign-in limit', () => {
  it('refuses a fourth password within ten seconds from one address, outside production too', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const t = await startApp();
    const attempt = (peer: string) => t.app.request('/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGIN },
      body: JSON.stringify({ email: USER.email, password: 'not the password' }),
    }, from(peer));

    for (let i = 0; i < 3; i++) expect((await attempt('203.0.113.7')).status).toBe(401);
    expect((await attempt('203.0.113.7')).status).toBe(429);
    expect((await attempt('203.0.113.8')).status).toBe(401);
  });
});
