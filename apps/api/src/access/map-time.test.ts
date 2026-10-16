import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startApp, type Jar, type TestApp } from '../testing/helpers';
import { grantPlan, setPlanValue } from './grants';

const OPERATOR = { type: 'admin', id: 'test' } as const;
const MINUTE = 60_000;
const from = (remoteAddress: string) => ({ incoming: { socket: { remoteAddress } } });

let t: TestApp;

beforeEach(async () => {
  t = await startApp();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-16T10:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
  t.close();
});

type State = { limit: number; used: number; remaining: number; blocked: boolean; resetsAt: string };
const call = async (method: 'GET' | 'POST', { jar, peer = '203.0.113.5', headers = {} }: { jar?: Jar; peer?: string; headers?: Record<string, string> } = {}) => {
  const res = await t.app.request('/api/v1/me/time', { method, headers: { ...headers, ...(jar && { cookie: jar.get() }) } }, from(peer));
  expect(res.status).toBe(200);
  return (await res.json()) as State;
};
const later = (ms: number) => vi.setSystemTime(Date.now() + ms);
const setLimit = (plan: string, minutes: number) => {
  setPlanValue(t.db, { planId: plan, key: 'map.minutes_per_day', value: String(minutes), actor: OPERATOR });
  t.access.invalidate();
};

describe('map time', () => {
  it('gives visitors 15 minutes a day and accounts 60, counted apart', async () => {
    expect(await call('GET')).toEqual({ limit: 15, used: 0, remaining: 15, blocked: false, resetsAt: '2026-10-17T00:00:00.000Z' });
    expect(await call('POST')).toMatchObject({ used: 1, remaining: 14 });
    const jar = await t.signUpVerified();
    expect(await call('POST', { jar })).toMatchObject({ limit: 60, used: 1 });
    expect(await call('GET')).toMatchObject({ limit: 15, used: 1 });
  });

  it('counts one minute however many tabs tick', async () => {
    await call('POST');
    await call('POST');
    later(30_000);
    expect(await call('POST')).toMatchObject({ used: 1 });
    later(30_000);
    expect(await call('POST')).toMatchObject({ used: 2 });
  });

  it('keeps visitors on different networks apart', async () => {
    await call('POST', { peer: '203.0.113.5' });
    expect(await call('GET', { peer: '198.51.100.7' })).toMatchObject({ used: 0 });
    // The same IPv6 /64 is one visitor.
    await call('POST', { peer: '2001:db8:1:1::1' });
    expect(await call('GET', { peer: '2001:db8:1:1::2' })).toMatchObject({ used: 1 });
  });

  it('blocks at the limit and stops counting there', async () => {
    setLimit('anon', 2);
    await call('POST');
    later(MINUTE);
    expect(await call('POST')).toMatchObject({ used: 2, remaining: 0, blocked: true });
    later(MINUTE);
    expect(await call('POST')).toMatchObject({ used: 2, blocked: true });
  });

  it('starts again at UTC midnight and forgets the old days', async () => {
    setLimit('anon', 1);
    expect(await call('POST')).toMatchObject({ blocked: true });
    vi.setSystemTime(new Date('2026-10-17T00:00:05.000Z'));
    expect(await call('GET')).toMatchObject({ used: 0, blocked: false, resetsAt: '2026-10-18T00:00:00.000Z' });
    expect(t.db.prepare('SELECT count(*) FROM map_time').pluck().get()).toBe(0);
  });

  it('has no limit at 0, and never counts plans without one or API keys', async () => {
    const jar = await t.signUpVerified();
    const userId = (await t.session(jar.get()))!.user.id;
    grantPlan(t.db, { userId, planId: 'pro', actor: OPERATOR });
    t.access.invalidate();
    expect(await call('POST', { jar })).toEqual({ limit: 0, used: 0, remaining: 0, blocked: false, resetsAt: '2026-10-17T00:00:00.000Z' });

    const created = await t.app.request('/api/v1/keys', {
      method: 'POST',
      headers: { cookie: jar.get(), 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'script' }),
    });
    const { key } = (await created.json()) as { key: string };
    expect(await call('POST', { headers: { authorization: `Bearer ${key}` } })).toMatchObject({ limit: 0, blocked: false });
    expect(t.db.prepare('SELECT count(*) FROM map_time').pluck().get()).toBe(0);
  });
});
