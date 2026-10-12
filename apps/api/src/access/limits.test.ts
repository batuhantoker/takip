import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Access } from '@takip/core/entitlements';
import { startApp, type TestApp } from '../testing/helpers';
import { setPlanValue } from './grants';
import { rateLimit } from './limits';
import type { AccessEnv, Principal } from './middleware';
import { createUsage, meter, type Usage } from './usage';

const OPERATOR = { type: 'admin', id: 'test' } as const;
const from = (remoteAddress: string) => ({ incoming: { socket: { remoteAddress } } });
const limitHeaders = (res: Response) => ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset', 'Retry-After'].map(h => res.headers.get(h));

let t: TestApp;

beforeEach(async () => {
  t = await startApp({}, undefined, { enforceLimits: true });
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-12T12:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
  t.close();
});

describe('on /api/v1', () => {
  const anon = (peer: string, headers: Record<string, string> = {}) => t.app.request('/api/v1/me/access', { headers }, from(peer));

  it('send RateLimit headers, then 429 with Retry-After once a visitor spends three seconds of web.rps', async () => {
    for (let i = 29; i >= 0; i--) {
      const res = await anon('203.0.113.5');
      expect(res.status).toBe(200);
      expect(limitHeaders(res)).toEqual(['10', String(i), String(Math.ceil((30 - i) / 10)), null]);
    }
    const refused = await anon('203.0.113.5');
    expect(refused.status).toBe(429);
    expect(limitHeaders(refused)).toEqual(['10', '0', '3', '1']);
    expect(await refused.json()).toEqual({ error: 'rate_limited', retry_after: 1 });

    vi.advanceTimersByTime(1_000);
    expect((await anon('203.0.113.5')).status).toBe(200);
  });

  it('keep one bucket per visitor', async () => {
    for (let i = 0; i < 30; i++) await anon('203.0.113.5');
    expect((await anon('203.0.113.5')).status).toBe(429);
    expect((await anon('203.0.113.6')).status).toBe(200);
  });

  it('give no fresh bucket for a forged X-Forwarded-For from an untrusted peer', async () => {
    for (let i = 0; i < 30; i++) expect((await anon('203.0.113.5', { 'x-forwarded-for': `198.51.100.${i}` })).status).toBe(200);
    expect((await anon('203.0.113.5', { 'x-forwarded-for': '198.51.100.99' })).status).toBe(429);
  });

  it('tell clients behind our own proxy apart', async () => {
    for (let i = 0; i < 30; i++) await anon('127.0.0.1', { 'x-forwarded-for': '198.51.100.1' });
    expect((await anon('127.0.0.1', { 'x-forwarded-for': '198.51.100.1' })).status).toBe(429);
    expect((await anon('127.0.0.1', { 'x-forwarded-for': '198.51.100.2' })).status).toBe(200);
  });

  it('limit a signed-in user by their plan, whatever address they come from', async () => {
    const jar = await t.signUpVerified();
    setPlanValue(t.db, { planId: 'free', key: 'web.rps', value: '2', actor: OPERATOR });
    t.access.invalidate();
    const call = (peer: string) => t.app.request('/api/v1/me/access', { headers: { cookie: jar.get() } }, from(peer));
    expect((await call('203.0.113.5')).headers.get('RateLimit-Limit')).toBe('2');
    for (let i = 0; i < 5; i++) expect((await call(`203.0.113.${10 + i}`)).status).toBe(200);
    expect((await call('203.0.113.7')).status).toBe(429);
  });

  it('cover the public v1 routes, each counted under its own group', async () => {
    for (const path of ['/api/v1/geo/search', '/api/v1/directions', '/api/v1/openapi.json', '/api/v1/docs', '/api/v1/no-such-route']) {
      expect((await t.app.request(path, {}, from('203.0.113.5'))).headers.get('RateLimit-Limit'), path).toBe('10');
    }
    t.usage.flush();
    expect(t.db.prepare('SELECT route_group FROM usage_counter ORDER BY route_group').pluck().all())
      .toEqual(['directions', 'docs', 'geo', 'openapi.json', 'other']);
  });

  it('count refused requests as denied', async () => {
    for (let i = 0; i < 32; i++) await anon('203.0.113.5');
    t.usage.flush();
    expect(t.db.prepare("SELECT route_group, requests, denied FROM usage_counter WHERE subject_type = 'anon'").all())
      .toEqual([{ route_group: 'me', requests: 30, denied: 2 }]);
  });
});

