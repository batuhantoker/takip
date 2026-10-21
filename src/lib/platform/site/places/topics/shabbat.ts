import { msg, type Translate } from '@/lib/core/i18n/translator';
import { DESCRIPTION_RANGE, fit, nameOf, placeFirst, placeName, TITLE_MAX } from '../copy/format';
import { allPlaces, type Place } from '../gazetteer';
import { topicTable } from '../tables';
import type { PlaceTopic, TopicPage } from '../topic';
import { jewishCommunity, jewishPages } from './faith-reach';
import { addDays } from './prayer-hijri';
import { candleMinutes, shabbatEvents, type ShabbatEvent } from './shabbat-times';
import type { IssRow } from './sky-data';
import { localClock } from './sky-time';
import { sunIndexed } from './sun';

/**
 * Shabbat times at /city/<place>/shabbat-times: candle lighting and havdalah for this Shabbat and the next 12 weeks,
 * with the holidays among them, worked out when the page renders (shabbat-times.ts). Israel's cities and those with
 * large Jewish communities (faith-reach.ts); indexed on the sunrise pages' bar, or anywhere in the communities table.
 */

export interface ShabbatData { tz: string }

export interface ShabbatReport {
  /** The place's today. */
  today: string;
  israel: boolean;
  minutes: number;
  /** From yesterday, so a Saturday still shows the Shabbat under way, to the 13th Saturday ahead. */
  events: ShabbatEvent[];
}

export interface ShabbatNow { at: number; report: ShabbatReport }

export const SHABBAT_WEEKS = 12;
export const SHABBAT_SLUG = 'shabbat-times';

const memo = new Map<string, ShabbatReport>();

export function shabbatReport(place: Place, tz: string, now = Date.now()): ShabbatReport {
  const today = localClock(now, tz).date;
  const key = `${place.id}:${today}`;
  const held = memo.get(key);
  if (held) return held;
  const israel = place.cc === 'IL';
  const fresh = {
    today, israel, minutes: candleMinutes(place.id, israel),
    events: shabbatEvents(place.at[1], place.at[0], tz, place.id, israel, addDays(today, -1), addDays(today, (SHABBAT_WEEKS + 1) * 7 + 1)),
  };
  if (memo.size > 2000) memo.clear();
  memo.set(key, fresh);
  return fresh;
}

export const SHABBAT: PlaceTopic<ShabbatData, ShabbatNow> = {
  id: 'shabbat',
  label: msg('Shabbat times'),
  inline: msg('Shabbat times'),
  kinds: ['city'],
  faith: true,

  pages(place) {
    const row = topicTable<IssRow>('iss').rows[place.id];
    if (!row || !jewishPages(place)) return [];
    return [{ slug: SHABBAT_SLUG, data: { tz: row.tz }, index: sunIndexed(place) || !!jewishCommunity(place), listed: false }];
  },

  header(place, _page, t) {
    const name = (t: Translate) => nameOf(place, t);
    const n = candleMinutes(place.id, place.cc === 'IL');
    return {
      title: fit(placeFirst(place, [
        (t, city) => t('{city} Shabbat times: candle lighting and havdalah', { city }),
        (t, city) => t('{city} Shabbat candle lighting times', { city }),
        (t, city) => t('{city} Shabbat times', { city }),
        (t, city) => t('Shabbat times in {city}', { city }),
      ]), t, TITLE_MAX),
      description: fit([
        t => t('Shabbat times for {place}: candle lighting {n} minutes before sunset and havdalah at nightfall, this week and for the next 12, with yom tov, in local time.', { place: placeName(place, t), n }),
        t => t('Shabbat times for {place}: candle lighting {n} minutes before sunset and havdalah at nightfall, this week and for the next 12, with yom tov, in local time.', { place: name(t), n }),
        t => t('Shabbat candle lighting and havdalah in {place}, this week and for the next 12, with yom tov, in local time.', { place: name(t) }),
      ], t, DESCRIPTION_RANGE[1], DESCRIPTION_RANGE[0]),
      heading: t('Shabbat times in {city}', { city: name(t) }),
      lede: t('Candle lighting and havdalah in {city} for this Shabbat and the next 12 weeks, with the holidays among them, in local time. Candles are lit {n} minutes before sunset; havdalah is at nightfall, when the Sun is 8.5° below the horizon.', { city: name(t), n }),
    };
  },

  summary: (_place, _page, t) => t('Candle lighting and havdalah this week and for the next 12, with the holidays.'),

  // The line between day and night, which Shabbat begins and ends with.
  open: () => ({ layers: ['day_night'], zoom: 3 }),

  async live(place, { data }) {
    const now = Date.now();
    return { at: now, report: shabbatReport(place, data.tz, now) };
  },
};

export type ShabbatPage = TopicPage<ShabbatData>;

let cities: { places: readonly Place[]; list: { place: Place; slug: string; index: boolean }[] } | null = null;

/** Every city with a Shabbat page, most populous first, for the pages that list them (/jewish-holidays). */
export function shabbatCities(): { place: Place; slug: string; index: boolean }[] {
  const places = allPlaces();
  if (cities?.places !== places) {
    const list = places.filter(p => p.kind === 'city').flatMap(p => SHABBAT.pages(p).map(page => ({ place: p, slug: page.slug, index: page.index })))
      .sort((a, b) => b.place.pop - a.place.pop);
    cities = { places, list };
  }
  return cities.list;
}

export interface ShabbatWeek { friday: string; candles?: ShabbatEvent; havdalah?: ShabbatEvent }

/** This Shabbat (yesterday's candles on a Saturday) and the next 12: Friday's candles and Saturday night's havdalah. */
export function shabbatWeeks(r: ShabbatReport): ShabbatWeek[] {
  const day = new Date(`${r.today}T12:00:00Z`).getUTCDay();
  const first = day === 6 ? addDays(r.today, -1) : addDays(r.today, (5 - day + 7) % 7);
  const find = (date: string, kind: ShabbatEvent['kind']) => r.events.find(e => e.date === date && e.kind === kind);
  return Array.from({ length: SHABBAT_WEEKS + 1 }, (_, i) => {
    const friday = addDays(first, i * 7);
    return { friday, candles: find(friday, 'candles'), havdalah: find(addDays(friday, 1), 'havdalah') };
  });
}
