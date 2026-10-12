import type { Quote } from './route';

/**
 * ECB euro reference rates via Frankfurter (api.frankfurter.dev), no key; ECB data, free to reuse.
 * A once-a-day fixing (around 16:00 CET on TARGET days), so it stands in for an FX pair only when
 * Yahoo has nothing for it.
 */

/** Our FX tickers as a USD rate: `invert` when the pair is quoted XXX/USD. */
export const ECB_PAIRS: Array<{ symbol: string; currency: string; invert: boolean }> = [
  { symbol: 'EURUSD=X', currency: 'EUR', invert: true },
  { symbol: 'USDJPY=X', currency: 'JPY', invert: false },
  { symbol: 'GBPUSD=X', currency: 'GBP', invert: true },
  { symbol: 'USDCNY=X', currency: 'CNY', invert: false },
];

export function ecbSeriesUrl(now: number): string {
  const start = new Date(now - 32 * 86_400_000).toISOString().slice(0, 10);
  return `https://api.frankfurter.dev/v1/${start}..?base=USD&symbols=${ECB_PAIRS.map(p => p.currency).join(',')}`;
}

const r4 = (n: number) => Math.round(n * 10000) / 10000;

/** Quotes for `tickers` from a Frankfurter time series; pairs without two fixings are skipped. */
export function ecbQuotes(json: unknown, tickers: Array<{ symbol: string; name: string; group: string }>): Quote[] {
  const rates = (json as { rates?: Record<string, Record<string, number>> } | null)?.rates;
  if (!rates || typeof rates !== 'object') throw new Error('Frankfurter: unexpected response');
  const days = Object.keys(rates).sort();

  return tickers.flatMap(t => {
    const pair = ECB_PAIRS.find(p => p.symbol === t.symbol);
    if (!pair) return [];
    const series = days.flatMap(day => {
      const rate = rates[day]?.[pair.currency];
      return typeof rate === 'number' && rate > 0 ? [{ day, value: r4(pair.invert ? 1 / rate : rate) }] : [];
    });
    if (series.length < 2) return [];
    const last = series[series.length - 1];
    const prev = series[series.length - 2].value;
    const change = ((last.value - prev) / prev) * 100;
    return [{
      group: t.group,
      name: t.name,
      symbol: t.symbol,
      price: last.value,
      change_percent: Math.round(change * 100) / 100,
      up: change >= 0,
      spark: series.map(s => s.value),
      currency: pair.invert ? 'USD' : pair.currency,
      market_open: false,
      prev_close: prev,
      exchange: 'ECB reference rate',
      description: `ECB fixing of ${last.day}`,
    }];
  });
}
