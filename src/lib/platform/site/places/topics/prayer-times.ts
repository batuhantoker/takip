import { Coordinates, HighLatitudeRule, Madhab, PolarCircleResolution, PrayerTimes, Qibla, Rounding, type CalculationParameters } from 'adhan';
import { addDays, hijriOf, RAMADAN, type HijriDate } from './prayer-hijri';
import { methodFor, type PrayerMethod } from './prayer-methods';
import { kmBetween } from './sky-rules';
import { zoneOffset } from './sky-time';
import { localNoon } from './sun-report';
import { shadowTime } from './sun-times';

/**
 * A place's prayer times for a run of days, from the adhan library (Meeus's equations) with its country's method.
 * Times are epoch ms; the copy turns them into the place's own clock.
 */

export const PRAYERS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
export type PrayerKey = (typeof PRAYERS)[number];

export interface PrayerDay {
  /** The place's calendar day, YYYY-MM-DD. */
  date: string;
  hijri: HijriDate;
  times: Record<PrayerKey, number>;
  /** Asr by the other school than `times.asr`. */
  asrOther: number;
  /** Fajr or Isha held to a seventh of the night where twilight runs long. */
  held: { fajr: boolean; isha: boolean };
  /** The Sun doesn't rise or doesn't set that day: times from the nearest latitude where it does. */
  polar: boolean;
}

export type HighLatitude = 'seventh' | 'middle' | 'moonsighting';

export interface PrayerReport {
  method: PrayerMethod;
  rule: HighLatitude;
  days: PrayerDay[];
}

const KAABA = { lat: 21.4225241, lng: 39.8261818 };

/** Degrees from true north along the great circle, and how far, in km. */
export function qiblaOf(lat: number, lon: number): { bearing: number; km: number } {
  return { bearing: Qibla(new Coordinates(lat, lon)), km: kmBetween({ lat, lng: lon }, KAABA) };
}

/** adhan's rule for the latitude; it compares the signed latitude, so the south needs its absolute value. */
export function highLatitudeOf(lat: number, method: PrayerMethod): HighLatitude {
  if (method.id === 'moonsighting') return 'moonsighting';
  return HighLatitudeRule.recommended(new Coordinates(Math.abs(lat), 0)) === HighLatitudeRule.SeventhOfTheNight ? 'seventh' : 'middle';
}

const RULE = { seventh: HighLatitudeRule.SeventhOfTheNight, middle: HighLatitudeRule.MiddleOfTheNight, moonsighting: HighLatitudeRule.MiddleOfTheNight };

const valid = (p: PrayerTimes) => PRAYERS.every(k => Number.isFinite(p[k].getTime()));

/**
 * The date adhan needs for the place's calendar day: its solar day is the UTC date's, so a clock a day away from its
 * longitude (Samoa, Kiribati's Line Islands) asks for the day before.
 */
export function solarDate(date: string, tz: string, lon: number): string {
  const ahead = zoneOffset(localNoon(date, tz), tz) / 3_600_000 - lon / 15;
  return addDays(date, -Math.round(ahead / 24));
}

function timesOn(at: Coordinates, date: string, params: CalculationParameters): { p: PrayerTimes; polar: boolean } {
  const [y, m, d] = date.split('-').map(Number);
  // adhan reads the date's local year, month and day, whatever the server's zone.
  const day = new Date(y, m - 1, d);
  const p = new PrayerTimes(at, day, params);
  if (valid(p)) return { p, polar: false };
  // moonsighting.com's FAQ (§2.6) moves to the nearest latitude where the Sun rises and sets: aqrab al-bilad.
  params.polarCircleResolution = PolarCircleResolution.AqrabBalad;
  const resolved = new PrayerTimes(at, day, params);
  params.polarCircleResolution = PolarCircleResolution.Unresolved;
  return { p: resolved, polar: true };
}

/**
 * Asr from the shadow at that day's noon. adhan takes the Sun's declination at the day's start instead, which put Asr a
 * minute or more early, three at Moscow: too early for a time a prayer mustn't come before.
 */
function asrAt(lat: number, lon: number, noon: number, school: PrayerMethod['asr'], params: CalculationParameters, fallback: Date): number {
  const t = shadowTime(lat, lon, noon, school === 'hanafi' ? 2 : 1);
  if (t === null) return fallback.getTime();
  const at = t + ((params.methodAdjustments.asr ?? 0) + (params.adjustments.asr ?? 0)) * 60_000;
  // Rounded up, never to a minute before Asr has begun.
  return params.rounding === Rounding.None ? at : Math.ceil(at / 60_000) * 60_000;
}

/** `count` days from `from`, the place's calendar day on its clock `tz`, at a place in country `cc`. */
export function prayerDays(lat: number, lon: number, cc: string, tz: string, from: string, count: number): PrayerReport {
  const method = methodFor(cc);
  const rule = highLatitudeOf(lat, method);
  const at = new Coordinates(lat, lon);
  const days: PrayerDay[] = [];
  for (let i = 0; i < count; i++) {
    const date = addDays(from, i);
    const hijri = hijriOf(date);
    const params = method.params();
    params.highLatitudeRule = RULE[rule];
    // adhan: add 30 minutes to Umm al-Qura's Isha in Ramadan, when its timetable has Isha two hours after Maghrib.
    if (method.id === 'ummAlQura' && hijri.month === RAMADAN) params.adjustments.isha = 30;
    params.madhab = method.asr === 'hanafi' ? Madhab.Hanafi : Madhab.Shafi;
    const solar = solarDate(date, tz, lon);
    const { p, polar } = timesOn(at, solar, params);
    params.madhab = method.asr === 'hanafi' ? Madhab.Shafi : Madhab.Hanafi;
    const other = timesOn(at, solar, params).p;
    let held = { fajr: false, isha: false };
    if (rule === 'seventh' && !polar) {
      // The seventh only shows where it moved a time: against the looser middle-of-the-night bound.
      params.highLatitudeRule = HighLatitudeRule.MiddleOfTheNight;
      const loose = timesOn(at, solar, params).p;
      held = { fajr: +loose.fajr !== +p.fajr, isha: +loose.isha !== +p.isha };
    }
    const times = Object.fromEntries(PRAYERS.map(k => [k, p[k].getTime()])) as Record<PrayerKey, number>;
    let asrOther = other.asr.getTime();
    if (!polar) {
      const noon = localNoon(date, tz);
      times.asr = asrAt(lat, lon, noon, method.asr, params, p.asr);
      asrOther = asrAt(lat, lon, noon, method.asr === 'hanafi' ? 'standard' : 'hanafi', params, other.asr);
    }
    days.push({ date, hijri, times, asrOther, held, polar });
  }
  return { method, rule, days };
}

export type PrayerName = Exclude<PrayerKey, 'sunrise'>;
const FIVE: PrayerName[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

/** The next of the five prayers after `now`, from today's and the following days' times. */
export function nextPrayer(days: PrayerDay[], now: number): { prayer: PrayerName; at: number } | null {
  for (const d of days) {
    for (const prayer of FIVE) if (d.times[prayer] > now) return { prayer, at: d.times[prayer] };
  }
  return null;
}
