import { type Series, demean, seriesStats, tradingDays } from './series';
import { rng, seedOf } from './paths';

/** How the baseline would have done on an instrument's own past. */
export interface Backtest {
  /** Forecasts scored, and the days they were made on. */
  n: number;
  starts: number;
  from: string;
  to: string;
  /** How far ahead each forecast looked, in calendar days. */
  days: number;
  /**
   * Brier score of the baseline, and of hindsight: each level's plain rate
   * over the whole test period, which no forecaster had at the time. Matching
   * hindsight from the past alone is doing well.
   */
  brier: number;
  reference: number;
  /** 1 − brier / reference: above 0, the baseline beat hindsight. */
  skill: number;
  /** How far, on average over every forecast, what it said was from how often it happened: its calibration gap. */
  gap: number;
  /** Forecasts grouped by what they said, against how often it happened. */
  bins: { lo: number; hi: number; said: number; happened: number; n: number }[];
}

const BINS: [number, number][] = [[0, 0.02], [0.02, 0.05], [0.05, 0.1], [0.1, 0.2], [0.2, 0.35], [0.35, 0.5], [0.5, 0.7], [0.7, 1.0001]];

/**
 * The baseline, scored on the instrument's own past. On days spread through
 * the history, it forecasts from the year of prices before that day only (no
 * look-ahead) whether the price would trade at each of a set of levels (10%
 * to 100% above it, 10% to 50% below it) within `days`; then the record says
 * whether it did. The windows overlap, so the forecasts are not independent:
 * a sample of how the method behaves on this instrument, not a proof.
 * Null when the history is too short to test on.
 */
export function backtest(s: Series, days: number, opts: { every?: number; paths?: number; ratios?: number[] } = {}): Backtest | null {
  const stats = seriesStats(s);
  if (!stats || !(days > 0)) return null;
  const px = s.adjusted?.length === s.closes.length ? s.adjusted : s.closes;
  const r: number[] = [];
  for (let i = 1; i < px.length; i++) r.push(Math.log(px[i] / px[i - 1]));
  const look = stats.perYear;
  const ahead = tradingDays(days, stats.perYear);
  const every = opts.every ?? Math.max(1, Math.round(ahead / 12));
  const paths = opts.paths ?? 300;
  const ratios = opts.ratios ?? [1.1, 1.2, 1.35, 1.5, 1.75, 2, 0.9, 0.8, 0.7, 0.6, 0.5];
  const draw = rng(seedOf(`${s.symbol}:backtest`));
  const said: number[][] = ratios.map(() => []);
  const happened: number[][] = ratios.map(() => []);
  let starts = 0, first = -1, last = -1;
  for (let t = look; t + ahead < px.length; t += every) {
    // What was known on day t: the year of moves before it, demeaned.
    const window = demean(r.slice(t - look, t));
    const hi = new Float64Array(paths), lo = new Float64Array(paths);
    for (let p = 0; p < paths; p++) {
      let x = 0, h = 0, l = 0;
      for (let d = 0; d < ahead; d++) {
        x += window[Math.floor(draw() * window.length)];
        if (x > h) h = x;
        if (x < l) l = x;
      }
      hi[p] = Math.exp(h);
      lo[p] = Math.exp(l);
    }
    // What then happened.
    let top = 1, bottom = 1;
    for (let d = 1; d <= ahead; d++) {
      const m = px[t + d] / px[t];
      if (m > top) top = m;
      if (m < bottom) bottom = m;
    }
    ratios.forEach((k, j) => {
      let hits = 0;
      for (let p = 0; p < paths; p++) if (k >= 1 ? hi[p] >= k : lo[p] <= k) hits++;
      said[j].push(hits / paths);
      happened[j].push((k >= 1 ? top >= k : bottom <= k) ? 1 : 0);
    });
    starts++;
    if (first < 0) first = t;
    last = t;
  }
  if (starts < 10) return null;
  let brier = 0, reference = 0, n = 0;
  const bins = BINS.map(([lo, hi]) => ({ lo, hi: Math.min(1, hi), saidSum: 0, hitSum: 0, n: 0 }));
  ratios.forEach((_, j) => {
    const rate = happened[j].reduce((t, o) => t + o, 0) / happened[j].length;
    said[j].forEach((p, i) => {
      const o = happened[j][i];
      brier += (p - o) ** 2;
      reference += (rate - o) ** 2;
      n++;
      const b = bins.find(x => p >= x.lo && p < x.hi + (x.hi >= 1 ? 1e-9 : 0)) ?? bins[bins.length - 1];
      b.saidSum += p;
      b.hitSum += o;
      b.n++;
    });
  });
  brier /= n;
  reference /= n;
  return {
    n, starts, from: s.dates[first], to: s.dates[last], days,
    brier, reference, skill: reference > 0 ? 1 - brier / reference : 0,
    gap: bins.reduce((t, b) => t + (b.n ? Math.abs(b.saidSum - b.hitSum) : 0), 0) / n,
    bins: bins.filter(b => b.n > 0).map(b => ({ lo: b.lo, hi: b.hi, said: b.saidSum / b.n, happened: b.hitSum / b.n, n: b.n })),
  };
}

const pctOf = (p: number) => `${p < 0.1 ? Math.round(p * 1000) / 10 : Math.round(p * 100)}%`;

/**
 * The record in words: how far off it ran on average, and what happened
 * when it said about what it says now (`p`, the baseline's own figure).
 */
export function recordSentence(b: Pick<Backtest, 'n' | 'starts' | 'from' | 'to' | 'days' | 'gap' | 'bins' | 'brier' | 'reference'>, symbol: string, p?: number): string {
  const band = p === undefined ? undefined : b.bins.find(x => p >= x.lo && p <= x.hi);
  const years = `${b.from.slice(0, 4)}–${b.to.slice(0, 4)}`;
  return [
    `Tested on ${b.n.toLocaleString('en-US')} past forecasts of ${symbol} (made on ${b.starts} days, ${years}, each from the year of prices before it, ${b.days} days ahead): what it said was ${Math.round(b.gap * 1000) / 10} points from what happened, on average.`,
    band ? ` When it said ${Math.round(band.lo * 100)}–${Math.round(band.hi * 100)}%, as it does now, it happened ${pctOf(band.happened)} of the time (${band.n} forecasts).` : '',
    ` Brier ${b.brier.toFixed(3)}, against ${b.reference.toFixed(3)} for hindsight (how often each move really happened over the whole period, which no one knew in advance).`,
  ].join('');
}
