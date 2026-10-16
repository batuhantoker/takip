/**
 * TAKIP AI: what a market price's own history says, before any actor moves.
 *
 * For a question that turns on a price (a coin, a share, an index, a
 * commodity, a currency), the outside view is the market itself: where the
 * price is and how far it habitually moves. This turns a daily price history
 * into that view with no model's opinion in it: the instrument's own daily
 * moves, demeaned so a past rally or slide is not assumed to repeat, are
 * resampled into thousands of paths to the horizon, and the paths say how
 * often the price touches or ends beyond a level, and where it ends.
 *
 * The same resampling gives each simulated world its own course for the
 * price, spread across what can happen (one world drawn from the low end,
 * one from the middle, one from the high end), so the worlds the actors play
 * in differ the way markets do. The actors' events then push a world's price
 * further, and a world settles a price question only when its price gets
 * there.
 *
 * Pure and deterministic: the same history always gives the same paths.
 */

/** A daily price history, oldest first. */
export interface Series {
  symbol: string;
  name: string;
  currency: string;
  /** YYYY-MM-DD, one per trading day. */
  dates: string[];
  /** The quoted closing price. */
  closes: number[];
  /** Closes adjusted for splits and dividends, where the market has them: what returns are read from. */
  adjusted?: number[];
}

export interface SeriesStats {
  price: number;
  asOf: string;
  /** The past year's highest and lowest close, and when. */
  high: number;
  highOn: string;
  low: number;
  lowOn: string;
  /** Change over 30, 90 and 365 calendar days, as a fraction; null where the history is shorter. */
  change30: number | null;
  change90: number | null;
  change365: number | null;
  /** Annualised volatility of daily log returns. */
  vol: number;
  /** Trading days a year: about 252 for a share, 365 for a coin. */
  perYear: number;
}

const DAY = 86_400_000;

export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);

/** Daily log returns, read from the adjusted closes where there are any. */
export function logReturns(s: Series): number[] {
  const px = s.adjusted?.length === s.closes.length ? s.adjusted : s.closes;
  const out: number[] = [];
  for (let i = 1; i < px.length; i++) {
    const r = Math.log(px[i] / px[i - 1]);
    if (Number.isFinite(r)) out.push(r);
  }
  return out;
}

/** The returns with their average taken out: the shape of the moves, without assuming the trend goes on. */
export function demean(returns: number[]): number[] {
  if (!returns.length) return [];
  const mean = returns.reduce((t, r) => t + r, 0) / returns.length;
  return returns.map(r => r - mean);
}

const std = (xs: number[]) => {
  if (xs.length < 2) return 0;
  const m = xs.reduce((t, x) => t + x, 0) / xs.length;
  return Math.sqrt(xs.reduce((t, x) => t + (x - m) ** 2, 0) / (xs.length - 1));
};

/** Where the price is and how it has moved. Null for a history too short to say (under 30 days). */
export function seriesStats(s: Series): SeriesStats | null {
  const n = s.closes.length;
  if (n < 30 || s.dates.length !== n) return null;
  const asOf = s.dates[n - 1];
  const price = s.closes[n - 1];
  const span = Math.max(1, daysBetween(s.dates[0], asOf));
  const perYear = Math.round(((n - 1) / span) * 365);
  const yearAgo = Date.parse(asOf) - 365 * DAY;
  let high = -Infinity, low = Infinity, highOn = asOf, lowOn = asOf;
  for (let i = 0; i < n; i++) {
    if (Date.parse(s.dates[i]) < yearAgo) continue;
    if (s.closes[i] > high) { high = s.closes[i]; highOn = s.dates[i]; }
    if (s.closes[i] < low) { low = s.closes[i]; lowOn = s.dates[i]; }
  }
  const back = (days: number): number | null => {
    const t = Date.parse(asOf) - days * DAY;
    if (Date.parse(s.dates[0]) > t + 3 * DAY) return null;
    // The last close on or before the day.
    let i = n - 1;
    while (i > 0 && Date.parse(s.dates[i]) > t) i--;
    return price / s.closes[i] - 1;
  };
  return {
    price, asOf, high, highOn, low, lowOn,
    change30: back(30), change90: back(90), change365: back(365),
    vol: std(logReturns(s)) * Math.sqrt(perYear),
    perYear,
  };
}

/** Trading days in a stretch of calendar days, for an instrument that trades `perYear` days a year. */
export const tradingDays = (calendarDays: number, perYear: number) => Math.max(1, Math.round((Math.max(0, calendarDays) * perYear) / 365));

export const money = (n: number, currency: string) => {
  const d = n >= 1000 ? 0 : n >= 1 ? 2 : 4;
  return `${currency === 'USD' ? '$' : ''}${n.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: n >= 1000 ? 0 : Math.min(d, 2) })}${currency && currency !== 'USD' ? ` ${currency}` : ''}`;
};

/** The last `days` calendar days of a history: the recent past the baseline is read from. */
export function recent(s: Series, days = 730): Series {
  const n = s.dates.length;
  if (!n) return s;
  const from = Date.parse(s.dates[n - 1]) - days * DAY;
  const i = s.dates.findIndex(d => Date.parse(d) >= from);
  if (i <= 0) return s;
  return { ...s, dates: s.dates.slice(i), closes: s.closes.slice(i), ...(s.adjusted ? { adjusted: s.adjusted.slice(i) } : {}) };
}

/** A price as the prompts and the panel say it: "$119.57", "4,512", "1.0842 EUR". */
export const priceText = money;
