const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

export function bytes(n: number | null | undefined) {
  if (n == null) return '—';
  let value = n;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value >= 100 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${UNITS[unit]}`;
}

export const count = (n: number | null | undefined) => (n == null ? '—' : Math.round(n).toLocaleString('en'));

/** "1 account", "3 accounts" */
export const plural = (n: number, one: string, many = `${one}s`) => `${count(n)} ${Math.round(n) === 1 ? one : many}`;

/** 1,284 / 12.9K / 4.2M */
export function compact(n: number | null | undefined) {
  if (n == null) return '—';
  return Math.abs(n) < 1000 ? String(Math.round(n * 10) / 10) : n.toLocaleString('en', { notation: 'compact', maximumFractionDigits: 1 });
}

/** "45 min", "3 h 12 min", "4 d 2 h" */
export function minutes(n: number | null | undefined) {
  if (n == null) return '—';
  const m = Math.round(n);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${d} d ${h % 24} h` : `${d} d`;
}

/** "50 min", "1.7 h": short enough for a chart's axis, where minutes() would wrap. */
export const minutesAxis = (n: number) => (n < 60 ? `${Math.round(n)} min` : `${Number((n / 60).toFixed(n < 600 ? 1 : 0))} h`);

export function duration(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s`;
  return minutes(s / 60);
}

export function pct(part: number, whole: number, digits = 0) {
  if (!whole) return '—';
  return `${((part / whole) * 100).toFixed(digits)}%`;
}

export const ms = (n: number | null | undefined) => (n == null ? '—' : n < 10 ? `${n.toFixed(1)} ms` : `${Math.round(n)} ms`);

/** '2026-10-19' → '19 Oct' */
export const shortDay = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString('en', { timeZone: 'UTC', day: 'numeric', month: 'short' });

export const longDay = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString('en', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

export const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

/** Index of the first day with minutes recorded; the series' length when none has. */
export function sinceIndex(days: { day: string }[], since: string | null) {
  const i = since ? days.findIndex(d => d.day >= since) : -1;
  return i < 0 ? days.length : i;
}

/** Last 7 days against the 7 before, from the start of the series; null when the earlier window isn't all there. */
export function weekDelta(values: number[], firstValid = 0) {
  if (values.length < 14 || values.length - 14 < firstValid) return null;
  const recent = sum(values.slice(-7));
  const prior = sum(values.slice(-14, -7));
  return { recent, prior };
}

/**
 * Where a chart starts: the first point any series has data, keeping at least `min` points, so a range that
 * began before collecting doesn't open on weeks of zeros.
 */
export function firstWithData(series: number[][], min = 7) {
  const n = Math.max(0, ...series.map(s => s.length));
  let i = 0;
  while (i < n && series.every(s => !s[i])) i++;
  return Math.max(0, Math.min(i, n - min));
}

/** A clean axis top: 1, 2, 2.5 or 5 × 10^k at or above `max`. */
export function niceMax(max: number) {
  if (max <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(max)));
  for (const step of [1, 2, 2.5, 5, 10]) if (step * exp >= max) return step * exp;
  return 10 * exp;
}
