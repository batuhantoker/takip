import type { Measure, Quant } from '../types';
import { type Series, daysBetween, logReturns, demean, seriesStats, tradingDays, money } from './series';
import { seedOf, resample, quantile, met, curveLevels, touchCurve } from './paths';

/** The chance a price at `price` meets the measure's level within `steps` trading days, by resampling. */
export function chanceOf(m: Measure, price: number, returns: number[], steps: number, seed: number, count = 2000): number {
  if (m.threshold === undefined) return NaN;
  const already = m.direction === 'below' ? price <= m.threshold : price >= m.threshold;
  if (already && m.touch) return 1;
  const p = resample(returns, steps, count, seed);
  let hits = 0;
  for (let i = 0; i < count; i++) if (met(m, price, p, i)) hits++;
  return hits / count;
}

const PATHS = 4000;

/**
 * The statistical baseline for a question about a price: from today to the
 * horizon, how often the resampled paths meet the measure's level (a yes/no
 * question about a level), and where the price ends (its 10th, 50th and 90th
 * percentile). Null when the history is too short or the horizon has passed.
 */
export function baseline(s: Series, m: Measure, today: string, horizon: string, levels: number[] = []): Quant | null {
  const stats = seriesStats(s);
  const days = daysBetween(today, horizon);
  if (!stats || !(days > 0)) return null;
  const returns = demean(logReturns(s));
  const steps = tradingDays(days, stats.perYear);
  const p = resample(returns, steps, PATHS, seedOf(`${s.symbol}:${horizon}`));
  const ends = Float64Array.from(p.final).sort();
  let probability: number | undefined;
  if (m.threshold !== undefined) {
    let hits = 0;
    for (let i = 0; i < PATHS; i++) if (met(m, stats.price, p, i)) hits++;
    probability = hits / PATHS;
  }
  const years = Math.max(1, Math.round(daysBetween(s.dates[0], stats.asOf) / 365));
  const level = m.threshold !== undefined
    ? ` ${m.touch ? (m.direction === 'below' ? 'fall to' : 'reach') : (m.direction === 'below' ? 'end below' : 'end above')} ${money(m.threshold, s.currency)}`
    : '';
  return {
    symbol: s.symbol,
    name: s.name,
    currency: s.currency,
    price: stats.price,
    asOf: stats.asOf,
    vol: stats.vol,
    days,
    ...(probability !== undefined ? { probability } : {}),
    p10: stats.price * quantile(ends, 0.1),
    p50: stats.price * quantile(ends, 0.5),
    p90: stats.price * quantile(ends, 0.9),
    curve: touchCurve(stats.price, p.max, p.min, curveLevels(stats.price, [...levels, ...(m.threshold !== undefined ? [m.threshold] : [])])),
    method: `${PATHS.toLocaleString('en-US')} paths to ${horizon}, each day one of ${s.symbol}'s own daily moves from the past ${years === 1 ? 'year' : `${years} years`} drawn at random (volatility ${Math.round(stats.vol * 100)}% a year, average trend removed)${probability !== undefined ? `: ${Math.round(probability * 1000) / 10}% of them${level}` : ''}.`,
  };
}
