import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { startApp, type TestApp } from '../../testing/helpers';
import { legacyGet } from '../testing/legacy';
import { run, type Observed } from '../testing/observe';

const { upstream, fails } = await vi.hoisted(() => import('../testing/upstream'));
vi.mock('@takip/connectors/http-json', async importActual => ({
  ...(await importActual<typeof import('@takip/connectors/http-json')>()),
  httpJson: upstream.httpJson,
}));

const VALHALLA = 'https://valhalla1.openstreetmap.de/route';
const HEIGHT = 'https://valhalla1.openstreetmap.de/height';
const OSRM = 'https://router.project-osrm.org/route/v1/driving/';
const CACHED = 'public, s-maxage=300, stale-while-revalidate=600';
const FROM_TO = '?from=52.517,13.3888&to=52.5294,13.3897';

const TRIP = {
  summary: { length: 1.89, time: 267, has_toll: false },
  legs: [
    {
      shape: 'chkdcBo`epXqGn@oEb@s@Fu@HYBaAJkJhAgYpCg@',
      maneuvers: [
        { type: 1, instruction: 'Drive north on Friedrichstraße.', length: 1.141, time: 162, begin_shape_index: 0 },
        { type: 10, instruction: 'Turn right onto Torstraße.', length: 0.748, time: 104, begin_shape_index: 2 },
        { type: 4, instruction: 'You have arrived at your destination.', length: 0, time: 0, begin_shape_index: 5 },
      ],
    },
  ],
};
const OSRM_ROUTE = {
  routes: [
    {
      distance: 1888,
      duration: 260,
      geometry: { coordinates: [[13.3888, 52.517], [13.3897, 52.5294]] },
      legs: [{ steps: [{ name: 'Friedrichstraße', distance: 187, duration: 31, maneuver: { type: 'depart', location: [13.3888, 52.517] } }] }],
    },
  ],
};
const HEIGHTS = { range_height: [[0, 34], [100, 36.5], [200, 35.2], [300, 40]] };

type Body = { provider: string; mode: string; routes: unknown[]; ascent?: number; descent?: number; elevation?: unknown[]; error?: string };
const body = (res: Observed) => res.body as Body;
/** The JSON Valhalla was sent, decoded from the request URL. */
const valhallaRequest = (url: string) => JSON.parse(decodeURIComponent(url.slice(`${VALHALLA}?json=`.length)));

let t: TestApp;
let legacy: (path: string) => Promise<Response>;

beforeAll(async () => {
  t = await startApp();
  legacy = await legacyGet('@/app/api/directions/route');
});
afterAll(() => t.close());
beforeEach(() => upstream.reset());

async function check(...queries: string[]) {
  const v1 = await run(queries.map(q => `/api/v1/directions${q}`), path => t.app.request(path));
  const old = await run(queries.map(q => `/api/directions${q}`), legacy);
  expect(v1).toEqual(old);
  return v1;
}

describe('GET /api/v1/directions', () => {
  it('refuses a missing or unreadable start or destination', async () => {
    const answers = await check('', '?from=52.517,13.3888', '?to=52.5294,13.3897', '?from=52.517&to=52.5294,13.3897', '?from=52.517,13.3888&to=91,0');
    for (const res of answers) {
      expect(res).toEqual({
        status: 400, type: 'application/json', cache: null,
        body: { error: 'from and to are required as "lat,lng"' }, upstream: [],
      });
    }
  });

  it('drives with Valhalla, mirroring the best route at the top level', async () => {
    upstream.on(VALHALLA, () => ({ trip: TRIP, alternates: [{ trip: TRIP }, { trip: TRIP }] }));
    const [res] = await check(FROM_TO);
    expect(res.status).toBe(200);
    expect(res.cache).toBe(CACHED);
    expect(res.upstream).toHaveLength(1);
    expect(valhallaRequest(res.upstream[0])).toEqual({
      locations: [{ lat: 52.517, lon: 13.3888 }, { lat: 52.5294, lon: 13.3897 }],
      costing: 'auto',
      alternates: 2,
      directions_options: { units: 'kilometers' },
    });
    const { routes, ...top } = body(res);
    expect(routes).toHaveLength(3);
    expect(top).toEqual(routes[0]);
    expect(top).toMatchObject({ provider: 'valhalla', mode: 'auto', distance: 1890, duration: 267, hasToll: false });
  });

  it('passes stops in order and avoidances as costing options, skipping unreadable stops', async () => {
    upstream.on(VALHALLA, () => ({ trip: TRIP }));
    const [res] = await check(`${FROM_TO}&via=52.52,13.39|nonsense|52.525,13.395&avoid=tolls,%20ferries,boats&mode=bicycle`);
    expect(valhallaRequest(res.upstream[0])).toMatchObject({
      locations: [{ lat: 52.517 }, { lat: 52.52 }, { lat: 52.525 }, { lat: 52.5294 }],
      costing: 'bicycle',
      costing_options: { bicycle: { use_tolls: 0, use_ferry: 0 } },
    });
  });

  it('treats an unknown mode as driving', async () => {
    upstream.on(VALHALLA, () => ({ trip: TRIP }));
    const [res] = await check(`${FROM_TO}&mode=hovercraft`);
    expect(body(res).mode).toBe('auto');
    expect(valhallaRequest(res.upstream[0]).costing).toBe('auto');
  });

  it('retries Valhalla once, then falls back to OSRM when driving', async () => {
    upstream.on(VALHALLA, fails(503));
    upstream.on(OSRM, () => OSRM_ROUTE);
    const [res] = await check(FROM_TO);
    expect(res.status).toBe(200);
    expect(body(res).provider).toBe('osrm');
    expect(res.upstream.map(u => u.split('?')[0])).toEqual([VALHALLA, VALHALLA, `${OSRM}13.3888,52.517;13.3897,52.5294`]);
    expect(res.upstream[2]).toMatch(/\?steps=true&overview=full&geometries=geojson$/);
  });

  it('never serves a car route for walking, and answers 502 when nothing routes', async () => {
    upstream.on(VALHALLA, () => ({ trip: { legs: [] } }));
    upstream.on(OSRM, fails(502));
    const [walking, driving] = await check(`${FROM_TO}&mode=pedestrian`, FROM_TO);
    expect(walking).toMatchObject({ status: 502, cache: null, body: { error: 'No route found between those points' } });
    expect(walking.upstream).toHaveLength(2);
    expect(driving).toMatchObject({ status: 502, body: { error: 'No route found between those points' } });
    expect(driving.upstream).toHaveLength(3);
  });

  it('adds a terrain profile on foot and by bike', async () => {
    upstream.on(VALHALLA, () => ({ trip: TRIP }));
    upstream.on(HEIGHT, () => HEIGHTS);
    const [res] = await check(`${FROM_TO}&mode=pedestrian`);
    expect(res.upstream[1].startsWith(`${HEIGHT}?json=`)).toBe(true);
    expect(body(res)).toMatchObject({ ascent: 7, descent: 1 });
    expect(body(res).elevation).toHaveLength(4);
  });

  it('still answers when the terrain profile fails', async () => {
    upstream.on(VALHALLA, () => ({ trip: TRIP }));
    upstream.on(HEIGHT, fails(500));
    const [res] = await check(`${FROM_TO}&mode=bicycle`);
    expect(res.status).toBe(200);
    expect(body(res).elevation).toBeUndefined();
  });
});
