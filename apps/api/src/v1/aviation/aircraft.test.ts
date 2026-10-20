import { AIRPORTS_BY_ICAO } from '@takip/connectors/airports';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { startApp, type TestApp } from '../../testing/helpers';
import { run } from '../testing/observe';
import { RESERVE_CREDITS, resetOpenSkyTrack } from './opensky-track';

const { upstream, fails } = await vi.hoisted(() => import('../testing/upstream'));
vi.mock('@takip/connectors/http-json', async importActual => ({
  ...(await importActual<typeof import('@takip/connectors/http-json')>()),
  httpJson: upstream.httpJson,
}));

const AUTH = 'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';
const TRACK = 'https://opensky-network.org/api/tracks/all?icao24=ae291a&time=0';
const ADSBDB = 'https://api.adsbdb.com/v0/aircraft/ae291a';
const ADSBFI = 'https://opendata.adsb.fi/api/v2/hex/ae291a';
const CACHED = 'public, s-maxage=120, stale-while-revalidate=600';

// JFK to Boston, from the gate to the ground again: [t, lat, lon, baro m, track, on ground].
const PATH = [
  [1792500000, 40.64, -73.78, null, 0, true],
  [1792500300, 40.65, -73.77, 240, 50, false],
  [1792501500, 41.5, -72.5, 4572, 50, false],
  [1792502700, 42.37, -71.02, 152, 50, false],
  [1792502800, 42.3656, -71.0096, null, 0, true],
];
const DELTA = {
  response: {
    aircraft: { manufacturer: 'Boeing', type: '737-932ER', registered_owner: 'Delta Air Lines', registration: 'N381DN', icao_type: 'B739' },
  },
};
const signedIn = () => ({ access_token: 'token', expires_in: 1800 });
const credits = (left: number) => () => Response.json({ icao24: 'ae291a', path: PATH }, { headers: { 'x-rate-limit-remaining': String(left) } });

let t: TestApp;

beforeAll(async () => {
  vi.stubGlobal('fetch', upstream.fetch);
  vi.stubEnv('OPENSKY_CLIENT_ID', 'takip');
  vi.stubEnv('OPENSKY_CLIENT_SECRET', 'secret');
  t = await startApp();
});
afterAll(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  t.close();
});
beforeEach(() => {
  upstream.reset();
  resetOpenSkyTrack();
  upstream.on(AUTH, signedIn);
});

/** Sends each query in turn from cold server-side caches. */
const check = (...queries: string[]) => run(queries.map(q => `/api/v1/aircraft${q}`), path => t.app.request(path));

