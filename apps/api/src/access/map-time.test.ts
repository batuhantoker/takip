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
const call = async (method: 'GET' | 'POST', { jar, peer = '203.0.113.5', headers = {}, features, opening }: { jar?: Jar; peer?: string; headers?: Record<string, string>; features?: unknown; opening?: boolean } = {}) => {
  const body = features === undefined && opening === undefined ? undefined : JSON.stringify({ features, opening });
  const res = await t.app.request('/api/v1/me/time', { method, body, headers: { ...headers, ...(jar && { cookie: jar.get() }), ...(body && { 'content-type': 'application/json' }) } }, from(peer));
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

  it('starts again at UTC midnight and keeps the old days for analytics', async () => {
    setLimit('anon', 1);
    expect(await call('POST')).toMatchObject({ blocked: true });
    vi.setSystemTime(new Date('2026-10-17T00:00:05.000Z'));
    expect(await call('GET')).toMatchObject({ used: 0, blocked: false, resetsAt: '2026-10-18T00:00:00.000Z' });
    expect(t.db.prepare('SELECT count(*) FROM map_time').pluck().get()).toBe(1);
  });

  it('has no limit at 0 but still counts the minutes, and never counts API keys', async () => {
    const jar = await t.signUpVerified();
    const userId = (await t.session(jar.get()))!.user.id;
    grantPlan(t.db, { userId, planId: 'pro', actor: OPERATOR });
    t.access.invalidate();
    expect(await call('POST', { jar })).toEqual({ limit: 0, used: 1, remaining: 0, blocked: false, resetsAt: '2026-10-17T00:00:00.000Z' });

    const created = await t.app.request('/api/v1/keys', {
      method: 'POST',
      headers: { cookie: jar.get(), 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'script' }),
    });
    const { key } = (await created.json()) as { key: string };
    expect(await call('POST', { headers: { authorization: `Bearer ${key}` } })).toMatchObject({ limit: 0, blocked: false });
    expect(t.db.prepare('SELECT subject_type AS type, minutes FROM map_time').all()).toEqual([{ type: 'user', minutes: 1 }]);
  });
});

describe('where the minutes go', () => {
  const features = () => t.db.prepare('SELECT feature, minutes FROM feature_time ORDER BY feature').all();

  it('books each counted minute to the features the tick reports and to its UTC hour', async () => {
    await call('POST', { features: ['view:map', 'panel:layers', 'layer:flights', 'device:desktop'] });
    await call('POST', { features: ['view:map', 'panel:alerts'] });
    later(MINUTE);
    await call('POST', { features: ['view:history', 'panel:history'] });
    expect(features()).toEqual([
      { feature: 'device:desktop', minutes: 1 },
      { feature: 'layer:flights', minutes: 1 },
      { feature: 'panel:history', minutes: 1 },
      { feature: 'panel:layers', minutes: 1 },
      { feature: 'view:history', minutes: 1 },
      { feature: 'view:map', minutes: 1 },
    ]);
    expect(t.db.prepare('SELECT hour, subject_type AS type, minutes FROM activity_hour').all()).toEqual([{ hour: 10, type: 'anon', minutes: 2 }]);
  });

  it('drops features it does not know, and counts the minute without them', async () => {
    const junk = ['view:wall', 'panel:admin', 'layer:Flights', 'layer:a:b', 'device', 42, 'x'.repeat(500), 'window:camera'];
    expect(await call('POST', { features: junk })).toMatchObject({ used: 1 });
    expect(await call('GET')).toMatchObject({ used: 1 });
    expect(features()).toEqual([{ feature: 'window:camera', minutes: 1 }]);
    later(MINUTE);
    expect(await call('POST', { features: 'view:map' })).toMatchObject({ used: 2 });
  });

  it('books an account\'s minutes to its own hours', async () => {
    const jar = await t.signUpVerified();
    await call('POST', { jar, features: ['view:map'] });
    later(MINUTE);
    await call('POST', { jar, features: ['view:map'] });
    expect(t.db.prepare('SELECT hour, minutes FROM user_hour').all()).toEqual([{ hour: 10, minutes: 2 }]);
  });

  it('counts the minute a map opens in, but charges only the ticks after', async () => {
    const minutes = () => t.db.prepare('SELECT minutes, charged FROM map_time').get();
    expect(await call('POST', { opening: true, features: ['view:map'] })).toMatchObject({ used: 0 });
    expect(minutes()).toEqual({ minutes: 1, charged: 0 });
    later(55_000);
    expect(await call('POST', { features: ['view:map'] })).toMatchObject({ used: 1 });
    later(60_000);
    expect(await call('POST', { features: ['view:map'] })).toMatchObject({ used: 2 });
    expect(minutes()).toEqual({ minutes: 3, charged: 2 });
    expect(t.db.prepare('SELECT sum(minutes) FROM activity_hour').pluck().get()).toBe(3);
    expect(features()).toEqual([{ feature: 'view:map', minutes: 3 }]);
  });

  it('books one minute when a second tab opens the map within it', async () => {
    const jar = await t.signUpVerified();
    await call('POST', { jar, features: ['view:map'] });
    later(20_000);
    expect(await call('POST', { jar, opening: true, features: ['view:map'] })).toMatchObject({ used: 1 });
    later(40_000);
    expect(await call('POST', { jar, features: ['view:map'] })).toMatchObject({ used: 2 });
    expect(t.db.prepare('SELECT minutes, charged FROM map_time').get()).toEqual({ minutes: 2, charged: 2 });
    expect(t.db.prepare('SELECT sum(minutes) FROM user_hour').pluck().get()).toBe(2);
  });

  it('books the opening behind the wall as view:wall', async () => {
    setLimit('anon', 1);
    await call('POST', { features: ['view:map'] });
    later(MINUTE);
    expect(await call('POST', { opening: true, features: ['view:map'] })).toMatchObject({ used: 1, blocked: true });
    expect(features()).toEqual([{ feature: 'view:map', minutes: 1 }, { feature: 'view:wall', minutes: 1 }]);
    expect(t.db.prepare('SELECT minutes, charged FROM map_time').get()).toEqual({ minutes: 1, charged: 1 });
  });

  it('books minutes behind the wall as view:wall, not as map time', async () => {
    setLimit('anon', 1);
    await call('POST', { features: ['view:map'] });
    later(MINUTE);
    expect(await call('POST', { features: ['view:map'] })).toMatchObject({ used: 1, blocked: true });
    await call('POST', { features: ['view:map'] });
    expect(features()).toEqual([{ feature: 'view:map', minutes: 1 }, { feature: 'view:wall', minutes: 1 }]);
    expect(t.db.prepare('SELECT sum(minutes) FROM activity_hour').pluck().get()).toBe(1);
  });
});

