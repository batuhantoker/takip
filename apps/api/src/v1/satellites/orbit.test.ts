import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { startApp, type TestApp } from '../../testing/helpers';
import { run, type Observed } from '../testing/observe';
import { clearTleCatalogue } from './tle-catalogue';

// The TLE file the web app writes, served from memory; every other path reaches the real disk.
const { disk, fakeFs } = vi.hoisted(() => {
  const disk = { text: null as string | null, reads: [] as string[] };
  const fakeFs = (actual: typeof import('node:fs')) => {
    const isTle = (path: unknown) => String(path).endsWith('satellites-tle-cache.json');
    const existsSync = (path: string) => (isTle(path) ? disk.text !== null : actual.existsSync(path));
    const readFileSync = ((path: string, ...rest: unknown[]) => {
      if (!isTle(path)) return (actual.readFileSync as (...args: unknown[]) => unknown)(path, ...rest);
      disk.reads.push(String(path));
      return disk.text;
    }) as typeof actual.readFileSync;
    return { ...actual, default: { ...actual, existsSync, readFileSync }, existsSync, readFileSync };
  };
  return { disk, fakeFs };
});
vi.mock('node:fs', async importActual => fakeFs(await importActual<typeof import('node:fs')>()));

const REPO_TLE_FILE = fileURLToPath(new URL('../../../../../.next/cache/satellites-tle-cache.json', import.meta.url));
const CACHED = 'public, s-maxage=600, stale-while-revalidate=3600';

const AT = Date.parse('2024-01-01T12:00:00Z');
const ISS = {
  name: 'ISS (ZARYA)',
  line1: '1 25544U 98067A   24001.50000000  .00016717  00000-0  30777-3 0  9993',
  line2: '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.49309239 43458',
};
// No mean motion, so no period and nothing to propagate.
const DEBRIS = { name: 'DEBRIS', line1: '1 99998U 98067A   24001.50000000  .00016717  00000-0  30777-3 0  9993', line2: '2 99998' };
const CATALOGUE = JSON.stringify({ time: AT, sats: [ISS, DEBRIS, { name: 'NO ELEMENTS' }] });

let t: TestApp;
let clock = AT;

beforeAll(async () => {
  t = await startApp();
  vi.useFakeTimers({ toFake: ['Date'] });
});
afterAll(() => {
  vi.useRealTimers();
  return t.close();
});
beforeEach(() => {
  disk.text = CATALOGUE;
  disk.reads.length = 0;
});

/** Sends each query in turn at one frozen moment, ten minutes after the last, from a cold catalogue. */
function check(...queries: string[]) {
  clock += 10 * 60_000;
  vi.setSystemTime(clock);
  clearTleCatalogue();
  return run(queries.map(q => `/api/v1/satellites/orbit${q}`), path => t.app.request(path));
}

type Track = { noradId: string; name: string; periodMinutes: number | null; anchoredAt: string; segments: number[][][] };
const track = (res: Observed) => res.body as Track;

describe('GET /api/v1/satellites/orbit', () => {
  it('refuses an id that is not a NORAD number, without reading the catalogue', async () => {
    const answers = await check('', '?id=', '?id=abc', '?id=1234567', '?id=-5', '?id=25544x');
    for (const res of answers) {
      expect(res).toEqual({ status: 400, type: 'application/json', cache: null, body: { error: 'numeric NORAD id required' }, upstream: [] });
    }
    expect(disk.reads).toEqual([]);
  });

  it('reads the TLE file the web app writes, from the repo root', async () => {
    await check('?id=25544');
    expect(disk.reads).toEqual([REPO_TLE_FILE]);
  });

  it('draws one revolution centred on t, in [lng, lat, km] runs split at the antimeridian', async () => {
    const [res] = await check(`?id=25544&t=${AT}`);
    expect(res).toMatchObject({ status: 200, type: 'application/json', cache: CACHED });
    const body = track(res);
    expect(body).toMatchObject({ noradId: '25544', name: 'ISS (ZARYA)', anchoredAt: '2024-01-01T12:00:00.000Z' });
    expect(body.periodMinutes).toBeCloseTo(92.94, 2);
    const points = body.segments.flat();
    expect(points.length).toBeGreaterThan(170);
    expect(points.length).toBeLessThanOrEqual(181);
    for (const [lng, lat, km] of points) {
      expect(Math.abs(lng)).toBeLessThanOrEqual(180);
      expect(Math.abs(lat)).toBeLessThan(52);
      expect(km).toBeGreaterThan(300);
      expect(Number.isInteger(km)).toBe(true);
    }
    for (const run of body.segments) {
      for (let i = 1; i < run.length; i++) expect(Math.abs(run[i][0] - run[i - 1][0])).toBeLessThan(180);
    }
  });

  it('centres on now when t is missing, nonsense or more than a week away, and ignores leading zeros', async () => {
    const answers = await check('?id=025544', '?id=25544&t=0', '?id=25544&t=soon', `?id=25544&t=${AT + 8 * 24 * 3600_000}`);
    for (const res of answers) expect(track(res).anchoredAt).toBe(new Date(clock).toISOString());
    expect(track(answers[0]).noradId).toBe('025544');
  });

  it('answers 404 for a satellite the catalogue lacks, or with no catalogue at all', async () => {
    const [missing] = await check('?id=99999');
    disk.text = null;
    const [noFile] = await check('?id=25544');
    disk.text = '{ not json';
    const [corrupt] = await check('?id=25544');
    expect(missing).toEqual({ status: 404, type: 'application/json', cache: null, body: { error: 'not in catalogue', noradId: '99999' }, upstream: [] });
    expect(noFile.body).toEqual({ error: 'not in catalogue', noradId: '25544' });
    expect(corrupt.body).toEqual({ error: 'not in catalogue', noradId: '25544' });
  });

  it('answers 422 when the elements cannot be propagated', async () => {
    const [res] = await check('?id=99998');
    expect(res).toEqual({ status: 422, type: 'application/json', cache: null, body: { error: 'could not propagate', noradId: '99998' }, upstream: [] });
  });

  it('keeps what it read for five minutes', async () => {
    await check('?id=25544');
    disk.text = null;
    const [again] = await run(['/api/v1/satellites/orbit?id=25544'], path => t.app.request(path));
    expect(again.status).toBe(200);
  });
});
