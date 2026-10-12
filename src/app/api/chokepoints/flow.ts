/**
 * TAKIP — chokepoint transit anomaly: the last 7 days against the chokepoint's
 * own preceding ~90, after World Monitor's published method (facts only).
 *
 * Windows are anchored to the series' latest date, never to today: PortWatch
 * publishes weekly, so the newest row is routinely a week or more old.
 * The baseline is the chokepoint's own recent past, so a collapse older than
 * the window is rated against an already-collapsed norm (Hormuz, since 2026-03).
 */

export interface DailyTransit {
  /** `YYYY-MM-DD`, UTC. */
  date: string;
  total: number;
  tanker: number;
  cargo: number;
  /** Tanker deadweight tonnes. */
  tankerCapacity: number;
}

export type FlowBasis = 'capacity' | 'count';
export type FlowStatus = 'normal' | 'disrupted' | 'insufficient';

export interface FlowAssessment {
  latestDate: string | null;
  last7Mean: number | null;
  baselineMean: number | null;
  ratio: number | null;
  basis: FlowBasis;
  status: FlowStatus;
}

export const RECENT_DAYS = 7;
export const BASELINE_END_DAY = 97;
export const MIN_HISTORY_DAYS = 40;
export const MIN_RECENT_DAYS = 3;
export const MIN_BASELINE_DAYS = 20;
/** Mean vessels a day below which a baseline is noise: WM's own floor of 14 a week. */
export const MIN_BASELINE_TRANSITS = 2;
export const MAX_RATIO = 1.5;
export const DISRUPTED_FRACTION = 0.85;
export const DISRUPTED_RUN = 3;

const DAY_MS = 86_400_000;

function dayNumber(date: string): number {
  return Math.floor(Date.parse(`${date}T00:00:00Z`) / DAY_MS);
}

function mean(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function round(n: number, places: number): number {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

/** Tanker DWT when at least half the baseline days carry it, else total vessel counts. */
export function chooseBasis(baseline: DailyTransit[]): FlowBasis {
  if (!baseline.length) return 'count';
  const carrying = baseline.filter(d => d.tankerCapacity > 0).length;
  return carrying * 2 >= baseline.length ? 'capacity' : 'count';
}

export function assessFlow(series: DailyTransit[]): FlowAssessment {
  const byDay = new Map<number, DailyTransit>();
  for (const d of series) {
    const n = dayNumber(d.date);
    if (Number.isFinite(n)) byDay.set(n, d);
  }
  const days = [...byDay.keys()].sort((a, b) => b - a);
  if (!days.length) {
    return { latestDate: null, last7Mean: null, baselineMean: null, ratio: null, basis: 'count', status: 'insufficient' };
  }

  const latest = days[0];
  const recent: DailyTransit[] = [];
  const baseline: DailyTransit[] = [];
  for (const n of days) {
    const age = latest - n;
    if (age < RECENT_DAYS) recent.push(byDay.get(n)!);
    else if (age < BASELINE_END_DAY) baseline.push(byDay.get(n)!);
  }

  const basis = chooseBasis(baseline);
  const value = (d: DailyTransit) => (basis === 'capacity' ? d.tankerCapacity : d.total);
  const last7Mean = recent.length ? mean(recent.map(value)) : null;
  const baselineMean = baseline.length ? mean(baseline.map(value)) : null;

  const result = {
    latestDate: byDay.get(latest)!.date,
    last7Mean: last7Mean == null ? null : round(last7Mean, 2),
    baselineMean: baselineMean == null ? null : round(baselineMean, 2),
    basis,
  };
  if (
    days.length < MIN_HISTORY_DAYS ||
    recent.length < MIN_RECENT_DAYS ||
    baseline.length < MIN_BASELINE_DAYS ||
    mean(baseline.map(d => d.total)) < MIN_BASELINE_TRANSITS ||
    last7Mean == null ||
    !baselineMean
  ) {
    return { ...result, ratio: null, status: 'insufficient' };
  }

  const ratio = Math.min(MAX_RATIO, Math.max(0, last7Mean / baselineMean));
  // `recent` is newest-first, so its head is the last three days.
  const disrupted = recent.slice(0, DISRUPTED_RUN).every(d => value(d) < DISRUPTED_FRACTION * baselineMean);
  return { ...result, ratio: round(ratio, 3), status: disrupted ? 'disrupted' : 'normal' };
}