describe('visitors across days', () => {
  const ID = 'visitor-0123456789abcdef';
  const visitor = (extra: object = {}) => ({ id: ID, ...extra });
  const row = () => t.db.prepare('SELECT * FROM visitor WHERE visitor_id = ?').get(ID) as Record<string, unknown> | undefined;
  const days = () => t.db.prepare('SELECT day, minutes FROM visitor_day WHERE visitor_id = ? ORDER BY day').all(ID);
  const tick = (opts: { peer?: string; features?: unknown; jar?: Jar; visitorBody?: unknown } = {}) =>
    t.app.request('/api/v1/me/time', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'Mozilla/5.0 (Macintosh) Chrome/141.0', ...(opts.jar && { cookie: opts.jar.get() }) },
      body: JSON.stringify({ features: opts.features ?? ['view:map'], visitor: opts.visitorBody ?? visitor() }),
    }, from(opts.peer ?? '203.0.113.5'));

  it('keeps one visitor across days, with how they first arrived', async () => {
    await tick({ visitorBody: visitor({ referrer: 'News.Example.com', landing: '/?utm_source=hn&token=secret&w=abc' }) });
    vi.setSystemTime(new Date('2026-10-17T09:00:00.000Z'));
    await tick({ visitorBody: visitor({ referrer: 'other.example', landing: '/docs' }) });
    expect(days()).toEqual([{ day: 20742, minutes: 1 }, { day: 20743, minutes: 1 }]);
    expect(row()).toMatchObject({
      first_seen_at: Date.parse('2026-10-16T10:00:00.000Z'), last_seen_at: Date.parse('2026-10-17T09:00:00.000Z'),
      referrer: 'news.example.com', landing: '/?utm_source=hn&w=abc', user_agent: 'Mozilla/5.0 (Macintosh) Chrome/141.0', user_id: null,
    });
    expect(t.db.prepare('SELECT feature, minutes FROM visitor_feature ORDER BY day').all()).toEqual([
      { feature: 'view:map', minutes: 1 }, { feature: 'view:map', minutes: 1 },
    ]);
    expect(t.db.prepare('SELECT hour FROM visitor_hour ORDER BY day').pluck().all()).toEqual([10, 9]);
  });

  it('counts two visitors behind one address block apart, but limits them together', async () => {
    setLimit('anon', 1);
    await tick();
    await tick({ visitorBody: { id: 'another-visitor-0000000' } });
    expect(t.db.prepare('SELECT visitor_id AS id, minutes FROM visitor_day ORDER BY visitor_id').all()).toEqual([
      { id: 'another-visitor-0000000', minutes: 0 },
      { id: ID, minutes: 1 },
    ]);
    expect(t.db.prepare("SELECT visitor_id FROM visitor_feature WHERE feature = 'view:wall'").pluck().all()).toEqual(['another-visitor-0000000']);
  });

  it('books the opening to the visitor too', async () => {
    const res = await t.app.request('/api/v1/me/time', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ opening: true, visitor: visitor() }),
    }, from('203.0.113.5'));
    expect(await res.json()).toMatchObject({ used: 0 });
    expect(days()).toEqual([{ day: 20742, minutes: 1 }]);
    expect(t.db.prepare('SELECT hour, minutes FROM visitor_hour').all()).toEqual([{ hour: 10, minutes: 1 }]);
  });

  it('links the browser to the account that signs in on it, without booking minutes there', async () => {
    await tick();
    const jar = await t.signUpVerified();
    const userId = (await t.session(jar.get()))!.user.id;
    later(MINUTE);
    await tick({ jar });
    expect(row()).toMatchObject({ user_id: userId, linked_at: Date.now() });
    expect(days()).toEqual([{ day: 20742, minutes: 1 }]);
  });

  it('ignores ids it cannot trust', async () => {
    for (const id of ['short', 'has spaces in it at all', 'x'.repeat(65), 42]) await tick({ visitorBody: { id } });
    expect(t.db.prepare('SELECT count(*) FROM visitor').pluck().get()).toBe(0);
    expect(await call('GET')).toMatchObject({ used: 1 });
  });
});

