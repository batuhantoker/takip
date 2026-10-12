import { afterEach, describe, expect, it } from 'vitest';
import { Jar, linkIn, startApp, USER, VERIFIED, type TestApp } from '../testing/helpers';
import { devStream } from './dev-stream';
import { createLogger, loggedPath } from './logger';

type Line = Record<string, unknown> & { level: number; msg: string };

let t: TestApp;
let raw: string[];

async function start(level: 'debug' | 'info' = 'debug') {
  raw = [];
  t = await startApp({}, { logger: createLogger({ LOG_LEVEL: level, NODE_ENV: 'production' }, { write: line => raw.push(line) }) });
}

afterEach(() => t.close());

const lines = () => raw.map(line => JSON.parse(line) as Line);
const requests = () => lines().filter(line => line.msg === 'request');
const get = (path: string, headers: Record<string, string> = {}) => t.app.request(path, { headers });

describe('request log', () => {
  it('writes one line per request with method, path, status, duration and request id', async () => {
    await start();
    await get('/api/v1/plans', { 'x-request-id': 'log-1' });

    const [line, ...rest] = requests();
    expect(rest).toEqual([]);
    expect(line).toMatchObject({ level: 30, method: 'GET', path: '/api/v1/plans', status: 200, requestId: 'log-1', principal: 'anon' });
    expect(line.durationMs).toBeTypeOf('number');
  });

  it('records the principal kind only where the access middleware ran', async () => {
    await start();
    const jar = await t.signUpVerified();
    raw.length = 0;
    await get('/api/v1/me/access', { cookie: jar.get() });
    await get('/api/auth/get-session', { cookie: jar.get() });

    const [v1, auth] = requests();
    expect(v1).toMatchObject({ path: '/api/v1/me/access', principal: 'user' });
    expect(auth.path).toBe('/api/auth/get-session');
    expect(auth).not.toHaveProperty('principal');
  });

  it('never logs query strings, cookies, authorization headers, set-cookie values or path tokens', async () => {
    await start();
    const jar = new Jar();
    expect((await t.post('/api/auth/sign-up/email', { ...USER, callbackURL: VERIFIED })).status).toBe(200);
    const link = linkIn(await t.inbox.next());
    expect(jar.take(await t.app.request(link)).status).toBe(302);
    const secrets = [
      new URL(link).searchParams.get('token')!,
      ...jar.get().split('; ').map(pair => pair.slice(pair.indexOf('=') + 1)),
      'q-secret',
      'tk_bearer-secret',
      'path-secret',
    ];
    expect(jar.get()).not.toBe('');
    expect(secrets.every(Boolean)).toBe(true);

    await get('/api/v1/me/access?token=q-secret', { cookie: jar.get(), authorization: 'Bearer tk_bearer-secret' });
    await get('/api/auth/reset-password/path-secret?callbackURL=%2F');

    const log = raw.join('');
    for (const secret of secrets) expect(log).not.toContain(secret);
    expect(requests().map(line => line.path)).toEqual([
      '/api/auth/sign-up/email',
      '/api/auth/verify-email',
      '/api/v1/me/access',
      '/api/auth/reset-password/:token',
    ]);
  });

  it('gives handlers a child logger that carries the request id and redacts headers', async () => {
    await start();
    t.app.get('/probe', c => {
      c.var.logger.warn({ headers: { cookie: 'c-secret', authorization: 'a-secret', 'set-cookie': 's-secret', accept: '*/*' } }, 'probe');
      return c.text('ok');
    });
    const res = await get('/probe');

    const probe = lines().find(line => line.msg === 'probe')!;
    expect(probe).toMatchObject({
      level: 40,
      requestId: res.headers.get('x-request-id'),
      headers: { cookie: '[redacted]', authorization: '[redacted]', 'set-cookie': '[redacted]', accept: '*/*' },
    });
    expect(raw.join('')).not.toMatch(/[cas]-secret/);
  });

  it('logs probes at debug, and failures at error with the stack', async () => {
    await start();
    t.app.get('/boom', () => {
      throw new Error('boom');
    });
    await get('/health');
    await get('/boom');

    const [health, boom] = requests();
    expect(health).toMatchObject({ level: 20, path: '/health', status: 200 });
    expect(boom).toMatchObject({ level: 50, path: '/boom', status: 500, err: { type: 'Error', message: 'boom' } });
    expect((boom.err as { stack: string }).stack).toContain('Error: boom');
  });

  it('leaves probes out at the default level', async () => {
    await start('info');
    await get('/health');
    await get('/api/v1/plans');
    expect(requests().map(line => line.path)).toEqual(['/api/v1/plans']);
  });
});

describe('loggedPath', () => {
  it("hides the reset token Better Auth puts in the path, and nothing else", () => {
    expect(loggedPath('/api/auth/reset-password/abc123')).toBe('/api/auth/reset-password/:token');
    expect(loggedPath('/api/auth/reset-password')).toBe('/api/auth/reset-password');
    expect(loggedPath('/api/admin/users/u1')).toBe('/api/admin/users/u1');
  });
});

describe('devStream', () => {
  it('prints short [api] lines for the shared dev terminal', () => {
    const out: string[] = [];
    const logger = createLogger({ LOG_LEVEL: 'info', NODE_ENV: 'development' }, devStream({ write: text => out.push(text) }));
    logger.info('listening on http://127.0.0.1:4100');
    logger.info({ signal: 'SIGINT' }, 'shutting down');
    logger.info({ requestId: 'r1', method: 'GET', path: '/api/v1/me/access', status: 200, durationMs: 3.4, principal: 'user' }, 'request');
    logger.child({ requestId: 'r2' }).error({ method: 'POST', path: '/api/x', status: 500, durationMs: 12, err: new Error('kaput') }, 'request');

    expect(out.slice(0, 3)).toEqual([
      '[api] listening on http://127.0.0.1:4100\n',
      '[api] shutting down signal=SIGINT\n',
      '[api] GET /api/v1/me/access 200 in 3ms (user)\n',
    ]);
    expect(out[3]).toMatch(/^\[api\] ERROR POST \/api\/x 500 in 12ms\nError: kaput\n {4}at /);
  });
});