/** A stand-in for API-key resolution (workstream B): the principal and access are set the way withAccess will. */
function keyApp(usage: Usage, entitlements: Partial<Access['entitlements']>, principal: Principal = { kind: 'key', keyId: 'k1', userId: 'u1', ip: '203.0.113.5' }) {
  const plan = t.access.plan('free');
  const app = new Hono<AccessEnv>();
  app.use('/api/v1/*', async (c, next) => {
    const ip = c.req.header('x-test-ip');
    c.set('principal', ip ? { ...principal, ip } : principal);
    c.set('access', { plan: { id: plan.id, name: plan.name }, entitlements: { ...plan.entitlements, ...entitlements }, subscription: null });
    await next();
  }, rateLimit(usage), meter(usage));
  app.get('/api/v1/geo/search', c => c.json({ ok: true }));
  app.get('/api/v1/raw', () => new Response('raw'));
  app.get('/api/v1/redirect', () => Response.redirect('https://example.com/', 302));
  return app;
}

describe('API keys', () => {
  it('are held to api.rps, not web.rps', async () => {
    const app = keyApp(t.usage, { 'api.rps': 2, 'web.rps': 50 });
    expect((await app.request('/api/v1/geo/search')).headers.get('RateLimit-Limit')).toBe('2');
    expect((await app.request('/api/v1/geo/search')).status).toBe(200);
    const refused = await app.request('/api/v1/geo/search');
    expect(refused.status).toBe(429);
    expect(await refused.json()).toMatchObject({ error: 'rate_limited' });
  });

  it('share one bucket per key, not per address', async () => {
    const app = keyApp(t.usage, { 'api.rps': 1 });
    expect((await app.request('/api/v1/geo/search')).status).toBe(200);
    expect((await app.request('/api/v1/geo/search', { headers: { 'x-test-ip': '198.51.100.9' } })).status).toBe(429);
  });

  it('stop at the daily quota until UTC midnight', async () => {
    vi.setSystemTime(new Date('2026-10-12T23:59:58.500Z'));
    const app = keyApp(t.usage, { 'api.requests_per_day': 3, 'api.rps': 100 });
    for (let i = 0; i < 3; i++) expect((await app.request('/api/v1/geo/search')).status).toBe(200);

    const refused = await app.request('/api/v1/geo/search');
    expect(refused.status).toBe(429);
    expect(limitHeaders(refused)).toEqual(['3', '0', '2', '2']);
    expect(await refused.json()).toEqual({ error: 'quota_exceeded', limit: 3, used: 3, reset_at: '2026-10-13T00:00:00.000Z', retry_after: 2 });

    vi.setSystemTime(new Date('2026-10-13T00:00:00.001Z'));
    expect((await app.request('/api/v1/geo/search')).status).toBe(200);
    expect(t.usage.quotaUsed('u1')).toBe(1);
  });

  it('count against their owner, across all of the owner\'s keys', async () => {
    const first = keyApp(t.usage, { 'api.requests_per_day': 2, 'api.rps': 100 });
    const second = keyApp(t.usage, { 'api.requests_per_day': 2, 'api.rps': 100 }, { kind: 'key', keyId: 'k2', userId: 'u1', ip: '203.0.113.5' });
    expect((await first.request('/api/v1/geo/search')).status).toBe(200);
    expect((await second.request('/api/v1/geo/search')).status).toBe(200);
    expect(await (await first.request('/api/v1/geo/search')).json()).toMatchObject({ error: 'quota_exceeded' });
  });

  it('leave session traffic out of the quota', async () => {
    const session = keyApp(t.usage, { 'api.requests_per_day': 1 }, { kind: 'user', userId: 'u1', ip: '203.0.113.5' });
    for (let i = 0; i < 3; i++) expect((await session.request('/api/v1/geo/search')).status).toBe(200);
    expect(t.usage.quotaUsed('u1')).toBe(0);
  });

  it('see the quota again after a restart', async () => {
    const app = keyApp(t.usage, { 'api.requests_per_day': 2, 'api.rps': 100 });
    for (let i = 0; i < 2; i++) await app.request('/api/v1/geo/search');
    t.usage.flush();

    const rebooted = keyApp(createUsage(t.db), { 'api.requests_per_day': 2, 'api.rps': 100 });
    expect(await (await rebooted.request('/api/v1/geo/search')).json()).toMatchObject({ error: 'quota_exceeded', used: 2 });
  });
});

describe('headers', () => {
  it('reach a bare Response and one whose headers are immutable', async () => {
    const app = keyApp(t.usage, { 'api.rps': 5 });
    expect((await app.request('/api/v1/raw')).headers.get('RateLimit-Remaining')).toBe('4');
    const redirect = await app.request('/api/v1/redirect');
    expect(redirect.status).toBe(302);
    expect(redirect.headers.get('location')).toBe('https://example.com/');
    expect(redirect.headers.get('RateLimit-Remaining')).toBe('3');
  });
});
