import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DAY_MS, isoDay } from '../access/usage';
import { Jar, USER, startApp, type TestApp } from '../testing/helpers';
import { adminKit } from './testing';

let t: TestApp;
let kit: ReturnType<typeof adminKit>;
let ada: Jar;
let adaId: string;
let root: Jar;
let key: { id: string; key: string; prefix: string };

const NOW = Date.UTC(2026, 9, 12, 12);
const TODAY = isoDay(Math.floor(NOW / DAY_MS));
const YESTERDAY = isoDay(Math.floor(NOW / DAY_MS) - 1);

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  t = await startApp();
  kit = adminKit(t);
  ada = await t.signUpVerified();
  adaId = await kit.userIdOf(ada);
  key = await kit.json<typeof key>(await kit.call(ada, 'POST', '/api/v1/keys', { name: 'scraper' }));
  root = (await kit.admin()).jar;
});

afterEach(() => {
  vi.useRealTimers();
  t.close();
});

const hit = (times: number, headers: Record<string, string> = {}) =>
  Promise.all(Array.from({ length: times }, async () => expect((await t.app.request('/api/v1/me/access', { headers })).status).toBe(200)));

type Series = { today: string; groups: string[]; days: { day: string; requests: number; denied: number; groups: Record<string, { requests: number; denied: number }> }[] };
type Top = { day: string; consumers: { subjectType: string; subjectId: string; keyId: string; requests: number; denied: number; email: string | null; keyPrefix: string | null; groups: Record<string, number> }[] };

describe('usage in the console', () => {
  it('is behind the gate', async () => {
    await kit.expectGated('GET', '/api/admin/usage', ada);
    await kit.expectGated('GET', '/api/admin/usage/top', ada);
  });

  it('sums requests and refusals per day and route group, unflushed ones included, and ranks the callers of a day', async () => {
    vi.setSystemTime(NOW - DAY_MS);
    await hit(2);
    await hit(1, { cookie: ada.get() });
    vi.setSystemTime(NOW);
    await hit(3, { cookie: ada.get() });
    await hit(2, { authorization: `Bearer ${key.key}` });
    await hit(1);
    t.usage.deny({ kind: 'key', keyId: key.id, userId: adaId, ip: '203.0.113.5' }, 'me');

    const series = await kit.json<Series>(await kit.call(root, 'GET', '/api/admin/usage?days=7'));
    expect(series.today).toBe(TODAY);
    expect(series.days.map(d => d.day)).toHaveLength(7);
    expect(series.days.at(-1)).toEqual({ day: TODAY, requests: 7, denied: 1, groups: { me: { requests: 6, denied: 1 }, keys: { requests: 1, denied: 0 } } });
    expect(series.days.at(-2)).toEqual({ day: YESTERDAY, requests: 3, denied: 0, groups: { me: { requests: 3, denied: 0 } } });
    expect(series.days.slice(0, -2).every(d => d.requests === 0 && d.denied === 0)).toBe(true);
    expect(series.groups).toEqual(['me', 'keys']);

    const top = await kit.json<Top>(await kit.call(root, 'GET', '/api/admin/usage/top'));
    expect(top.day).toBe(TODAY);
    expect(top.consumers.map(c => [c.subjectType, c.email, c.keyPrefix, c.requests, c.denied, c.groups])).toEqual([
      ['user', USER.email, null, 4, 0, { me: 3, keys: 1 }],
      ['user', USER.email, key.prefix, 2, 1, { me: 2 }],
      ['anon', null, null, 1, 0, { me: 1 }],
    ]);
    expect(top.consumers[0].subjectId).toBe(adaId);

    const before = await kit.json<Top>(await kit.call(root, 'GET', `/api/admin/usage/top?day=${YESTERDAY}`));
    expect(before.consumers.map(c => [c.subjectType, c.requests])).toEqual([['anon', 2], ['user', 1]]);
    // The admin's own calls aren't metered: only /api/v1 is.
    expect((await kit.json<Series>(await kit.call(root, 'GET', '/api/admin/usage?days=1'))).days[0].requests).toBe(7);

    for (const query of ['/top?day=12-10-2026', '?days=0', '?days=365']) {
      expect((await kit.call(root, 'GET', `/api/admin/usage${query}`)).status).toBe(400);
    }
  });
});
