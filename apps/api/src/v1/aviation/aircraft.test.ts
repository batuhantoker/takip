import { AIRPORTS_BY_ICAO } from '@takip/connectors/airports';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { startApp, type TestApp } from '../../testing/helpers';
import { legacyGet } from '../testing/legacy';
import { run } from '../testing/observe';

const { upstream, fails } = await vi.hoisted(() => import('../testing/upstream'));
vi.mock('@takip/connectors/http-json', async importActual => ({
  ...(await importActual<typeof import('@takip/connectors/http-json')>()),
  httpJson: upstream.httpJson,
}));

const TRACE_FULL = 'https://adsb.lol/data/traces/1a/trace_full_ae291a.json';
const TRACE_RECENT = 'https://adsb.lol/data/traces/1a/trace_recent_ae291a.json';
const ADSBDB = 'https://api.adsbdb.com/v0/aircraft/ae291a';
const ADSBFI = 'https://opendata.adsb.fi/api/v2/hex/ae291a';
const CACHED = 'public, s-maxage=120, stale-while-revalidate=600';

// An earlier leg, a stop at JFK, then JFK to Boston, ending on the ground.
const TRACE = {
  icao: 'AE291A',
  r: 'N381DN ',
  t: 'B739',
  desc: 'BOEING 737-900ER',
  trace: [
    [0, 38.9, -77.4, 3000, 250, 40, 0],
    [60, 39.5, -76.0, 20000, 400, 40, 0],
    [120, 40.64, -73.78, 'ground', 10, 0, 0],
    [130, 40.64, -73.78, 'ground', 0, 0, 0],
    [140, 40.64, -73.78, 'ground', 0, 0, 0],
    [150, 40.64, -73.78, 'ground', 10, 0, 0],
    [200, 40.65, -73.77, 800, 160, 50, 0],
    [300, 41.5, -72.5, 15000, 420, 50, 0],
    [390, 42.37, -71.02, 500, 140, 50, 0],
    [400, 42.3656, -71.0096, 'ground', 20, 0, 0],
  ],
};
const DELTA = {
  response: {
    aircraft: { manufacturer: 'Boeing', type: '737-932ER', registered_owner: 'Delta Air Lines', registration: 'N381DN', icao_type: 'B739' },
  },
};

let t: TestApp;
let legacy: (path: string) => Promise<Response>;

beforeAll(async () => {
  t = await startApp();
  legacy = await legacyGet('@/app/api/aircraft/route');
});
afterAll(() => t.close());
beforeEach(() => upstream.reset());

async function check(...queries: string[]) {
  const v1 = await run(queries.map(q => `/api/v1/aircraft${q}`), path => t.app.request(path));
  const old = await run(queries.map(q => `/api/aircraft${q}`), legacy);
  expect(v1).toEqual(old);
  return v1;
}

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

  it('reads the leg in progress and the airframe from the trace, and the operator from adsbdb', async () => {
    upstream.on(TRACE_FULL, () => TRACE);
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
        model: 'BOEING 737-900ER',
        operator: 'Delta Air Lines',
        track: [[-73.77, 40.65], [-72.5, 41.5], [-71.02, 42.37]],
        altitudes: [800, 15000, 500],
        points: 3,
        departure: AIRPORTS_BY_ICAO.KJFK,
        departureFix: { lng: -73.77, lat: 40.65, radiusKm: 8 },
        arrival: AIRPORTS_BY_ICAO.KBOS,
        source: 'adsb.lol',
      },
      upstream: [TRACE_FULL, ADSBDB],
    });
  });

  it('reads the recent trace on detail=recent, and keeps the whole day on legs=all', async () => {
    upstream.on(TRACE_RECENT, () => TRACE);
    upstream.on(TRACE_FULL, () => TRACE);
    upstream.on(ADSBDB, () => DELTA);
    const [recent, all] = await check('?icao24=ae291a&detail=recent', '?icao24=ae291a&legs=all');
    expect(recent.upstream).toEqual([TRACE_RECENT, ADSBDB]);
    expect(all.upstream).toEqual([TRACE_FULL, ADSBDB]);
    expect(all.body).toMatchObject({
      points: 10,
      departure: AIRPORTS_BY_ICAO.KIAD,
      departureFix: { lng: -77.4, lat: 38.9, radiusKm: 15 },
      arrival: AIRPORTS_BY_ICAO.KBOS,
    });
  });

  it('ignores case and surrounding spaces in the address, and reads a repeated one as its first value', async () => {
    upstream.on(TRACE_FULL, () => TRACE);
    upstream.on(ADSBDB, () => DELTA);
    const [spaced, repeated] = await check('?icao24=%20AE291A%20', '?icao24=ae291a&icao24=ffffff');
    expect(spaced).toMatchObject({ status: 200, upstream: [TRACE_FULL, ADSBDB] });
    expect(repeated).toMatchObject({ status: 200, upstream: [] });
  });

  it('asks adsb.fi when the others leave the registration or the type blank', async () => {
    upstream.on(TRACE_FULL, fails(404));
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
      upstream: [TRACE_FULL, ADSBDB, ADSBFI],
    });
  });

  it('names adsb.fi as the source when only it knows the airframe', async () => {
    upstream.on(ADSBFI, () => ({ ac: [{ r: 'VT-NOH', t: 'A21N', desc: 'AIRBUS A-321neo', ownOp: 'IndiGo ' }] }));
    const [res] = await check('?icao24=ae291a');
    expect(res.body).toMatchObject({ registration: 'VT-NOH', operator: 'IndiGo', source: 'adsb.fi' });
  });

  it('answers 404 when no source knows the airframe, and asks again next time', async () => {
    upstream.on(ADSBFI, () => ({ ac: [] }));
    const answers = await check('?icao24=ae291a', '?icao24=ae291a');
    for (const res of answers) {
      expect(res).toEqual({
        status: 404,
        type: 'application/json',
        cache: null,
        body: { error: 'Aircraft not found', icao24: 'ae291a' },
        upstream: [TRACE_FULL, ADSBDB, ADSBFI],
      });
    }
  });

  it('answers a repeat from the cache', async () => {
    upstream.on(TRACE_FULL, () => TRACE);
    upstream.on(ADSBDB, () => DELTA);
    const [first, again] = await check('?icao24=ae291a', '?icao24=ae291a');
    expect(again).toEqual({ ...first, upstream: [] });
  });
});
