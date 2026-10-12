import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { startApp, type TestApp } from '../../testing/helpers';
import { legacyGet } from '../testing/legacy';
import { run } from '../testing/observe';

const { upstream, fails } = await vi.hoisted(() => import('../testing/upstream'));

// Host names resolve here, so the SSRF guard's own checks run.
const { dns } = vi.hoisted(() => ({
  dns: { 'internal.example.com': ['10.0.0.7'], 'rebind.example.com': ['93.184.216.34', '127.0.0.1'] } as Record<string, string[]>,
}));
vi.mock('node:dns/promises', async importActual => ({
  ...(await importActual<typeof import('node:dns/promises')>()),
  lookup: async (host: string) => (dns[host] ?? ['93.184.216.34']).map(address => ({ address, family: 4 })),
}));

const SEARCH = 'https://www.arcgis.com/sharing/rest/search';
const BASE = 'https://services1.arcgis.com/abc/ArcGIS/rest/services/Roads/FeatureServer';
const QUERY = 'where=1%3D1&geometryType=esriGeometryEnvelope&spatialRel=esriSpatialRelIntersects&inSR=4326&outSR=4326&outFields=*&returnGeometry=true&resultRecordCount=2000&f=geojson';
const BBOX = '-105,35,-94,42';
const SEARCH_CACHED = 'public, s-maxage=120, stale-while-revalidate=300';
const QUERY_CACHED = 'public, s-maxage=60, stale-while-revalidate=120';
const REFUSED = { error: 'service must be an https ArcGIS Feature Service layer URL' };

const CATALOGUE = {
  results: [
    { id: 'a1', title: 'Wildfire perimeters', url: `${BASE}/0`, snippet: 'Current perimeters', owner: 'nifc', numViews: 1200, extent: [[-125, 24], [-66, 50]], tags: ['fire'], type: 'Feature Service' },
    { id: 'b2', title: 'Untagged', url: null, snippet: null, owner: 'someone', extent: [] },
  ],
};
const MATCHES = [
  { id: 'a1', title: 'Wildfire perimeters', url: `${BASE}/0`, snippet: 'Current perimeters', owner: 'nifc', numViews: 1200, extent: [[-125, 24], [-66, 50]], tags: ['fire'] },
  { id: 'b2', title: 'Untagged', url: null, snippet: '', owner: 'someone', numViews: 0, extent: [], tags: [] },
];
const FEATURES = {
  type: 'FeatureCollection',
  features: [{ type: 'Feature', id: 1, geometry: { type: 'Point', coordinates: [-100, 38] }, properties: { NAME: 'Road 1' } }],
};
const timeout = () => {
  throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
};

let t: TestApp;
let legacy: (path: string) => Promise<Response>;
let clock = Date.parse('2026-10-12T12:00:00Z');

beforeAll(async () => {
  t = await startApp();
  legacy = await legacyGet('@/app/api/arcgis/route');
  vi.stubGlobal('fetch', upstream.fetch);
  // Frozen, so neither limiter refills or resets while a test runs.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(clock);
});
afterAll(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  return t.close();
});
beforeEach(() => upstream.reset());

async function check(...queries: string[]) {
  const v1 = await run(queries.map(q => `/api/v1/arcgis${q}`), path => t.app.request(path));
  const old = await run(queries.map(q => `/api/arcgis${q}`), legacy);
  expect(v1).toEqual(old);
  return v1;
}
const service = (url: string, bbox?: string) => `?service=${encodeURIComponent(url)}${bbox ? `&bbox=${bbox}` : ''}`;

