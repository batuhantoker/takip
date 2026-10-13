/*
 * Labelled marks along a timeline: hours for a day, days for a month, months for a year, then years,
 * decades and millennia, at whatever spacing fits the track. Deep time gets round millions of years.
 */

export type Tick = { at: number; label: string };

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');

type Unit = { kind: 'minute' | 'hour' | 'day' | 'month' | 'year'; n: number; ms: number };

const UNITS: Unit[] = [
  ...[15, 30].map(n => ({ kind: 'minute' as const, n, ms: n * MIN })),
  ...[1, 2, 3, 6, 12].map(n => ({ kind: 'hour' as const, n, ms: n * HOUR })),
  ...[1, 2, 5, 10].map(n => ({ kind: 'day' as const, n, ms: n * DAY })),
  ...[1, 2, 3, 6].map(n => ({ kind: 'month' as const, n, ms: n * 30.44 * DAY })),
  ...[1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000].map(n => ({ kind: 'year' as const, n, ms: n * 365.25 * DAY })),
];

function utc(year: number, month = 0, day = 1) {
  const d = new Date(0);
  d.setUTCFullYear(year, month, day);
  return d.getTime();
}

// JS years are astronomical (0 is 1 BCE); `h` counts as historians do, with no year 0.
const yearOfH = (h: number) => (h > 0 ? h : h === 0 ? 1 : h + 1);
const hOfYear = (y: number) => (y > 0 ? y : y - 1);

export function yearLabel(h: number) {
  if (h > 0) return String(h);
  if (h === 0) return '1 CE';
  return `${-h >= 10_000 ? (-h).toLocaleString('en') : -h} BCE`;
}

function dayLabel(t: number) {
  const d = new Date(t);
  if (d.getUTCMonth() === 0 && d.getUTCDate() === 1) return yearLabel(hOfYear(d.getUTCFullYear()));
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

function clockMarks(unit: Unit, lo: number, hi: number): Tick[] {
  const out: Tick[] = [];
  for (let t = Math.ceil(lo / unit.ms) * unit.ms; t <= hi; t += unit.ms) {
    const d = new Date(t);
    const midnight = d.getUTCHours() === 0 && d.getUTCMinutes() === 0;
    out.push({ at: t, label: midnight ? dayLabel(t) : `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` });
  }
  return out;
}

function dayMarks(n: number, lo: number, hi: number): Tick[] {
  const out: Tick[] = [];
  const s = new Date(lo);
  for (let t = utc(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate()); t <= hi; t += DAY) {
    const d = new Date(t);
    const date = d.getUTCDate();
    const monthDays = new Date(utc(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    // Every n days from the 1st, leaving out a last mark that would crowd the next month's 1st.
    if (t >= lo && (date - 1) % n === 0 && (n === 1 || date + n - 1 <= monthDays)) out.push({ at: t, label: dayLabel(t) });
  }
  return out;
}

function monthMarks(n: number, lo: number, hi: number): Tick[] {
  const out: Tick[] = [];
  const s = new Date(lo);
  for (let m = s.getUTCMonth(); ; m++) {
    const t = utc(s.getUTCFullYear(), m);
    if (t > hi) return out;
    const month = new Date(t).getUTCMonth();
    if (t >= lo && month % n === 0) out.push({ at: t, label: month === 0 ? yearLabel(hOfYear(new Date(t).getUTCFullYear())) : MONTHS[month] });
  }
}

function yearMarks(n: number, lo: number, hi: number): Tick[] {
  const out: Tick[] = [];
  for (let h = Math.ceil(hOfYear(new Date(lo).getUTCFullYear()) / n) * n; ; h += n) {
    if (h === 0 && n === 1) continue;
    const t = utc(yearOfH(h));
    if (t > hi) return out;
    if (t >= lo) out.push({ at: t, label: yearLabel(h) });
  }
}

/** Calendar marks for epoch ms from `lo` to `hi`, at most `max` of them. */
export function calendarTicks(lo: number, hi: number, max: number): Tick[] {
  if (!(hi > lo) || max < 1) return [];
  const unit = UNITS.find(u => (hi - lo) / u.ms <= max) ?? UNITS[UNITS.length - 1];
  switch (unit.kind) {
    case 'minute':
    case 'hour': return clockMarks(unit, lo, hi);
    case 'day': return dayMarks(unit.n, lo, hi);
    case 'month': return monthMarks(unit.n, lo, hi);
    default: return yearMarks(unit.n, lo, hi);
  }
}

const MA_STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500];

/** Deep-time marks for a clock in years from today (negative into the past), at most `max` of them. */
export function deepTicks(lo: number, hi: number, max: number): Tick[] {
  const span = (hi - lo) / 1e6;
  if (!(span > 0) || max < 1) return [];
  const step = MA_STEPS.find(s => span / s <= max) ?? MA_STEPS[MA_STEPS.length - 1];
  const out: Tick[] = [];
  for (let ma = Math.ceil(-hi / 1e6 / step) * step; ma * 1e6 <= -lo; ma += step) {
    out.push({ at: -ma * 1e6, label: ma === 0 ? 'Now' : `${ma.toLocaleString('en')} Ma` });
  }
  return out.reverse();
}