describe('GET /api/v1/aircraft', () => {
  it('refuses an address that is not six hex characters', async () => {
    const answers = await check('', '?icao24=xyz', '?icao24=ae291', '?icao24=ae291a0', '?icao24=ge291a');
    for (const res of answers) {
      expect(res).toEqual({
        status: 400,
        type: 'application/json',
        cache: null,
        body: { error: 'icao24 must be a 6-character hex address' },
        upstream: [],
      });
    }
  });

  it('reads the flight in progress from OpenSky and the airframe from adsbdb', async () => {
    upstream.on(TRACK, () => ({ icao24: 'ae291a', path: PATH }));
    upstream.on(ADSBDB, () => DELTA);
    const [res] = await check('?icao24=ae291a');
    expect(res).toEqual({
      status: 200,
      type: 'application/json',
      cache: CACHED,
      body: {
        icao24: 'ae291a',
        registration: 'N381DN',
        typeCode: 'B739',
        model: 'Boeing 737-932ER',
        operator: 'Delta Air Lines',
        track: [[-73.78, 40.64], [-73.77, 40.65], [-72.5, 41.5], [-71.02, 42.37], [-71.0096, 42.3656]],
        altitudes: [null, 787, 15000, 499, null],
        points: 5,
        departure: AIRPORTS_BY_ICAO.KJFK,
        departureFix: { lng: -73.78, lat: 40.64, radiusKm: 8 },
        arrival: AIRPORTS_BY_ICAO.KBOS,
        source: 'opensky',
      },
      upstream: [AUTH, ADSBDB, TRACK],
    });
  });

  it('signs in to OpenSky once and reuses the token', async () => {
    upstream.on(TRACK, () => ({ path: PATH }));
    upstream.on(ADSBDB, () => DELTA);
    const [first] = await check('?icao24=ae291a');
    const [second] = await check('?icao24=ae291a');
    expect(first.upstream).toEqual([AUTH, ADSBDB, TRACK]);
    expect(second.upstream).toEqual([ADSBDB, TRACK]);
  });

  it('stops asking OpenSky once the day is down to the credits the live map needs', async () => {
    upstream.on(TRACK, credits(RESERVE_CREDITS - 4));
    upstream.on(ADSBDB, () => DELTA);
    const [last] = await check('?icao24=ae291a');
    const [held] = await check('?icao24=ae291a');
    expect(last.body).toMatchObject({ points: 5, source: 'opensky' });
    expect(held.upstream).toEqual([ADSBDB]);
    expect(held.body).toMatchObject({ registration: 'N381DN', track: [], points: 0, departure: null, source: 'adsbdb' });
  });

  it('waits out a 429 before asking OpenSky again', async () => {
    upstream.on(TRACK, () => new Response(null, { status: 429, headers: { 'x-rate-limit-retry-after-seconds': '600' } }));
    upstream.on(ADSBDB, () => DELTA);
    const [limited] = await check('?icao24=ae291a');
    const [later] = await check('?icao24=ae291a');
    expect(limited.body).toMatchObject({ track: [], source: 'adsbdb' });
    expect(later.upstream).toEqual([ADSBDB]);
  });

  it('leaves OpenSky alone without an account', async () => {
    vi.stubEnv('OPENSKY_CLIENT_ID', '');
    upstream.on(ADSBDB, () => DELTA);
    const [res] = await check('?icao24=ae291a');
    vi.stubEnv('OPENSKY_CLIENT_ID', 'takip');
    expect(res).toMatchObject({ status: 200, body: { track: [], source: 'adsbdb' }, upstream: [ADSBDB] });
  });

  it('ignores case and surrounding spaces in the address, and reads a repeated one as its first value', async () => {
    upstream.on(TRACK, () => ({ path: PATH }));
    upstream.on(ADSBDB, () => DELTA);
    const [spaced, repeated] = await check('?icao24=%20AE291A%20', '?icao24=ae291a&icao24=ffffff');
    expect(spaced).toMatchObject({ status: 200, upstream: [AUTH, ADSBDB, TRACK] });
    expect(repeated).toMatchObject({ status: 200, upstream: [] });
  });

  it('asks adsb.fi when adsbdb leaves the registration or the type blank', async () => {
    upstream.on(TRACK, fails(404));
    upstream.on(ADSBDB, () => ({ response: { aircraft: { manufacturer: 'Boeing', type: '737-932ER', registered_owner: 'Delta Air Lines' } } }));
    upstream.on(ADSBFI, () => ({ ac: [{ r: 'N381DN ', t: 'B739', desc: 'BOEING 737-900ER' }] }));
    const [res] = await check('?icao24=ae291a');
    expect(res).toMatchObject({
      status: 200,
      cache: CACHED,
      body: {
        registration: 'N381DN', typeCode: 'B739', model: 'Boeing 737-932ER', operator: 'Delta Air Lines',
        track: [], altitudes: [], points: 0, departure: null, departureFix: null, arrival: null, source: 'adsbdb',
      },
      upstream: [AUTH, ADSBDB, TRACK, ADSBFI],
    });
  });

  it('names adsb.fi as the source when only it knows the airframe', async () => {
    upstream.on(ADSBFI, () => ({ ac: [{ r: 'VT-NOH', t: 'A21N', desc: 'AIRBUS A-321neo', ownOp: 'IndiGo ' }] }));
    const [res] = await check('?icao24=ae291a');
    expect(res.body).toMatchObject({ registration: 'VT-NOH', operator: 'IndiGo', source: 'adsb.fi' });
  });

  it('answers 404 when no source knows the airframe, and asks again next time', async () => {
    upstream.on(TRACK, fails(404));
    upstream.on(ADSBFI, () => ({ ac: [] }));
    const answers = await check('?icao24=ae291a', '?icao24=ae291a');
    expect(answers[0].upstream).toEqual([AUTH, ADSBDB, TRACK, ADSBFI]);
    for (const res of answers) {
      expect(res).toMatchObject({ status: 404, cache: null, body: { error: 'Aircraft not found', icao24: 'ae291a' } });
    }
    expect(answers[1].upstream).toEqual([ADSBDB, TRACK, ADSBFI]);
  });

  it('answers a repeat from the cache', async () => {
    upstream.on(TRACK, () => ({ path: PATH }));
    upstream.on(ADSBDB, () => DELTA);
    const [first, again] = await check('?icao24=ae291a', '?icao24=ae291a');
    expect(again).toEqual({ ...first, upstream: [] });
  });
});
