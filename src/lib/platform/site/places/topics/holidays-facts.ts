import type { HolidayEntry, HolidayName, HolidayRow } from './holidays-data';
import { addDays, daysBetween, holidayYear, isoDay, lastDay } from './holidays-rules';

/** A country's pages are indexed with this many days of national public holidays in each checked year. */
export const HOLIDAY_INDEX = { nationalDays: 6 } as const;

/** A run of days off: weekends and holidays together. */
export interface DayRun {
  from: string;
  to: string;
  days: number;
  /** The holidays in it, in order. */
  names: HolidayName[];
}

/** One working day that joins a holiday to a weekend: taking it off gives `run`. */
export interface Bridge { day: string; run: DayRun; half: boolean }

export interface YearFacts {
  /** National public holiday days, substitutes and half days aside. */
  holidays: number;
  /** Of those, the ones on working days. */
  onWeekdays: number;
  /** Working days off that stand in for a holiday on a weekend. */
  substitutes: number;
  /** Half days (from 13:00, say) on working days. */
  halfDays: number;
  /** Holidays kept only in some regions. */
  regional: number;
  /** Whether a holiday lasts more than a day, so they are counted in days. */
  multiDay: boolean;
  longWeekends: DayRun[];
  bridges: Bridge[];
  /** The longest run of days off with a holiday in it. */
  longest?: DayRun;
}

/** Everywhere, the whole day, and a holiday rather than a day banks close or one worked in exchange. */
const nationalFull = (e: HolidayEntry) => e.t === 'p' && !e.from && !e.r;

const memo = new WeakMap<HolidayRow, Map<number, YearFacts | null>>();

/** What the year's holidays add up to, counting the country's own weekend and only what applies everywhere. */
export function yearFacts(row: HolidayRow, year: number): YearFacts | null {
  let held = memo.get(row);
  if (!held) memo.set(row, (held = new Map()));
  if (!held.has(year)) held.set(year, factsOf(row, year));
  return held.get(year)!;
}

function factsOf(row: HolidayRow, year: number): YearFacts | null {
  const days = holidayYear(row, year)?.days;
  if (!days) return null;
  const weekend = new Set(row.weekend);
  const inYear = (d: string) => d.startsWith(String(year));
  // Neighbouring years' holidays, so a break across New Year is whole.
  const near = [year - 1, year, year + 1].flatMap(y => (y === year ? days : holidayYear(row, y)?.days ?? []));
  const off = new Map<string, HolidayName>();
  const worked = new Set<string>();
  for (const e of near) {
    if (e.t === 'w') worked.add(e.d);
    if (!nationalFull(e)) continue;
    for (let i = 0; i < (e.n ?? 1); i++) if (!off.has(addDays(e.d, i))) off.set(addDays(e.d, i), e.name);
  }
  const isWeekend = (d: string) => weekend.has(isoDay(d)) && !worked.has(d);
  const isOff = (d: string) => off.has(d) || isWeekend(d);

  // By date: a holiday can share its day with another (19 May is also Kurban Bayramı's fourth day in 2027).
  const holidayDays = new Set<string>();
  const subDays = new Set<string>();
  let halfDays = 0;
  for (const e of days) {
    if (e.t !== 'p' || e.r) continue;
    if (e.from) {
      if (!isOff(e.d)) halfDays++;
      continue;
    }
    for (let i = 0; i < (e.n ?? 1); i++) {
      const d = addDays(e.d, i);
      if (inYear(d)) (e.sub ? subDays : holidayDays).add(d);
    }
  }
  const holidays = holidayDays.size;
  const onWeekdays = [...holidayDays].filter(d => !isWeekend(d)).length;
  const substitutes = [...subDays].filter(d => !isWeekend(d) && !holidayDays.has(d)).length;

  const runAt = (d: string): DayRun => {
    let from = d;
    let to = d;
    while (isOff(addDays(from, -1))) from = addDays(from, -1);
    while (isOff(addDays(to, 1))) to = addDays(to, 1);
    const names: HolidayName[] = [];
    for (let x = from; x <= to; x = addDays(x, 1)) {
      const n = off.get(x);
      if (n && !names.some(m => m.local === n.local)) names.push(n);
    }
    return { from, to, days: daysBetween(from, to) + 1, names };
  };

  const longWeekends: DayRun[] = [];
  const bridges: Bridge[] = [];
  const halfOn = new Set(days.filter(e => e.t === 'p' && e.from && !e.r).map(e => e.d));
  for (let d = `${year}-01-01`; inYear(d); d = addDays(d, 1)) {
    if (isOff(d)) {
      // A break from December counts here too where it holds a holiday of this year.
      if (isOff(addDays(d, -1)) && !d.endsWith('-01-01')) continue;
      const run = runAt(d);
      if (run.days >= 3 && [...Array(run.days).keys()].some(i => inYear(addDays(run.from, i)) && off.has(addDays(run.from, i)))) longWeekends.push(run);
      continue;
    }
    const before = addDays(d, -1);
    const after = addDays(d, 1);
    if (!isOff(before) || !isOff(after)) continue;
    const a = runAt(before);
    const b = runAt(after);
    if (!a.names.length && !b.names.length) continue;
    bridges.push({ day: d, half: halfOn.has(d), run: { from: a.from, to: b.to, days: a.days + 1 + b.days, names: [...a.names, ...b.names.filter(n => !a.names.some(m => m.local === n.local))] } });
  }

  const longest = longWeekends.reduce<DayRun | undefined>((best, r) => (!best || r.days > best.days ? r : best), undefined);
  return {
    holidays, onWeekdays, substitutes, halfDays, regional: days.filter(e => e.t === 'p' && e.r).length,
    multiDay: days.some(e => e.t === 'p' && !e.r && (e.n ?? 1) > 1), longWeekends, bridges, longest,
  };
}

/** Full working days off in a region over the year, substitutes included: how GOV.UK counts each nation's bank holidays. */
export function regionDaysOff(row: HolidayRow, year: number, region: string): number {
  const weekend = new Set(row.weekend);
  const out = new Set<string>();
  for (const e of holidayYear(row, year)?.days ?? []) {
    if (e.t !== 'p' || e.from || (e.r && !e.r.includes(region))) continue;
    for (let i = 0; i < (e.n ?? 1); i++) {
      const d = addDays(e.d, i);
      if (d.startsWith(String(year)) && !weekend.has(isoDay(d))) out.add(d);
    }
  }
  return out.size;
}

/** The next national holiday on or after `today` (the country's date), with the days to it; 0 is today. */
export function nextHoliday(row: HolidayRow, today: string): { entry: HolidayEntry; days: number } | null {
  const year = Number(today.slice(0, 4));
  for (const y of [year, year + 1]) {
    for (const e of holidayYear(row, y)?.days ?? []) {
      if (e.t !== 'p' || e.r || lastDay(e) < today) continue;
      return { entry: e, days: Math.max(0, daysBetween(today, e.d)) };
    }
  }
  return null;
}
