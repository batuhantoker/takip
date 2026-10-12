import type { Candle } from './schemas';

/**
 * Ranges the client may ask for, and the bar size each is served at.
 *
 * Case matters, and deliberately so: `1m` is one-minute bars while `1M` is one
 * month, the same convention the trading tools use. Do not case-fold the query
 * parameter — it would collapse the two.
 */
export const RANGES: Record<string, { interval: string; range: string }> = {
  '1m': { interval: '1m', range: '1d' },
  '15m': { interval: '15m', range: '2d' },
  '24H': { interval: '5m', range: '1d' },
  '1W': { interval: '30m', range: '5d' },
  '1M': { interval: '1d', range: '1mo' },
  '6M': { interval: '1d', range: '6mo' },
  '1Y': { interval: '1wk', range: '1y' },
};

/** The bar spec for a range key; prototype names such as "constructor" are not ranges. */
export const rangeSpec = (key: string) => (Object.hasOwn(RANGES, key) ? RANGES[key] : undefined);

/**
 * Yahoo pads its series with nulls wherever a bar has no trade. A candle with
 * a missing leg cannot be drawn, so drop it rather than invent a value.
 */
export function parseCandles(result: unknown): Candle[] {
  const r = result as {
    timestamp?: number[];
    indicators?: { quote?: Array<{ open?: (number | null)[]; high?: (number | null)[]; low?: (number | null)[]; close?: (number | null)[]; volume?: (number | null)[] }> };
  } | null;

  const stamps = r?.timestamp;
  const q = r?.indicators?.quote?.[0];
  if (!Array.isArray(stamps) || !q) return [];

  const out: Candle[] = [];
  for (let i = 0; i < stamps.length; i++) {
    const [o, h, l, c] = [q.open?.[i], q.high?.[i], q.low?.[i], q.close?.[i]];
    if (![o, h, l, c].every(v => Number.isFinite(v))) continue;
    if (!Number.isFinite(stamps[i])) continue;
    out.push({
      time: stamps[i],
      open: o as number,
      high: h as number,
      low: l as number,
      close: c as number,
      volume: Number.isFinite(q.volume?.[i]) ? (q.volume![i] as number) : 0,
    });
  }
  return out;
}
