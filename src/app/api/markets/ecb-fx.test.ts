import { describe, expect, it } from 'vitest';
import { ecbQuotes, ecbSeriesUrl } from './ecb-fx';

// Verbatim from api.frankfurter.dev/v1/2026-09-10..?base=USD&symbols=EUR,GBP,JPY,CNY (first two days).
const SERIES = {
  amount: 1.0, base: 'USD', start_date: '2026-09-10', end_date: '2026-09-11',
  rates: {
    '2026-09-11': { CNY: 6.7082, EUR: 0.86266, GBP: 0.7403, JPY: 154.04 },
    '2026-09-10': { CNY: 6.7063, EUR: 0.86088, GBP: 0.73963, JPY: 154.18 },
  },
};

const FX = [
  { symbol: 'EURUSD=X', name: 'EUR/USD', group: 'fx' },
  { symbol: 'USDJPY=X', name: 'USD/JPY', group: 'fx' },
];

describe('ecbQuotes', () => {
  it('builds quotes in date order, inverting XXX/USD pairs', () => {
    const [eur, jpy] = ecbQuotes(SERIES, FX);
    expect(eur).toEqual({
      group: 'fx', name: 'EUR/USD', symbol: 'EURUSD=X',
      price: 1.1592, change_percent: -0.21, up: false, spark: [1.1616, 1.1592],
      currency: 'USD', market_open: false, prev_close: 1.1616,
      exchange: 'ECB reference rate', description: 'ECB fixing of 2026-09-11',
    });
    expect(jpy).toMatchObject({ price: 154.04, prev_close: 154.18, currency: 'JPY', up: false });
  });

  it('skips a pair with fewer than two fixings, and tickers it does not cover', () => {
    const oneDay = { rates: { '2026-09-11': SERIES.rates['2026-09-11'] } };
    expect(ecbQuotes(oneDay, FX)).toEqual([]);
    expect(ecbQuotes(SERIES, [{ symbol: 'LMT', name: 'LMT', group: 'stocks' }])).toEqual([]);
  });

  it('throws on an unexpected body', () => {
    expect(() => ecbQuotes({}, FX)).toThrow();
  });
});

describe('ecbSeriesUrl', () => {
  it('asks for about a month of USD-based fixings', () => {
    expect(ecbSeriesUrl(Date.parse('2026-10-12T12:00:00Z')))
      .toBe('https://api.frankfurter.dev/v1/2026-09-10..?base=USD&symbols=EUR,JPY,GBP,CNY');
  });
});
