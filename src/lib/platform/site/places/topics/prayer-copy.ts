import { msg, type Translate } from '@/lib/core/i18n/translator';
import { count, listOf } from '../copy/format';
import type { PrayerMethod } from './prayer-methods';
import type { PrayerKey } from './prayer-times';
import { clockIn, compassWord } from './sky-copy';

/** The prayer-times page's words: prayer names, waits, Hijri dates, the Qibla and the method's rules. */

export const PRAYER_LABEL: Record<PrayerKey, string> = {
  fajr: msg('Fajr'), sunrise: msg('prayer|Sunrise'), dhuhr: msg('Dhuhr'), asr: msg('Asr'), maghrib: msg('Maghrib'), isha: msg('Isha'),
};

/** A time on the place's clock; a dash where none could be worked out. */
export const prayerClock = (ms: number, tz: string, t: Translate) => (Number.isFinite(ms) ? clockIn(ms, tz, t) : '–');

/** "in 2 h 05 min" */
export function waitOf(ms: number, t: Translate): string {
  const min = Math.floor(ms / 60_000);
  if (min < 1) return t('in less than a minute');
  if (min < 60) return t('in {m} min', { m: min });
  return t('in {h} h {m} min', { h: Math.floor(min / 60), m: String(min % 60).padStart(2, '0') });
}

const intlOf = (t: Translate) => (t.locale === 'en' ? 'en-GB' : t.intl);

/** "10 Jumada I 1448 AH" in the reader's language. */
export const hijriIn = (date: string, t: Translate) =>
  new Intl.DateTimeFormat(intlOf(t), { calendar: 'islamic-umalqura', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(Date.parse(`${date}T12:00:00Z`));

/** "Wed 21 Oct", for the timetable's rows. */
export const shortDay = (date: string, t: Translate) =>
  new Intl.DateTimeFormat(intlOf(t), { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(Date.parse(`${date}T12:00:00Z`));

/** "Monday 8 February" */
export const longDay = (date: string, t: Translate) =>
  new Intl.DateTimeFormat(intlOf(t), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(Date.parse(`${date}T12:00:00Z`));

/** "151.6°" */
export const degreesOf = (deg: number, t: Translate) =>
  t('{deg}°', { deg: new Intl.NumberFormat(t.intl, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(deg) });

const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
export const compassOf = (deg: number, t: Translate) => compassWord(POINTS[Math.round(deg / 45) % 8], t);

/** Within this of the Kaaba a bearing means nothing: the city is Mecca. */
export const AT_THE_KAABA_KM = 25;

/** "Fajr when the Sun is 18° below the horizon and Isha at 17°, with these margins: Dhuhr +1 min", from the method's own parameters. */
export function methodRules(method: PrayerMethod, t: Translate): string {
  const p = method.params();
  const rules = [
    t('Fajr when the Sun is {deg}° below the horizon', { deg: count(p.fajrAngle, t) }),
    ...(p.maghribAngle ? [t('Maghrib at {deg}°', { deg: count(p.maghribAngle, t) })] : []),
    p.ishaInterval > 0 ? t('Isha {min} minutes after Maghrib', { min: p.ishaInterval }) : t('Isha at {deg}°', { deg: count(p.ishaAngle, t) }),
  ];
  const shifts = (Object.entries(p.methodAdjustments) as [PrayerKey, number][]).filter(([, n]) => n);
  const shifted = shifts.map(([k, n]) => (n > 0 ? t('{prayer} +{n} min', { prayer: t(PRAYER_LABEL[k]), n }) : t('{prayer} −{n} min', { prayer: t(PRAYER_LABEL[k]), n: -n })));
  return shifted.length
    ? t('{rules}, with these margins: {shifts}', { rules: listOf(rules, t), shifts: listOf(shifted, t) })
    : listOf(rules, t);
}
