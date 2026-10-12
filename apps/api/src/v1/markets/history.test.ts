import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { startApp, type TestApp } from '../../testing/helpers';
import { legacyGet } from '../testing/legacy';
import { run } from '../testing/observe';

const { upstream, fails } = await vi.hoisted(() => import('../testing/upstream'));

const CHART = 'https://query1.finance.yahoo.com/v8/finance/chart';
const CACHED = 'public, max-age=60';

const CHART_RESULT = {
  chart: {
    result: [{
      meta: { currency: 'USD' },
      timestamp: [1760000000, 1760086400, 1760172800],
      indicators: {
        quote: [{
          open: [470.1, null, 472.5],
          high: [474.0, 475.2, 476.9],
          low: [468.3, 469.0, 471.1],
          close: [473.2, 474.8, 475.0],
          volume: [1200000, 900000, null],
        }],
      },
    }],
  },
};
const CANDLES = [
  { time: 1760000000, open: 470.1, high: 474.0, low: 468.3, close: 473.2, volume: 1200000 },
  { time: 1760172800, open: 472.5, high: 476.9, low: 471.1, close: 475.0, volume: 0 },
];

let t: TestApp;
let legacy: (path: string) => Promise<Response>;

beforeAll(async () => {
  t = await startApp();
  legacy = await legacyGet('@/app/api/markets/history/route');
  vi.stubGlobal('fetch', upstream.fetch);
});
afterAll(() => {
  vi.unstubAllGlobals();
  return t.close();
});
beforeEach(() => upstream.reset());

async function check(...queries: string[]) {
  const v1 = await run(queries.map(q => `/api/v1/markets/history${q}`), path => t.app.request(path));
  const old = await run(queries.map(q => `/api/markets/history${q}`), legacy);
  expect(v1).toEqual(old);
  return v1;
}

describe('GET /api/v1/markets/history', () => {
  it('refuses a missing or unlisted symbol and an unknown range, without asking Yahoo', async () => {
    const [missing, blank, unlisted, relay, badRange, folded] = await check(
      '', '?symbol=%20', '?symbol=NOTLISTED&range=1M', '?symbol=..%2F..%2Fv1%2Ftest', '?symbol=LMT&range=5Y', '?symbol=LMT&range=1y',
    );
    expect(missing).toEqual({ status: 400, type: 'application/json', cache: null, body: { error: 'symbol required' }, upstream: [] });
    expect(blank.body).toEqual({ error: 'symbol required' });
    expect(unlisted.body).toEqual({ error: 'symbol not listed' });
    expect(relay.body).toEqual({ error: 'symbol not listed' });
    for (const res of [badRange, folded]) {
      expect(res).toMatchObject({ status: 400, body: { error: 'range must be one of 1m, 15m, 24H, 1W, 1M, 6M, 1Y' }, upstream: [] });
    }
  });

  it('refuses a prototype name as a range', async () => {
    const [res] = await run(['/api/v1/markets/history?symbol=LMT&range=constructor'], path => t.app.request(path));
    expect(res).toMatchObject({ status: 400, body: { error: 'range must be one of 1m, 15m, 24H, 1W, 1M, 6M, 1Y' }, upstream: [] });
  });

  it('serves a month of daily candles by default, dropping bars with a missing price', async () => {
    upstream.on(`${CHART}/LMT?`, () => CHART_RESULT);
    const [res] = await check('?symbol=LMT');
    expect(res).toEqual({
      status: 200,
      type: 'application/json',
      cache: CACHED,
      body: { symbol: 'LMT', range: '1M', interval: '1d', currency: 'USD', candles: CANDLES },
      upstream: [`${CHART}/LMT?interval=1d&range=1mo`],
    });
  });

  it('keeps one-minute and one-month bars apart, and encodes the symbol for Yahoo', async () => {
    upstream.on(CHART, () => ({ chart: { result: [{ ...CHART_RESULT.chart.result[0], meta: {} }] } }));
    const [minutes, gold, vix, raw] = await check('?symbol=LMT&range=1m', '?symbol=GC%3DF&range=1Y', '?symbol=%5EVIX&range=24H', '?symbol=GC=F&range=1W');
    expect(minutes.upstream).toEqual([`${CHART}/LMT?interval=1m&range=1d`]);
    expect(gold.upstream).toEqual([`${CHART}/GC%3DF?interval=1wk&range=1y`]);
    expect(vix.upstream).toEqual([`${CHART}/%5EVIX?interval=5m&range=1d`]);
    expect(raw.upstream).toEqual([`${CHART}/GC%3DF?interval=30m&range=5d`]);
    expect(gold.body).toMatchObject({ symbol: 'GC=F', range: '1Y', interval: '1wk', currency: 'USD' });
  });

  it('answers an empty series with no candles', async () => {
    upstream.on(CHART, () => ({ chart: { result: [] } }));
    const [res] = await check('?symbol=BTC-USD&range=6M');
    expect(res.body).toEqual({ symbol: 'BTC-USD', range: '6M', interval: '1d', currency: 'USD', candles: [] });
  });

  it('answers 502 when Yahoo refuses, and 500 when the request fails', async () => {
    upstream.on(`${CHART}/LMT?`, fails(503));
    upstream.on(`${CHART}/RTX?`, () => {
      throw new Error('socket hang up');
    });
    const [refused, failed] = await check('?symbol=LMT', '?symbol=RTX');
    expect(refused).toEqual({ status: 502, type: 'application/json', cache: null, body: { error: 'upstream 503', candles: [] }, upstream: [`${CHART}/LMT?interval=1d&range=1mo`] });
    expect(failed).toMatchObject({ status: 500, cache: null, body: { error: 'Failed', candles: [] } });
  });
});
