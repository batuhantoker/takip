import { msg, type Translate } from '@/lib/core/i18n/translator';
import { DESCRIPTION_RANGE, fit, nameOf, placeFirst, placeName, TITLE_MAX } from '../copy/format';
import type { Place } from '../gazetteer';
import { topicTable } from '../tables';
import type { PlaceTopic, TopicPage } from '../topic';
import { muslimPages } from './faith-reach';
import { dayMonth } from './prayer-copy';
import { imsakMargin, methodFor } from './prayer-methods';
import { prayerDays, type PrayerDay, type PrayerReport } from './prayer-times';
import { ramadanOf, ramadanYears, type RamadanSpan } from './ramadan-calendar';
import type { IssRow } from './sky-data';
import { localClock } from './sky-time';
import { sunIndexed } from './sun';

/**
 * Ramadan timetables at /city/<place>/ramadan-<year>: imsak, Fajr, iftar and Isha for every day of each Ramadan
 * ramadan-calendar.ts lists, by the country's prayer-times method. Indexed on the prayer-times bar until Eid.
 */

export interface RamadanData { tz: string; hijriYear: number; year: number; twin: boolean }

export interface RamadanReport {
  span: RamadanSpan;
  prayer: PrayerReport;
  /** Minutes before Fajr that sehri ends. */
  imsakBefore: number;
}

export interface RamadanNow { at: number; today: string; report: RamadanReport }

// A month of times for a place doesn't change with the day it is read: kept per place and Ramadan.
const memo = new Map<string, RamadanReport>();

export function ramadanReport(place: Place, tz: string, hijriYear: number): RamadanReport {
  const key = `${place.id}:${hijriYear}`;
  const held = memo.get(key);
  if (held) return held;
  const span = ramadanOf(hijriYear);
  const fresh = { span, prayer: prayerDays(place.at[1], place.at[0], place.cc, tz, span.start, span.days), imsakBefore: imsakMargin(place.cc) };
  if (memo.size > 2000) memo.clear();
  memo.set(key, fresh);
  return fresh;
}

export const imsakOf = (r: RamadanReport, d: PrayerDay) => d.times.fajr - r.imsakBefore * 60_000;
/** From imsak to iftar. */
export const fastOf = (r: RamadanReport, d: PrayerDay) => d.times.maghrib - imsakOf(r, d);

/** "2027", or "2030 (1452 AH)" for the second Ramadan to begin in 2030. */
export const ramadanLabel = (data: Pick<RamadanData, 'year' | 'twin' | 'hijriYear'>, t: Translate) =>
  (data.twin ? t('{year} ({hijri} AH)', { year: String(data.year), hijri: String(data.hijriYear) }) : String(data.year));

export const RAMADAN_TOPIC: PlaceTopic<RamadanData, RamadanNow> = {
  id: 'ramadan',
  label: msg('Ramadan'),
  inline: msg('Ramadan timetable'),
  kinds: ['city'],
  faith: true,

  pages(place) {
    const row = topicTable<IssRow>('iss').rows[place.id];
    if (!row || !muslimPages(place)) return [];
    const indexed = sunIndexed(place);
    return ramadanYears().map(y => ({
      slug: y.slug,
      data: { tz: row.tz, hijriYear: y.hijriYear, year: y.year, twin: y.twin },
      index: indexed && y.indexed,
      listed: false as const,
    }));
  },

  header(place, { data }, t) {
    const name = (t: Translate) => nameOf(place, t);
    const span = ramadanOf(data.hijriYear);
    const short = methodFor(place.cc).short;
    const vars = (t: Translate) => ({ year: ramadanLabel(data, t), days: span.days, start: dayMonth(span.start, t), end: dayMonth(span.end, t), eid: dayMonth(span.eid, t) });
    return {
      title: fit(placeFirst(place, [
        (t, city) => t('{city} Ramadan {year} timetable: sehri and iftar times', { city, year: ramadanLabel(data, t) }),
        (t, city) => t('{city} Ramadan {year} calendar: imsak and iftar', { city, year: ramadanLabel(data, t) }),
        (t, city) => t('{city} Ramadan {year} timetable', { city, year: ramadanLabel(data, t) }),
        (t, city) => t('Ramadan {year} in {city}', { city, year: ramadanLabel(data, t) }),
      ]), t, TITLE_MAX),
      description: fit([
        t => t('Ramadan {year} timetable for {place}: sehri and iftar times for all {days} days, from {start} to Eid al-Fitr on {eid}, by the {method} method.', { ...vars(t), place: placeName(place, t), method: t(short) }),
        t => t('Ramadan {year} timetable for {place}: sehri and iftar times for all {days} days, from {start} to Eid al-Fitr on {eid}, by the {method} method.', { ...vars(t), place: name(t), method: t(short) }),
        t => t('Ramadan {year} timetable for {place}: sehri and iftar times for all {days} days, from {start} to Eid al-Fitr on {eid}, in local time.', { ...vars(t), place: placeName(place, t) }),
        t => t('Ramadan {year} timetable for {place}: sehri and iftar times for all {days} days, from {start} to Eid al-Fitr on {eid}, in local time.', { ...vars(t), place: name(t) }),
        t => t('Ramadan {year} in {place}: sehri and iftar times for each day from {start} to Eid al-Fitr on {eid}.', { ...vars(t), place: name(t) }),
      ], t, DESCRIPTION_RANGE[1], DESCRIPTION_RANGE[0]),
      heading: t('Ramadan {year} in {city}', { city: name(t), year: ramadanLabel(data, t) }),
      lede: t('Sehri and iftar times in {city} for each day of Ramadan {year}, from {start} to {end}, in local time, by the {method} method. Eid al-Fitr is on {eid} in the Umm al-Qura calendar.', {
        ...vars(t), city: name(t), method: t(short),
      }),
    };
  },

  summary: (_place, { data }, t) => {
    const span = ramadanOf(data.hijriYear);
    return t('Sehri and iftar times for each day of Ramadan {year}, from {start} to Eid al-Fitr on {eid}.', { year: ramadanLabel(data, t), start: dayMonth(span.start, t), eid: dayMonth(span.eid, t) });
  },

  // The line between day and night, which sehri and iftar follow.
  open: () => ({ layers: ['day_night'], zoom: 3 }),

  async live(place, { data }) {
    const now = Date.now();
    return { at: now, today: localClock(now, data.tz).date, report: ramadanReport(place, data.tz, data.hijriYear) };
  },
};

export type RamadanPage = TopicPage<RamadanData>;
