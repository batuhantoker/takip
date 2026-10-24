import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { startApp, type TestApp } from '../../testing/helpers';
import { clearNominatimCache } from '@takip/connectors/nominatim';
import { run } from '../testing/observe';

const { upstream, fails } = await vi.hoisted(() => import('../testing/upstream'));
vi.mock('@takip/connectors/http-json', async importActual => ({
  ...(await importActual<typeof import('@takip/connectors/http-json')>()),
  httpJson: upstream.httpJson,
}));
// The tests' gap between requests is 1 ms, so a busy queue is said rather than made.
const queue = vi.hoisted(() => ({ delayMs: 0 }));
vi.mock('@takip/connectors/nominatim', async importActual => ({
  ...(await importActual<typeof import('@takip/connectors/nominatim')>()),
  nominatimDelayMs: () => queue.delayMs,
}));

const NOMINATIM = 'https://nominatim.openstreetmap.org/reverse';
const CACHED = 'public, s-maxage=2592000, max-age=86400, stale-while-revalidate=86400';
const ATTRIBUTION = '© OpenStreetMap contributors';
const PARIS = { address: { city: 'Paris', state: 'Île-de-France', country: 'France' }, display_name: 'Paris, Île-de-France, France' };
// Open sea: out of every listed town's reach, so these go to Nominatim (whose answers are stubbed).
const SEA = '?lat=30.0123&lng=-44.9876';
const SEA_UPSTREAM = `${NOMINATIM}?format=jsonv2&accept-language=en&lat=30.0&lon=-45.0&zoom=10&addressdetails=1`;

let t: TestApp;

beforeAll(async () => {
  t = await startApp();
});
afterAll(() => t.close());
beforeEach(() => {
  upstream.reset();
  queue.delayMs = 0;
});

/** Sends each query in turn from cold server-side caches. */
const check = (...queries: string[]) => run(queries.map(q => `/api/v1/geo/reverse${q}`), path => t.app.request(path));

describe('GET /api/v1/geo/reverse', () => {
  it('refuses a missing, unreadable or out-of-range coordinate', async () => {
    const answers = await check('', '?lat=48.85', '?lng=2.29', '?lat=abc&lng=2.29', '?lat=91&lng=0', '?lat=0&lng=-181');
    for (const res of answers) {
      expect(res).toEqual({ status: 400, type: 'application/json', cache: null, body: { error: 'lat and lng required' }, upstream: [] });
    }
  });

  it('names a listed town whose reach holds the point without asking Nominatim', async () => {
    const [res] = await check('?lat=35.6895&lng=139.6917');
    expect(res).toEqual({
      status: 200,
      type: 'application/json',
      cache: CACHED,
      body: { label: 'Tokyo, Japan', attribution: 'GeoNames (CC BY 4.0)' },
      upstream: [],
    });
  });

  it('asks Nominatim for the tenth-of-a-degree cell around a point out of every town’s reach', async () => {
    upstream.on(NOMINATIM, () => PARIS);
    const [res] = await check(SEA);
    expect(res).toEqual({
      status: 200,
      type: 'application/json',
      cache: CACHED,
      body: { label: 'Paris, Île-de-France, France', attribution: ATTRIBUTION },
      upstream: [SEA_UPSTREAM],
    });
  });

  it('falls back through town, village and county, and region', async () => {
    upstream.on(NOMINATIM, () => ({ address: { town: 'Ely', region: 'East', country: 'UK' } }));
    const [res] = await check(SEA);
    expect(res.body).toEqual({ label: 'Ely, East, UK', attribution: ATTRIBUTION });
  });

  it('answers a null label when there is no address or the lookup fails, and caches only the answer', async () => {
    upstream.on(`${NOMINATIM}?format=jsonv2&accept-language=en&lat=0.0`, () => ({}));
    upstream.on(`${NOMINATIM}?format=jsonv2&accept-language=en&lat=10.0`, fails(429));
    const [sea, failed] = await check('?lat=0&lng=-30', '?lat=10&lng=10');
    for (const res of [sea, failed]) {
      expect(res).toMatchObject({ status: 200, body: { label: null, attribution: ATTRIBUTION } });
      expect(res.upstream).toHaveLength(1);
    }
    expect(sea.cache).toBe(CACHED);
    expect(failed.cache).toBe('no-store');
  });

  it('sends no-store for a failure remembered from an earlier lookup', async () => {
    upstream.on(NOMINATIM, fails(503));
    const [failed, again] = await check('?lat=10&lng=10', '?lat=10&lng=10');
    expect(failed.cache).toBe('no-store');
    expect(again).toMatchObject({ cache: 'no-store', body: { label: null }, upstream: [] });
  });

  it('answers a nearby point in the same cell from the cache', async () => {
    upstream.on(NOMINATIM, () => PARIS);
    const [first, nearby] = await check(SEA, '?lat=29.97&lng=-45.03');
    expect(first.upstream).toHaveLength(1);
    expect(nearby.upstream).toEqual([]);
    expect(nearby.body).toEqual(first.body);
  });

  it('answers at once behind a busy queue, saying when to ask again, and the queued lookup fills the cache', async () => {
    clearNominatimCache();
    queue.delayMs = 3_000;
    let release: (() => void) | undefined;
    upstream.on(NOMINATIM, () => new Promise(resolve => { release = () => resolve(PARIS); }));
    const res = await t.app.request(`/api/v1/geo/reverse${SEA}`);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('retry-after')).toBe('4');
    expect(await res.json()).toEqual({ label: null, attribution: ATTRIBUTION });

    await vi.waitFor(() => expect(release).toBeDefined());
    release!();
    await vi.waitFor(async () => {
      const again = await t.app.request(`/api/v1/geo/reverse${SEA}`);
      expect(await again.json()).toEqual({ label: 'Paris, Île-de-France, France', attribution: ATTRIBUTION });
    });
  });

  it('names a small town far from any big one without asking Nominatim', async () => {
    const [res] = await check('?lat=34.11&lng=-109.29');
    expect(res).toEqual({
      status: 200,
      type: 'application/json',
      cache: CACHED,
      body: { label: 'Eagar, Arizona, United States', attribution: 'GeoNames (CC BY 4.0)' },
      upstream: [],
    });
  });

  it('reads a repeated parameter as its first value', async () => {
    upstream.on(NOMINATIM, () => PARIS);
    const [res] = await check('?lat=30.0123&lat=10&lng=-44.9876');
    expect(res.upstream).toEqual([SEA_UPSTREAM]);
  });
});
