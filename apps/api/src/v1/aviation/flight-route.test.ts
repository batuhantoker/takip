import { AIRPORTS_BY_ICAO } from '@takip/connectors/airports';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { startApp, type TestApp } from '../../testing/helpers';
import { run } from '../testing/observe';
import { clearFlightRoutes } from './flight-route';

const { upstream, fails } = await vi.hoisted(() => import('../testing/upstream'));
vi.mock('@takip/connectors/http-json', async importActual => ({
  ...(await importActual<typeof import('@takip/connectors/http-json')>()),
  httpJson: upstream.httpJson,
}));

const ADSBDB = 'https://api.adsbdb.com/v0/callsign/';
const AIRPORT = 'https://api.adsbdb.com/v0/airport/';
const HEXDB = 'https://hexdb.io/api/v1/route/callsign/';
const LIVE_HEX = 'https://api.airplanes.live/v2/hex/';
const LIVE_CALLSIGN = 'https://api.airplanes.live/v2/callsign/';
const FOUND = 'public, s-maxage=120, stale-while-revalidate=300';
const MISSED = 'public, s-maxage=60, stale-while-revalidate=120';
const NOW = new Date('2026-10-12T12:00:00Z');

const { KJFK: JFK, EGLL: LHR } = AIRPORTS_BY_ICAO;
const listed = (icao: string, iata: string, name: string, city: string, lat: number, lng: number) =>
  ({ icao_code: icao, iata_code: iata, name, municipality: city, country_iso_name: 'US', latitude: lat, longitude: lng });
const adsbdbRoute = (origin: object, destination: object) => () => ({ response: { flightroute: { origin, destination } } });
const JFK_LHR = adsbdbRoute(listed('KJFK', 'JFK', 'JFK', 'New York', 40.64, -73.78), listed('EGLL', 'LHR', 'LHR', 'London', 51.47, -0.45));
// Mid-Atlantic, two thirds of the way across.
const ON_THE_WAY = '&lat=51.2&lng=-30.5&speed=480';

type Found = { found: true; source: string; origin: unknown; destination: unknown; arc: [number, number][]; totalDistanceKm: number; departureTime: string | null; arrivalTime: string | null; progress: number };
const found = (body: unknown) => body as Found;

let t: TestApp;

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  vi.stubGlobal('fetch', upstream.fetch);
  t = await startApp();
});
afterAll(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  t.close();
});
beforeEach(() => upstream.reset());

/** Sends each query in turn from cold server-side caches. */
function check(...queries: string[]) {
  clearFlightRoutes();
  return run(queries.map(q => `/api/v1/flight-route${q}`), path => t.app.request(path));
}