describe('GET /api/v1/arcgis', () => {
  it('asks for q or service', async () => {
    const answers = await check('', '?q=', '?service=', '?bbox=1,2,3,4');
    for (const res of answers) {
      expect(res).toEqual({ status: 400, type: 'application/json', cache: null, body: { error: 'Provide ?q=keyword or ?service=URL' }, upstream: [] });
    }
  });

  describe('catalogue search', () => {
    it('searches public Feature Services, inside bbox, and trims each match', async () => {
      upstream.on(SEARCH, () => CATALOGUE);
      const [res, plain] = await check(`?q=wild+fire&bbox=${BBOX}&service=${encodeURIComponent(`${BASE}/0`)}`, '?q=roads');
      expect(res).toEqual({
        status: 200,
        type: 'application/json',
        cache: SEARCH_CACHED,
        body: { results: MATCHES },
        upstream: [`${SEARCH}?q=wild+fire&type=Feature+Service&filter=access%3Apublic&num=20&f=json&bbox=-105%2C35%2C-94%2C42`],
      });
      expect(plain.upstream).toEqual([`${SEARCH}?q=roads&type=Feature+Service&filter=access%3Apublic&num=20&f=json`]);
    });

    it("passes ArcGIS's error status through, and answers 502 for an error in the body", async () => {
      upstream.on(`${SEARCH}?q=down`, fails(503));
      upstream.on(`${SEARCH}?q=bad`, () => ({ error: { code: 400, message: "'q' parameter is invalid" } }));
      upstream.on(`${SEARCH}?q=vague`, () => ({ error: {} }));
      const [down, bad, vague] = await check('?q=down', '?q=bad', '?q=vague');
      expect(down).toMatchObject({ status: 503, cache: null, body: { error: 'ArcGIS search failed (503)' } });
      expect(bad).toMatchObject({ status: 502, body: { error: "'q' parameter is invalid" } });
      expect(vague).toMatchObject({ status: 502, body: { error: 'ArcGIS error' } });
    });

    it('retries once when the request fails, then answers 504 on a timeout and 500 otherwise', async () => {
      let flaky = 0;
      upstream.on(`${SEARCH}?q=flaky`, () => {
        if (flaky++ % 2 === 0) throw new TypeError('fetch failed');
        return CATALOGUE;
      });
      upstream.on(`${SEARCH}?q=slow`, timeout);
      upstream.on(`${SEARCH}?q=gone`, () => {
        throw new TypeError('fetch failed');
      });
      const [recovered, slow, gone] = await check('?q=flaky', '?q=slow', '?q=gone');
      expect(recovered).toMatchObject({ status: 200, body: { results: MATCHES } });
      expect(recovered.upstream).toHaveLength(2);
      expect(slow).toMatchObject({ status: 504, body: { error: 'ArcGIS search timed out' } });
      expect(slow.upstream).toHaveLength(2);
      expect(gone).toMatchObject({ status: 500, body: { error: 'fetch failed' } });
    });
  });

  describe('feature service', () => {
    it('refuses anything but an https ArcGIS REST service on a host name, before any request', async () => {
      const answers = await check(
        ...[
          'http://127.0.0.1/internal-status',
          'https://127.0.0.1/rest/services/x/FeatureServer/0',
          'http://169.254.169.254/latest/meta-data/',
          'https://[::1]/rest/services/x/FeatureServer/0',
          'https://10.0.0.5/rest/services/x/FeatureServer/0',
          'http://127.0.0.1:8080/internal-status#',
          'https://evil.example.com/internal#/rest/services/x/FeatureServer/0/query',
          'https://evil.example.com/rest/of/the/owl',
          'http://services1.arcgis.com/abc/ArcGIS/rest/services/Roads/FeatureServer/0',
          'file:///etc/passwd',
          'not a url at all',
        ].map(url => service(url)),
      );
      for (const res of answers) expect(res).toEqual({ status: 403, type: 'application/json', cache: null, body: REFUSED, upstream: [] });
    });

    it('names an imagery or tile service rather than calling it a bad URL', async () => {
      const [image] = await check(service('https://imagery.example.gov/arcgis/rest/services/Landsat/ImageServer/0'));
      expect(image).toEqual({
        status: 422, type: 'application/json', cache: null,
        body: { error: 'This is an ArcGIS ImageServer — it serves imagery or tiles rather than map features, so there is nothing to import.' },
        upstream: [],
      });
    });

    it('reads the named layer as GeoJSON, inside bbox, dropping whatever the caller hung off the URL', async () => {
      upstream.on(`${BASE}/3/query?`, () => FEATURES);
      const [res, plain] = await check(service(`${BASE}/3/query?f=html&token=stolen#frag`, BBOX), service(`${BASE}/3`));
      expect(res).toEqual({
        status: 200,
        type: 'application/json',
        cache: QUERY_CACHED,
        body: FEATURES,
        upstream: [`${BASE}/3/query?${QUERY}&geometry=-105%2C35%2C-94%2C42`],
      });
      expect(plain.upstream).toEqual([`${BASE}/3/query?${QUERY}`]);
    });

    it('asks a service root for its first layer that holds features, and remembers the answer', async () => {
      upstream.on(`${BASE}?f=json`, () => ({
        capabilities: 'Query,Map',
        layers: [{ id: 15, name: 'Group', subLayerIds: [16] }, { id: 16, name: 'Parcels', subLayerIds: null }],
      }));
      upstream.on(`${BASE}/16/query?`, () => FEATURES);
      const [first, again] = await check(service(BASE), service(`${BASE}/`));
      expect(first).toMatchObject({ status: 200, body: FEATURES, upstream: [`${BASE}?f=json`, `${BASE}/16/query?${QUERY}`] });
      expect(again.upstream).toEqual([`${BASE}/16/query?${QUERY}`]);
    });

    it('falls back to layer 0 when the description lists none', async () => {
      upstream.on(`${BASE}?f=json`, () => ({}));
      upstream.on(`${BASE}/0/query?`, () => FEATURES);
      const [res] = await check(service(BASE));
      expect(res.upstream).toEqual([`${BASE}?f=json`, `${BASE}/0/query?${QUERY}`]);
    });

    it('says why a service root cannot be read', async () => {
      const tiles = 'https://tiles.example.gov/arcgis/rest/services/Basemap/MapServer';
      const token = 'https://token.example.gov/arcgis/rest/services/Private/FeatureServer';
      const missing = 'https://missing.example.gov/arcgis/rest/services/Gone/FeatureServer';
      upstream.on(`${tiles}?f=json`, () => ({ capabilities: 'Map,TilesOnly,Tilemap', layers: [{ id: 0 }] }));
      upstream.on(`${token}?f=json`, () => ({ error: { code: 499, message: 'Token Required for subscription content' } }));
      upstream.on(`${missing}?f=json`, fails(404));
      const [tiled, tokened, gone] = await check(service(tiles), service(token), service(missing));
      expect(tiled).toEqual({
        status: 422, type: 'application/json', cache: null,
        body: { error: 'This service publishes map tiles only, so it has no features to import.' },
        upstream: [`${tiles}?f=json`],
      });
      expect(tokened).toMatchObject({ status: 422, body: { error: 'The service refused the request: Token Required for subscription content' } });
      expect(gone).toMatchObject({ status: 502, body: { error: 'Service description unavailable (404)' } });
    });

    it("passes the layer's error status through, and answers 502 for an error in the body and 504 on a timeout", async () => {
      upstream.on(`${BASE}/1/query?`, fails(404));
      upstream.on(`${BASE}/2/query?`, () => ({ error: { code: 400, message: 'Invalid or missing input parameters.' } }));
      upstream.on(`${BASE}/4/query?`, timeout);
      upstream.on(`${BASE}/5/query?`, () => {
        throw new TypeError('fetch failed');
      });
      const [missing, invalid, slow, failed] = await check(service(`${BASE}/1`), service(`${BASE}/2`), service(`${BASE}/4`), service(`${BASE}/5`));
      expect(missing).toMatchObject({ status: 404, cache: null, body: { error: 'Feature Service query failed (404)' } });
      expect(invalid).toMatchObject({ status: 502, body: { error: 'Invalid or missing input parameters.' } });
      expect(slow).toMatchObject({ status: 504, body: { error: 'Feature Service query timed out' } });
      expect(failed).toMatchObject({ status: 500, body: { error: 'fetch failed' } });
    });

    it('refuses a host that resolves, or redirects, into a private network', async () => {
      const internal = 'https://internal.example.com/arcgis/rest/services/Secrets/FeatureServer';
      const rebind = 'https://rebind.example.com/arcgis/rest/services/Secrets/FeatureServer';
      upstream.on(`${BASE}/7/query?`, () => new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data/' } }));
      const [direct, mixed, redirected, described] = await check(service(`${internal}/0`), service(`${rebind}/0`), service(`${BASE}/7`), service(internal));
      for (const res of [direct, mixed]) expect(res).toEqual({ status: 403, type: 'application/json', cache: null, body: { error: 'Forbidden target' }, upstream: [] });
      expect(redirected).toEqual({ status: 403, type: 'application/json', cache: null, body: { error: 'Forbidden target' }, upstream: [`${BASE}/7/query?${QUERY}`] });
      // Discovery reports its own failures; it never fetched either.
      expect(described).toMatchObject({ status: 502, body: { error: 'Service description unavailable' }, upstream: [] });
    });

    it('refuses a caller after thirty service reads in a minute; searches and refused URLs do not count', async () => {
      clock += 2 * 60_000;
      vi.setSystemTime(clock);
      upstream.on(SEARCH, () => CATALOGUE);
      upstream.on(`${BASE}/0/query?`, () => FEATURES);
      const answers = await check(
        ...Array.from({ length: 29 }, () => service(`${BASE}/0`)),
        '?q=roads',
        service('https://evil.example.com/'),
        service(`${BASE}/0`),
        service(`${BASE}/0`),
      );
      expect(answers.slice(0, 29).every(res => res.status === 200)).toBe(true);
      expect(answers.slice(29).map(res => res.status)).toEqual([200, 403, 200, 429]);
      expect(answers[32]).toEqual({ status: 429, type: 'application/json', cache: null, body: { error: 'Rate limit exceeded' }, upstream: [] });
    });
  });
});
