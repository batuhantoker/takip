import { msg, type Translate } from '@/lib/core/i18n/translator';
import { count, DESCRIPTION_RANGE, fit, nameOf, placeFirst, placeName, TITLE_MAX } from '../copy/format';
import type { Place } from '../gazetteer';
import { topicTable } from '../tables';
import type { PlaceTopic, TopicPage } from '../topic';
import { muslimPages } from './faith-reach';
import { AT_THE_KAABA_KM, compassOf, degreesOf } from './prayer-copy';
import { methodFor } from './prayer-methods';
import { nextPrayer, prayerDays, qiblaOf, type PrayerName, type PrayerReport } from './prayer-times';
import type { IssRow } from './sky-data';
import { localClock } from './sky-time';
import { sunIndexed } from './sun';

/**
 * Prayer times at /city/<place>/prayer-times: today's and the next 30 days' by the country's method
 * (prayer-methods.ts), worked out when the page renders on the place's own clock (time zones from iss.json), with
 * the Qibla. Every city with a time zone has a page; indexed on the sunrise and sunset pages' bar.
 */

export interface PrayerData { tz: string }

export interface PrayerNow {
  at: number;
  report: PrayerReport;
  next: { prayer: PrayerName; at: number } | null;
}

export const PRAYER_DAYS = 30;

// Thirty days of times are a few hundred sums: kept per place and day so a crawl doesn't redo them.
const memo = new Map<string, PrayerReport>();

export function prayerToday(place: Place, tz: string, now = Date.now()): PrayerReport {
  const date = localClock(now, tz).date;
  const key = `${place.id}:${date}`;
  const held = memo.get(key);
  if (held) return held;
  const fresh = prayerDays(place.at[1], place.at[0], place.cc, tz, date, PRAYER_DAYS);
  if (memo.size > 2000) memo.clear();
  memo.set(key, fresh);
  return fresh;
}

/** "2,380 km": to the kilometre near Mecca, to ten beyond. */
export const kaabaKm = (km: number, t: Translate) => count(km < 100 ? Math.round(km) : Math.round(km / 10) * 10, t);

export const PRAYER: PlaceTopic<PrayerData, PrayerNow> = {
  id: 'prayer',
  label: msg('Prayer times'),
  inline: msg('prayer times'),
  kinds: ['city'],
  faith: true,

  pages(place) {
    const row = topicTable<IssRow>('iss').rows[place.id];
    if (!row || !muslimPages(place)) return [];
    return [{ slug: 'prayer-times', data: { tz: row.tz }, index: sunIndexed(place), listed: false }];
  },

  header(place, _page, t) {
    const name = (t: Translate) => nameOf(place, t);
    const short = methodFor(place.cc).short;
    const qibla = qiblaOf(place.at[1], place.at[0]);
    const lede = { city: name(t), method: t(short) };
    return {
      title: fit(placeFirst(place, [
        (t, city) => t('{city} prayer times today: Fajr, Dhuhr, Asr, Maghrib, Isha', { city }),
        (t, city) => t('{city} prayer times today and monthly timetable', { city }),
        (t, city) => t('{city} prayer times today', { city }),
        (t, city) => t('Prayer times in {city}', { city }),
      ]), t, TITLE_MAX),
      description: fit([
        t => t('Prayer times for {place} today and for 30 days: Fajr, Dhuhr, Asr, Maghrib and Isha in local time by the {method} method, with the Qibla direction.', { place: placeName(place, t), method: t(short) }),
        t => t('Prayer times for {place} today and for 30 days: Fajr, Dhuhr, Asr, Maghrib and Isha by the {method} method, with the Qibla direction.', { place: placeName(place, t), method: t(short) }),
        t => t('Prayer times for {place} today and for 30 days: Fajr, Dhuhr, Asr, Maghrib and Isha in local time by the {method} method, with the Qibla direction.', { place: name(t), method: t(short) }),
        t => t('Prayer times for {place} today and for 30 days: Fajr, Dhuhr, Asr, Maghrib and Isha by the {method} method, with the Qibla direction.', { place: name(t), method: t(short) }),
        t => t('Prayer times for {place} today and for 30 days: Fajr, Dhuhr, Asr, Maghrib and Isha in local time, with the Qibla direction.', { place: placeName(place, t) }),
        t => t('Prayer times for {place} today and for 30 days: Fajr, Dhuhr, Asr, Maghrib and Isha in local time, with the Qibla direction.', { place: name(t) }),
      ], t, DESCRIPTION_RANGE[1], DESCRIPTION_RANGE[0]),
      heading: t('Prayer times in {city}', { city: name(t) }),
      lede: qibla.km < AT_THE_KAABA_KM
        ? t('Fajr, Dhuhr, Asr, Maghrib and Isha in {city} today and for the next 30 days, in local time, by the {method} method. The Kaaba, which Muslims everywhere face in prayer, stands here.', lede)
        : t('Fajr, Dhuhr, Asr, Maghrib and Isha in {city} today and for the next 30 days, in local time, by the {method} method. The Qibla is {bearing} from true north, {compass}, and the Kaaba {km} km away.', {
          ...lede, bearing: degreesOf(qibla.bearing, t), compass: compassOf(qibla.bearing, t), km: kaabaKm(qibla.km, t),
        }),
    };
  },

  summary: (_place, _page, t) => t('Fajr, Dhuhr, Asr, Maghrib and Isha in local time, today and for 30 days, with the Qibla direction.'),

  // The line between day and night, which Fajr and Maghrib follow.
  open: () => ({ layers: ['day_night'], zoom: 3 }),

  async live(place, { data }) {
    const now = Date.now();
    const report = prayerToday(place, data.tz, now);
    return { at: now, report, next: nextPrayer(report.days, now) };
  },
};

export type PrayerPage = TopicPage<PrayerData>;