describe('GET /api/v1/flight-route', () => {
  it('refuses a request without a callsign', async () => {
    const answers = await check('', '?callsign=', '?callsign=%20%20', '?icao24=4007f5');
    for (const res of answers) {
      expect(res).toEqual({ status: 400, type: 'application/json', cache: null, body: { error: 'callsign required' }, upstream: [] });
    }
  });

  it('asks all three sources at once and draws the great circle between the airports', async () => {
    upstream.on(`${ADSBDB}BAW117`, JFK_LHR);
    const [res] = await check('?callsign=%20baw117%20&icao24=4007F5');
    expect(res).toMatchObject({
      status: 200,
      type: 'application/json',
      cache: FOUND,
      body: {
        found: true, callsign: 'BAW117', icao24: '4007f5', source: 'adsbdb',
        origin: JFK, destination: LHR,
        totalDistanceKm: 5540, departureTime: null, arrivalTime: null, progress: 0,
      },
      upstream: [`${ADSBDB}BAW117`, `${HEXDB}BAW117`, `${LIVE_HEX}4007f5`],
    });
    const { arc } = found(res.body);
    expect(arc).toHaveLength(73);
    expect(arc[0][0]).toBeCloseTo(JFK.lng, 9);
    expect(arc[0][1]).toBeCloseTo(JFK.lat, 9);
    expect(arc[72][0]).toBeCloseTo(LHR.lng, 9);
    expect(arc[72][1]).toBeCloseTo(LHR.lat, 9);
  });

  it('estimates the times and progress from a position and ground speed', async () => {
    upstream.on(`${ADSBDB}BAW117`, JFK_LHR);
    const [res] = await check(`?callsign=BAW117${ON_THE_WAY}`);
    const body = found(res.body);
    expect(body.progress).toBeGreaterThan(0.6);
    expect(body.progress).toBeLessThan(0.7);
    expect(Date.parse(body.departureTime!)).toBeLessThan(NOW.getTime());
    expect(Date.parse(body.arrivalTime!)).toBeGreaterThan(NOW.getTime());
  });

  it('takes the first source to answer', async () => {
    upstream.on(`${ADSBDB}BAW117`, JFK_LHR);
    upstream.on(`${HEXDB}BAW117`, () => ({ route: 'KBOS-EGLL' }));
    const [res] = await check('?callsign=BAW117');
    expect(res.body).toMatchObject({ source: 'adsbdb', origin: JFK });
  });

  it('falls back to HexDB, then to airplanes.live', async () => {
    upstream.on(`${ADSBDB}`, () => ({ response: 'unknown callsign' }));
    upstream.on(`${HEXDB}DAL67`, () => ({ route: 'KATL-LIRF-KATL' }));
    upstream.on(`${HEXDB}DAL68`, () => ({ route: 'KATL-LIRF' }));
    upstream.on(`${LIVE_CALLSIGN}DAL68`, () => ({ ac: [{ oDB: { icao: 'KATL' }, dDB: { icao: 'LIRF' } }] }));
    upstream.on(`${HEXDB}UAL1`, () => ({ origin: 'KSFO', destination: 'KORD' }));
    upstream.on(`${LIVE_CALLSIGN}UAL2`, () => ({ ac: [{ from: 'KSFO', to: 'KEWR' }] }));
    upstream.on(`${LIVE_CALLSIGN}UAL3`, () => ({ ac: [{ route: 'KSFO-KDEN-KIAD' }] }));
    const [roundTrip, dal68, ual1, ual2, ual3] = await check('?callsign=DAL67', '?callsign=DAL68', '?callsign=UAL1', '?callsign=UAL2', '?callsign=UAL3');
    // A route that ends where it began is no route.
    expect(roundTrip.body).toEqual({ found: false, callsign: 'DAL67', icao24: '' });
    expect(dal68.body).toMatchObject({ source: 'hexdb', origin: AIRPORTS_BY_ICAO.KATL, destination: AIRPORTS_BY_ICAO.LIRF });
    expect(dal68.upstream).toEqual([`${ADSBDB}DAL68`, `${HEXDB}DAL68`, `${LIVE_CALLSIGN}DAL68`]);
    expect(ual1.body).toMatchObject({ source: 'hexdb', destination: AIRPORTS_BY_ICAO.KORD });
    expect(ual2.body).toMatchObject({ source: 'airplaneslive', destination: AIRPORTS_BY_ICAO.KEWR });
    expect(ual3.body).toMatchObject({ source: 'airplaneslive', destination: AIRPORTS_BY_ICAO.KIAD });
  });

  it('looks up an airport missing from the table, then falls back to the coordinates the source gave', async () => {
    const lebanon = listed('KLEB', 'LEB', 'Lebanon Municipal', 'Lebanon', 43.6261, -72.3042);
    upstream.on(`${ADSBDB}CJC1`, adsbdbRoute(lebanon, listed('KBOS', 'BOS', 'Logan', 'Boston', 42.36, -71.01)));
    upstream.on(`${ADSBDB}CJC2`, adsbdbRoute(lebanon, listed('KJFK', 'JFK', 'JFK', 'New York', 40.64, -73.78)));
    upstream.on(`${AIRPORT}KLEB`, () => ({
      response: { airport: { icao: 'KLEB', iata_code: 'LEB', name: 'Lebanon Municipal Airport', municipality: 'Lebanon', country_iso_name: 'US', latitude: 43.6261, longitude: -72.3042 } },
    }));
    upstream.on(`${LIVE_CALLSIGN}CJC3`, () => ({
      ac: [{ oDB: { icao: 'KMPV', iata: 'MPV', lat: 44.2035, lon: -72.5623, name: 'Knapp', city: 'Montpelier', country: 'US' }, dDB: { icao: 'KBOS' } }],
    }));
    const [cjc1, cjc2, cjc3] = await check('?callsign=CJC1', '?callsign=CJC2', '?callsign=CJC3');
    const LEB = { iata: 'LEB', icao: 'KLEB', name: 'Lebanon Municipal Airport', city: 'Lebanon', country: 'US', lat: 43.6261, lng: -72.3042 };
    expect(cjc1.body).toMatchObject({ source: 'adsbdb', origin: LEB, destination: AIRPORTS_BY_ICAO.KBOS });
    expect(cjc1.upstream).toEqual([`${ADSBDB}CJC1`, `${HEXDB}CJC1`, `${LIVE_CALLSIGN}CJC1`, `${AIRPORT}KLEB`]);
    // Remembered from the first lookup.
    expect(cjc2.upstream).not.toContain(`${AIRPORT}KLEB`);
    expect(cjc3.body).toMatchObject({
      source: 'airplaneslive',
      origin: { iata: 'MPV', icao: 'KMPV', name: 'Knapp', city: 'Montpelier', country: 'US', lat: 44.2035, lng: -72.5623 },
    });
    expect(cjc3.upstream).toContain(`${AIRPORT}KMPV`);
  });

  it('rejects a route the aircraft is nowhere near, and one under 30 km', async () => {
    upstream.on(`${ADSBDB}BAW117`, JFK_LHR);
    upstream.on(`${HEXDB}SHUTTLE`, () => ({ route: 'KJFK-KLGA' }));
    const [far, short] = await check('?callsign=BAW117&lat=-33.9&lng=151.2', '?callsign=SHUTTLE&lat=40.7&lng=-73.8');
    expect(far).toMatchObject({ status: 200, cache: MISSED, body: { found: false, callsign: 'BAW117', icao24: '' } });
    expect(short.body).toEqual({ found: false, callsign: 'SHUTTLE', icao24: '' });
  });

  it('answers found: false when every source fails', async () => {
    const [res] = await check('?callsign=XYZ999&icao24=abc123');
    expect(res).toEqual({
      status: 200,
      type: 'application/json',
      cache: MISSED,
      body: { found: false, callsign: 'XYZ999', icao24: 'abc123' },
      upstream: [`${ADSBDB}XYZ999`, `${HEXDB}XYZ999`, `${LIVE_HEX}abc123`],
    });
  });

  it('remembers a route, and estimates the times again for each new position', async () => {
    upstream.on(`${ADSBDB}BAW117`, JFK_LHR);
    const [first, moved, still] = await check('?callsign=BAW117', `?callsign=baw117${ON_THE_WAY}`, '?callsign=BAW117');
    expect(moved).toMatchObject({ cache: FOUND, upstream: [] });
    expect(found(moved.body).progress).toBeGreaterThan(0.6);
    expect(still).toEqual({ ...first, upstream: [] });
  });

  it('remembers a miss, and sends the repeat with the longer cache', async () => {
    const [miss, repeat] = await check('?callsign=XYZ999', '?callsign=XYZ999');
    expect(miss.cache).toBe(MISSED);
    expect(repeat).toEqual({ ...miss, cache: FOUND, upstream: [] });
  });

  it('stops asking a source for three minutes after it answers 429', async () => {
    upstream.on(ADSBDB, fails(429));
    upstream.on(`${HEXDB}BAW118`, () => ({ route: 'EGLL-KJFK' }));
    const [limited, next] = await check('?callsign=BAW117', '?callsign=BAW118');
    expect(limited.upstream).toEqual([`${ADSBDB}BAW117`, `${HEXDB}BAW117`, `${LIVE_CALLSIGN}BAW117`]);
    expect(next).toMatchObject({ body: { source: 'hexdb', origin: LHR }, upstream: [`${HEXDB}BAW118`, `${LIVE_CALLSIGN}BAW118`] });
  });
});