describe('sections, actions and places', () => {
  const ID = 'visitor-0123456789abcdef';
  const post = (path: string, body: object, { jar, peer = '203.0.113.5' }: { jar?: Jar; peer?: string } = {}) =>
    t.app.request(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(jar && { cookie: jar.get() }) },
      body: JSON.stringify(body),
    }, from(peer));
  const actions = () => t.db.prepare('SELECT subject_type AS type, action, count FROM action_count ORDER BY subject_type, action').all();

  it('books the Layers sections in use like any feature', async () => {
    await post('/api/v1/me/time', { features: ['section:air', 'section:sea', 'section:cooking', 'layer:flights'] });
    expect(t.db.prepare("SELECT feature FROM feature_time WHERE feature LIKE 'section:%' ORDER BY feature").pluck().all()).toEqual(['section:air', 'section:sea']);
  });

  it('counts actions on every tick, for the account, else the visitor id, else the day\'s address hash', async () => {
    await post('/api/v1/me/time', { actions: { 'search.run': 2, 'route.plan': 1, 'made.up': 3, 'ti.ask': -1, 'alert.open': 1.5 } });
    await post('/api/v1/me/time', { actions: { 'search.run': 1 }, visitor: { id: ID } });
    const jar = await t.signUpVerified();
    await post('/api/v1/me/time', { actions: { 'camera.open': 9999 } }, { jar });
    expect(actions()).toEqual([
      { type: 'anon', action: 'route.plan', count: 1 },
      { type: 'anon', action: 'search.run', count: 2 },
      { type: 'user', action: 'camera.open', count: 500 },
      { type: 'visitor', action: 'search.run', count: 1 },
    ]);
  });

  it('takes the actions a closing page still holds, without a minute', async () => {
    const res = await post('/api/v1/me/actions', { actions: { 'layer.on': 3 }, visitor: { id: ID } });
    expect(res.status).toBe(204);
    expect(actions()).toEqual([{ type: 'visitor', action: 'layer.on', count: 3 }]);
    expect(t.db.prepare('SELECT count(*) FROM map_time').pluck().get()).toBe(0);
  });

  it('notes a shared location for the account or the visitor id, on every tick and on the closing flush, never for a bare visitor', async () => {
    const fix = { lat: 39.920772, lon: 32.85411, accuracy: 20 };
    await post('/api/v1/me/time', { device: fix });
    await post('/api/v1/me/time', { device: fix, visitor: { id: ID } });
    await post('/api/v1/me/time', { device: fix, visitor: { id: ID } });
    const jar = await t.signUpVerified();
    await post('/api/v1/me/actions', { device: { lat: 41.0082, lon: 28.9784, accuracy: 15 } }, { jar });
    expect(t.db.prepare('SELECT subject_type AS type, latitude, fixes FROM device_place ORDER BY subject_type').all()).toEqual([
      { type: 'user', latitude: 41.0082, fixes: 1 },
      { type: 'visitor', latitude: 39.920772, fixes: 2 },
    ]);
  });

  it('notes the address each booked minute came from, for the visitor and for the account', async () => {
    await post('/api/v1/me/time', { visitor: { id: ID } });
    await post('/api/v1/me/time', { visitor: { id: ID } });
    later(MINUTE);
    await post('/api/v1/me/time', { visitor: { id: ID } }, { peer: '198.51.100.7' });
    const jar = await t.signUpVerified();
    await post('/api/v1/me/time', {}, { jar });
    expect(t.db.prepare('SELECT subject_type AS type, ip, minutes FROM place_seen ORDER BY subject_type, ip').all()).toEqual([
      { type: 'user', ip: '203.0.113.5', minutes: 1 },
      { type: 'visitor', ip: '198.51.100.7', minutes: 1 },
      { type: 'visitor', ip: '203.0.113.5', minutes: 1 },
    ]);
  });
});
