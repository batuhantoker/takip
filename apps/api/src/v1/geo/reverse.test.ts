import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { startApp, type TestApp } from '../../testing/helpers';
import { legacyGet } from '../testing/legacy';
import { run } from '../testing/observe';

const { upstream, fails } = await vi.hoisted(() => import('../testing/upstream'));
vi.mock('@takip/connectors/http-json', async importActual => ({
  ...(await importActual<typeof import('@takip/connectors/http-json')>()),
  httpJson: upstream.httpJson,
}));

const NOMINATIM = 'https://nominatim.openstreetmap.org/reverse';
const CACHED = 'public, s-maxage=2592000, max-age=86400, stale-while-revalidate=86400';
const ATTRIBUTION = '© OpenStreetMap contributors';
const PARIS = { address: { city: 'Paris', state: 'Île-de-France', country: 'France' }, display_name: 'Paris, Île-de-France, France' };

let t: TestApp;
let legacy: (path: string) => Promise<Response>;

beforeAll(async () => {
  t = await startApp();
  legacy = await legacyGet('@/app/api/geo/reverse/route');
});
afterAll(() => t.close());
beforeEach(() => upstream.reset());

async function check(...queries: string[]) {
  const v1 = await run(queries.map(q => `/api/v1/geo/reverse${q}`), path => t.app.request(path));
  const old = await run(queries.map(q => `/api/geo/reverse${q}`), legacy);
  expect(v1).toEqual(old);
  return v1;
}

describe('GET /api/v1/geo/reverse', () => {
  it('refuses a missing, unreadable or out-of-range coordinate', async () => {
    const answers = await check('', '?lat=48.85', '?lng=2.29', '?lat=abc&lng=2.29', '?lat=91&lng=0', '?lat=0&lng=-181');
    for (const res of answers) {
      expect(res).toEqual({ status: 400, type: 'application/json', cache: null, body: { error: 'lat and lng required' }, upstream: [] });
    }
  });

  it('names the tenth-of-a-degree cell around a point', async () => {
    upstream.on(NOMINATIM, () => PARIS);
    const [res] = await check('?lat=48.8584&lng=2.2945');
    expect(res).toEqual({
      status: 200,
      type: 'application/json',
      cache: CACHED,
      body: { label: 'Paris, Île-de-France, France', attribution: ATTRIBUTION },
      upstream: [`${NOMINATIM}?format=jsonv2&accept-language=en&lat=48.9&lon=2.3&zoom=10&addressdetails=1`],
    });
  });

  it('falls back through town, village and county, and region', async () => {
    upstream.on(NOMINATIM, () => ({ address: { town: 'Ely', region: 'East', country: 'UK' } }));
    const [res] = await check('?lat=52.4&lng=0.26');
    expect(res.body).toEqual({ label: 'Ely, East, UK', attribution: ATTRIBUTION });
  });

  it('answers a null label when there is no address or the lookup fails', async () => {
    upstream.on(`${NOMINATIM}?format=jsonv2&accept-language=en&lat=0.0`, () => ({}));
    upstream.on(`${NOMINATIM}?format=jsonv2&accept-language=en&lat=10.0`, fails(429));
    const [sea, failed] = await check('?lat=0&lng=-30', '?lat=10&lng=10');
    for (const res of [sea, failed]) {
      expect(res).toMatchObject({ status: 200, cache: CACHED, body: { label: null, attribution: ATTRIBUTION } });
      expect(res.upstream).toHaveLength(1);
    }
  });

  it('answers a nearby point in the same cell from the cache', async () => {
    upstream.on(NOMINATIM, () => PARIS);
    const [first, nearby] = await check('?lat=48.8584&lng=2.2945', '?lat=48.87&lng=2.31');
    expect(first.upstream).toHaveLength(1);
    expect(nearby.upstream).toEqual([]);
    expect(nearby.body).toEqual(first.body);
  });

  it('reads a repeated parameter as its first value', async () => {
    upstream.on(NOMINATIM, () => PARIS);
    const [res] = await check('?lat=48.8584&lat=10&lng=2.2945');
    expect(res.upstream).toEqual([`${NOMINATIM}?format=jsonv2&accept-language=en&lat=48.9&lon=2.3&zoom=10&addressdetails=1`]);
  });
});
