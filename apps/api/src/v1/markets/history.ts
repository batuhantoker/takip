import { createRoute, OpenAPIHono, z, type RouteHandler } from '@hono/zod-openapi';
import { TICKERS } from '@takip/connectors/market-tickers';
import { ErrorBody, json, queryParam } from '../schemas';
import { parseCandles, RANGES, rangeSpec } from './candles';
import { PriceHistory, PriceHistoryError } from './schemas';

const CHART = 'https://query1.finance.yahoo.com/v8/finance/chart';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export const historyRoute = createRoute({
  method: 'get',
  path: '/history',
  tags: ['Markets'],
  summary: 'Price history for a listed instrument',
  description:
    'OHLC candles from Yahoo Finance for one of the instruments the markets feed lists, each range at a bar size ' +
    'worth drawing: a day at 5-minute bars, a year at weekly ones. Other symbols are refused without asking Yahoo.',
  request: {
    query: z.object({
      symbol: queryParam().openapi({
        param: { required: true },
        description: 'A symbol the markets feed lists, such as LMT, GC=F or EURUSD=X.',
        example: 'LMT',
      }),
      range: queryParam().openapi({
        description: `One of ${Object.keys(RANGES).join(', ')}; case matters (1m is a day of one-minute bars, 1M a month of daily ones). Defaults to 1M.`,
        example: '1M',
      }),
    }),
  },
  responses: {
    200: { description: 'The candles, oldest first.', content: json(PriceHistory) },
    400: { description: 'symbol is missing or not listed, or range is not one of the ranges.', content: json(ErrorBody) },
    500: { description: 'The lookup failed.', content: json(PriceHistoryError) },
    502: { description: 'Yahoo answered with an error status.', content: json(PriceHistoryError) },
  },
});

export const history: RouteHandler<typeof historyRoute> = async c => {
  const query = c.req.valid('query');
  const symbol = query.symbol?.trim();
  const rangeKey = query.range || '1M';

  if (!symbol) return c.json({ error: 'symbol required' }, 400);
  // Only listed instruments, or the route would relay whatever symbol a stranger sends.
  if (!TICKERS.some(t => t.symbol === symbol)) return c.json({ error: 'symbol not listed' }, 400);
  const spec = rangeSpec(rangeKey);
  if (!spec) return c.json({ error: `range must be one of ${Object.keys(RANGES).join(', ')}` }, 400);

  try {
    const res = await fetch(`${CHART}/${encodeURIComponent(symbol)}?interval=${spec.interval}&range=${spec.range}`, {
      signal: AbortSignal.timeout(9000),
      headers: { 'User-Agent': UA, Accept: 'application/json' },
    });
    if (!res.ok) return c.json({ error: `upstream ${res.status}`, candles: [] }, 502);

    const result = ((await res.json()) as { chart?: { result?: { meta?: { currency?: string } }[] } })?.chart?.result?.[0];
    return c.json(
      { symbol, range: rangeKey, interval: spec.interval, currency: result?.meta?.currency || 'USD', candles: parseCandles(result) },
      200,
      // A minute at the edge absorbs clicking through the ranges; intraday bars go stale fast.
      { 'Cache-Control': 'public, max-age=60' },
    );
  } catch (error) {
    console.error('[TAKIP] Markets history error:', error);
    return c.json({ error: 'Failed', candles: [] }, 500);
  }
};

export function marketsRoutes() {
  return new OpenAPIHono().openapi(historyRoute, history);
}
