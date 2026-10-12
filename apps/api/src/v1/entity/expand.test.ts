import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { startApp, type TestApp } from '../../testing/helpers';
import { run } from '../testing/observe';

const { upstream, fails } = await vi.hoisted(async () => {
  process.env.INTEL_URL = 'http://intel.test:4000';
  return import('../testing/upstream');
});

const RESOLVE = 'http://intel.test:4000/resolve';
const CACHED = 'public, s-maxage=3600, stale-while-revalidate=7200';
const GRAPH = {
  nodes: [
    { id: 'aircraft:N381DN', label: 'N381DN', type: 'aircraft', properties: { source: 'ADS-B' } },
    { id: 'company:DAL', label: 'Delta Air Lines', type: 'company', properties: { icao_code: 'DAL', source: 'Wikidata' } },
  ],
  links: [{ source: 'aircraft:N381DN', target: 'company:DAL', label: 'OPERATED BY' }],
  entity: { type: 'aircraft', id: 'N381DN' },
  source: 'TAKIP Intelligence Layer',
  sanctions_index_size: 18000,
  wikidata_cache_hits: 3,
  timestamp: '2026-10-12T12:00:00.000Z',
};

let t: TestApp;
let clock = Date.parse('2026-10-12T12:00:00Z');

beforeAll(async () => {
  t = await startApp();
  vi.stubGlobal('fetch', upstream.fetch);
  // Frozen, so the limiter neither refills nor resets while a test runs.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(clock);
});
afterAll(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  return t.close();
});
beforeEach(() => upstream.reset());

/** Sends each query in turn from cold server-side caches. */
const check = (...queries: string[]) => run(queries.map(q => `/api/v1/entity/expand${q}`), path => t.app.request(path));

describe('GET /api/v1/entity/expand', () => {
  it('refuses an unknown type or an id outside 2 to 200 characters, without asking the service', async () => {
    const [none, ship, noId, short, long] = await check(
      '', '?type=ship&id=N381DN', '?type=aircraft', '?type=aircraft&id=%20a%20', `?type=aircraft&id=${'x'.repeat(201)}`,
    );
    const types = { error: 'Invalid type. Allowed: aircraft, vessel, company, person, ip, country' };
    expect(none).toEqual({ status: 400, type: 'application/json', cache: null, body: types, upstream: [] });
    expect(ship.body).toEqual(types);
    for (const res of [noId, short, long]) expect(res).toMatchObject({ status: 400, body: { error: 'Invalid id (2-200 chars)' }, upstream: [] });
  });

  it("forwards the entity and the aircraft hints, with the caller's address, and passes the graph back", async () => {
    const forwardedFor: (string | null)[] = [];
    upstream.on(RESOLVE, (_url, init) => {
      forwardedFor.push(new Headers(init?.headers).get('x-forwarded-for'));
      return GRAPH;
    });
    const [res] = await check('?type=Aircraft%20&id=%20N381DN%20&registration=N381DN&model=B739&icao24=ae291a&depth=9');
    expect(res).toEqual({
      status: 200,
      type: 'application/json',
      cache: CACHED,
      body: GRAPH,
      upstream: [`${RESOLVE}?type=aircraft&id=N381DN&registration=N381DN&model=B739&icao24=ae291a`],
    });
    expect(forwardedFor).toEqual(['unknown']);
  });

  it("passes the service's own error status through", async () => {
    upstream.on(`${RESOLVE}?type=company`, () => new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429 }));
    upstream.on(`${RESOLVE}?type=person`, fails(500));
    upstream.on(`${RESOLVE}?type=country`, () => new Response(JSON.stringify({ error: 'ID contains too many invalid characters' }), { status: 400 }));
    const [limited, broken, invalid] = await check('?type=company&id=Acme', '?type=person&id=Ada', '?type=country&id=%3C%3E');
    expect(limited).toEqual({ status: 429, type: 'application/json', cache: null, body: { error: 'Rate limit exceeded', nodes: [], links: [] }, upstream: [`${RESOLVE}?type=company&id=Acme`] });
    expect(broken).toMatchObject({ status: 500, body: { error: 'Intel layer returned 500', nodes: [], links: [] } });
    expect(invalid).toMatchObject({ status: 400, body: { error: 'ID contains too many invalid characters', nodes: [], links: [] } });
  });

  it('answers 502 when the service cannot be reached', async () => {
    upstream.on(RESOLVE, () => {
      throw new TypeError('fetch failed');
    });
    const [res] = await check('?type=ip&id=203.0.113.9');
    expect(res).toEqual({
      status: 502, type: 'application/json', cache: null,
      body: { error: 'Intelligence layer unavailable', nodes: [], links: [] },
      upstream: [`${RESOLVE}?type=ip&id=203.0.113.9`],
    });
  });

  it('refuses a caller after thirty requests in a minute, invalid ones included', async () => {
    clock += 2 * 60_000;
    vi.setSystemTime(clock);
    upstream.on(RESOLVE, () => GRAPH);
    const answers = await check(...Array.from({ length: 29 }, () => '?type=vessel&id=IMO9811000'), '?type=ship&id=x', '?type=vessel&id=IMO9811000');
    expect(answers.slice(0, 29).every(res => res.status === 200)).toBe(true);
    expect(answers[29].status).toBe(400);
    expect(answers[30]).toEqual({ status: 429, type: 'application/json', cache: null, body: { error: 'Rate limit exceeded' }, upstream: [] });
  });

  it('keeps a separate allowance for each signed-in account', async () => {
    clock += 2 * 60_000;
    vi.setSystemTime(clock);
    upstream.on(RESOLVE, () => GRAPH);
    const jar = await t.signUpVerified();
    const anon = () => t.app.request('/api/v1/entity/expand?type=vessel&id=IMO9811000');
    for (let i = 0; i < 30; i++) expect((await anon()).status).toBe(200);
    expect((await anon()).status).toBe(429);
    const signedIn = await t.app.request('/api/v1/entity/expand?type=vessel&id=IMO9811000', { headers: { cookie: jar.get() } });
    expect(signedIn.status).toBe(200);
  });
});
