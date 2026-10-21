import { monthsOf } from '../../jewish-holidays';
import { addDays } from './prayer-hijri';
import { localNoon } from './sun-report';
import { eveningAt, riseSet } from './sun-times';

/**
 * Candle lighting and havdalah for Shabbat and yom tov, Hebcal's way: candles a set number of minutes before sunset,
 * the minute of sunset taken first; havdalah, and a second day's candles, when the Sun is 8.5° below the horizon and
 * three small stars show (tzeit hakochavim, hebcal.com/home/94), to the nearest minute (hebcal-es6 src/zmanim.ts).
 * Holidays from ICU's Hebrew calendar by its numbers alone (jewish-holidays.ts), with a second day outside Israel.
 */

export const TZEIT = -8.5;
// hebcal-web src/urlArgs.js: 18 minutes, 20 in Israel, 40 in Jerusalem, 30 in Haifa and Zikhron Ya'akov (GeoNames ids).
const CITY_MINUTES: Record<number, number> = { 281184: 40, 294801: 30, 293067: 30 };

export const candleMinutes = (placeId: number, israel: boolean) => CITY_MINUTES[placeId] ?? (israel ? 20 : 18);

export type Holiday = 'rosh-hashanah' | 'yom-kippur' | 'sukkot' | 'shemini-atzeret' | 'simchat-torah' | 'pesach' | 'pesach-end' | 'shavuot';

/** A day of rest: Shabbat, a holiday, or both. */
export interface HolyDay { shabbat: boolean; holiday: Holiday | null }

export interface ShabbatEvent {
  /** The civil day whose evening it falls on, YYYY-MM-DD. */
  date: string;
  kind: 'candles' | 'havdalah';
  at: number | null;
  /** What begins (candles) or ends (havdalah). */
  for: HolyDay;
}

const hebrewYear = new Intl.DateTimeFormat('en-u-ca-hebrew-nu-latn', { year: 'numeric', timeZone: 'UTC' });

/** A civil day's Hebrew month, as Tishri, Nisan or Sivan or none, and day, from jewish-holidays.ts's month starts. */
function hebrewOf(date: string): { month: 'tishri' | 'nisan' | 'sivan' | null; day: number } {
  const h = Number(hebrewYear.formatToParts(Date.parse(`${date}T12:00:00Z`)).find(p => p.type === 'year')!.value);
  const starts = monthsOf(h);
  let i = starts.length - 1;
  while (starts[i] > date) i--;
  const day = Math.round((Date.parse(date) - Date.parse(starts[i])) / 86_400_000) + 1;
  // Nisan is the seventh month from the year's end, Adar I or not.
  const nisan = starts.length - 6;
  return { month: i === 0 ? 'tishri' : i === nisan ? 'nisan' : i === nisan + 2 ? 'sivan' : null, day };
}

// Day one of each holiday, and the second day kept outside Israel.
const HOLIDAYS: { month: 'tishri' | 'nisan' | 'sivan'; day: number; holiday: Holiday; diasporaOnly?: true }[] = [
  { month: 'tishri', day: 1, holiday: 'rosh-hashanah' }, { month: 'tishri', day: 2, holiday: 'rosh-hashanah' },
  { month: 'tishri', day: 10, holiday: 'yom-kippur' },
  { month: 'tishri', day: 15, holiday: 'sukkot' }, { month: 'tishri', day: 16, holiday: 'sukkot', diasporaOnly: true },
  { month: 'tishri', day: 22, holiday: 'shemini-atzeret' }, { month: 'tishri', day: 23, holiday: 'simchat-torah', diasporaOnly: true },
  { month: 'nisan', day: 15, holiday: 'pesach' }, { month: 'nisan', day: 16, holiday: 'pesach', diasporaOnly: true },
  { month: 'nisan', day: 21, holiday: 'pesach-end' }, { month: 'nisan', day: 22, holiday: 'pesach-end', diasporaOnly: true },
  { month: 'sivan', day: 6, holiday: 'shavuot' }, { month: 'sivan', day: 7, holiday: 'shavuot', diasporaOnly: true },
];

export function holyDay(date: string, israel: boolean): HolyDay | null {
  const h = hebrewOf(date);
  const holiday = HOLIDAYS.find(x => x.month === h.month && x.day === h.day && (!x.diasporaOnly || !israel))?.holiday ?? null;
  const shabbat = new Date(`${date}T12:00:00Z`).getUTCDay() === 6;
  return shabbat || holiday ? { shabbat, holiday } : null;
}

const MIN = 60_000;

/**
 * Every candle lighting and havdalah whose evening falls from `from` to `to` (YYYY-MM-DD) at a place. Candles before
 * a day of rest that follows another are lit at nightfall, from an existing flame; before Shabbat, always before sunset.
 */
export function shabbatEvents(lat: number, lon: number, tz: string, placeId: number, israel: boolean, from: string, to: string): ShabbatEvent[] {
  const before = candleMinutes(placeId, israel) * MIN;
  const sunset = (d: string) => riseSet(lat, lon, localNoon(d, tz)).set;
  const tzeit = (d: string) => eveningAt(lat, lon, localNoon(d, tz), TZEIT);
  const lit = (c: ReturnType<typeof sunset>) => (typeof c === 'number' ? Math.floor(c / MIN) * MIN - before : null);
  const night = (c: ReturnType<typeof sunset>) => (typeof c === 'number' ? Math.round(c / MIN) * MIN : null);
  const out: ShabbatEvent[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const today = holyDay(d, israel);
    const tomorrow = holyDay(addDays(d, 1), israel);
    if (tomorrow) out.push({ date: d, kind: 'candles', for: tomorrow, at: today && !tomorrow.shabbat ? night(tzeit(d)) : lit(sunset(d)) });
    if (today && !tomorrow) out.push({ date: d, kind: 'havdalah', for: today, at: night(tzeit(d)) });
  }
  return out;
}
