import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { startApp, type TestApp } from '../../testing/helpers';
import { run } from '../testing/observe';

const { upstream, fails } = await vi.hoisted(() => import('../testing/upstream'));
vi.mock('@takip/connectors/http-json', async importActual => ({
  ...(await importActual<typeof import('@takip/connectors/http-json')>()),
  httpJson: upstream.httpJson,
}));

const PHOTON = 'https://photon.komoot.io/api/';
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const CACHED = 'public, s-maxage=600, stale-while-revalidate=1800';

const feature = (name: string, lng: number, lat: number, properties: Record<string, string> = {}) => ({
  geometry: { coordinates: [lng, lat] },
  properties: { name, city: 'Paris', state: 'Île-de-France', country: 'France', osm_key: 'man_made', osm_value: 'tower', ...properties },
});
const EIFFEL = feature('Eiffel Tower', 2.2945, 48.8584, { street: 'Avenue Anatole France', housenumber: '5' });
const PHOTON_RICH = {
  features: [EIFFEL, feature('Eiffel Tower Restaurant', 2.2946, 48.8583, { osm_key: 'amenity', osm_value: 'restaurant' }), feature('Tour Eiffel', 2.29, 48.85)],
};
const HEATHROW_FL = { features: [feature('Heathrow', -81.37, 28.76, { city: 'Heathrow', state: 'Florida', country: 'United States', osm_key: 'place', osm_value: 'town' })] };
const NOMINATIM_ROWS = [
  { display_name: 'London Heathrow Airport, Hounslow, London, England, United Kingdom', lat: '51.47', lon: '-0.454', class: 'aeroway', type: 'aerodrome', importance: 0.606 },
  { display_name: 'Heathrow, Seminole County, Florida, United States', lat: '28.7600', lon: '-81.3700', class: 'place', type: 'town', name: 'Heathrow', importance: 0.352 },
  { display_name: 'No coordinates' },
];

let t: TestApp;

beforeAll(async () => {
  t = await startApp();
});
afterAll(() => t.close());
beforeEach(() => upstream.reset());

/** Sends each query in turn from cold server-side caches. */
const check = (...queries: string[]) => run(queries.map(q => `/api/v1/geo/search${q}`), path => t.app.request(path));

describe('GET /api/v1/geo/search', () => {
  it('answers fewer than two characters with nothing, without asking anyone', async () => {
    const [none, one, spaces] = await check('', '?q=a', '?q=%20a%20');
    for (const res of [none, one, spaces]) {
      expect(res).toEqual({ status: 200, type: 'application/json', cache: null, body: { results: [] }, upstream: [] });
    }
  });

  it('searches from two characters, trimmed', async () => {
    upstream.on(PHOTON, () => PHOTON_RICH);
    const [res] = await check('?q=%20pa%20');
    expect(res.upstream).toEqual([`${PHOTON}?q=pa&limit=8&lang=en`]);
  });

  it('asks only Photon when it finds enough, and caches the answer at the edge', async () => {
    upstream.on(PHOTON, () => PHOTON_RICH);
    const [res] = await check('?q=eiffel%20tow');
    expect(res.status).toBe(200);
    expect(res.cache).toBe(CACHED);
    expect(res.upstream).toEqual([`${PHOTON}?q=eiffel%20tow&limit=8&lang=en`]);
    expect((res.body as { results: unknown[] }).results[0]).toEqual({
      name: 'Eiffel Tower', context: 'Avenue Anatole France 5, Paris, Île-de-France',
      lat: 48.8584, lng: 2.2945, kind: 'poi', source: 'photon',
    });
  });

  it('biases toward lat/lng only when both are given', async () => {
    upstream.on(PHOTON, () => PHOTON_RICH);
    const [both, latOnly] = await check('?q=eiffel&lat=48.8566&lng=2.3522', '?q=eiffel&lat=48.8566');
    expect(both.upstream).toEqual([`${PHOTON}?q=eiffel&limit=8&lang=en&lat=48.8566&lon=2.3522`]);
    expect(latOnly.upstream).toEqual([`${PHOTON}?q=eiffel&limit=8&lang=en`]);
  });

  it('asks Nominatim when Photon is thin, and promotes a prominent hit', async () => {
    upstream.on(PHOTON, () => HEATHROW_FL);
    upstream.on(NOMINATIM, () => NOMINATIM_ROWS);
    const [res] = await check('?q=heathrow');
    expect(res.upstream).toEqual([
      `${PHOTON}?q=heathrow&limit=8&lang=en`,
      `${NOMINATIM}?format=jsonv2&accept-language=en&q=heathrow&limit=6&addressdetails=0`,
    ]);
    const names = (res.body as { results: { name: string; source: string }[] }).results.map(r => `${r.name}/${r.source}`);
    // The Florida town from Nominatim duplicates Photon's and is dropped.
    expect(names).toEqual(['London Heathrow Airport/nominatim', 'Heathrow/photon']);
  });

  it('falls back to Nominatim alone when Photon fails', async () => {
    upstream.on(PHOTON, fails(502));
    upstream.on(NOMINATIM, () => NOMINATIM_ROWS);
    const [res] = await check('?q=heathrow');
    expect(res.status).toBe(200);
    expect((res.body as { results: unknown[] }).results).toHaveLength(2);
  });

  it('answers an empty list when both fail', async () => {
    upstream.on(PHOTON, fails(502));
    upstream.on(NOMINATIM, fails(429));
    const [res] = await check('?q=heathrow');
    expect(res).toMatchObject({ status: 200, cache: CACHED, body: { results: [] } });
    expect(res.upstream).toHaveLength(2);
  });

  it('serves a repeat, a different case and a nearby bias from the server cache', async () => {
    upstream.on(PHOTON, () => PHOTON_RICH);
    const [first, again, upper, nearby] = await check(
      '?q=eiffel&lat=48.8566&lng=2.3522',
      '?q=eiffel&lat=48.8566&lng=2.3522',
      '?q=EIFFEL&lat=48.8566&lng=2.3522',
      '?q=eiffel&lat=48.87&lng=2.37',
    );
    expect(first.upstream).toHaveLength(1);
    for (const res of [again, upper, nearby]) {
      expect(res.upstream).toEqual([]);
      expect(res.body).toEqual(first.body);
    }
  });

  it('reads a repeated parameter as its first value, and + as a space', async () => {
    upstream.on(PHOTON, () => PHOTON_RICH);
    const [repeated, plus] = await check('?q=eiffel&q=louvre', '?q=eiffel+tow');
    expect(repeated.upstream).toEqual([`${PHOTON}?q=eiffel&limit=8&lang=en`]);
    expect(plus.upstream).toEqual([`${PHOTON}?q=eiffel%20tow&limit=8&lang=en`]);
  });
});
