import { msg, type Translate } from '@/lib/core/i18n/translator';
import { DESCRIPTION_RANGE, fit, nameOf, placeName, TITLE_MAX, wordingOf } from '../copy/format';
import { allPlaces, type Place } from '../gazetteer';
import { topicTable } from '../tables';
import type { PlaceTopic, TopicPage } from '../topic';
import { latitudeOf } from './sky-copy';
import type { IssRow } from './sky-data';
import { thinOut } from './sky-rules';
import { localClock } from './sky-time';
import { hoursOf } from './sun-copy';
import { sunReport, type SunReport } from './sun-report';
import { dayLengthOn } from './sun-times';

/**
 * Sunrise, sunset and twilight at /city/<place>/sun, worked out when the page renders for today on the place's
 * own clock (time zones from iss.json, which has one for every city). Every city has a page; indexed with 50,000
 * people or more, or anywhere the midnight sun reaches, unless a more populous indexed city lies within 25 km,
 * where the times differ by about a minute.
 */

export interface SunData { tz: string }

// 90° less the Earth's tilt and the 0.833° sunrise allows for refraction.
export const SUN_INDEX = { population: 50_000, midnightSunLat: 65.7, neighbourKm: 25 } as const;

let indexed: { places: readonly Place[]; ids: Set<number> } | null = null;

function indexedIds(): Set<number> {
  const places = allPlaces();
  if (indexed?.places !== places) {
    const zones = topicTable<IssRow>('iss').rows;
    // Two places named alike in one region (GeoNames lists some twice) would share a title: the larger stands for both.
    const named = new Map<string, Place>();
    for (const p of places) {
      if (p.kind !== 'city' || !zones[p.id] || (p.pop < SUN_INDEX.population && Math.abs(p.at[1]) < SUN_INDEX.midnightSunLat)) continue;
      const key = `${p.cc}|${p.region ?? ''}|${p.name}`;
      const held = named.get(key);
      if (!held || p.pop > held.pop || (p.pop === held.pop && p.id < held.id)) named.set(key, p);
    }
    const spots = [...named.values()].map(p => ({ id: p.id, lat: p.at[1], lng: p.at[0], pop: p.pop }));
    indexed = { places, ids: thinOut(spots, SUN_INDEX.neighbourKm) };
  }
  return indexed.ids;
}

/** SUN_INDEX's bar, which the prayer-times pages share. */
export const sunIndexed = (place: Place) => indexedIds().has(place.id);

// A year of sunrises is a few thousand sums: kept per place and day so a crawl doesn't redo them.
const memo = new Map<string, SunReport>();

export function sunToday(place: Place, tz: string, now = Date.now()): SunReport {
  const key = `${place.id}:${localClock(now, tz).date}`;
  const held = memo.get(key);
  if (held) return held;
  const fresh = sunReport(place.at[1], place.at[0], tz, now);
  if (memo.size > 2000) memo.clear();
  memo.set(key, fresh);
  return fresh;
}

/** The solstices' day lengths, for copy that has no clock: the shorter first. */
function extremes(place: Place) {
  const year = new Date().getUTCFullYear();
  const [lon, lat] = place.at;
  const [a, b] = [dayLengthOn(lat, lon, `${year}-06-21`), dayLengthOn(lat, lon, `${year}-12-21`)];
  return a < b ? [a, b] : [b, a];
}

const FULL_DAY = 86_400_000;
/** Within this, a day the same length all year: the equator's, a minute or two either way. */
const EVEN_YEAR = 10 * 60_000;

export const SUN: PlaceTopic<SunData, SunReport> = {
  id: 'sun',
  label: msg('Sunrise and sunset'),
  inline: msg('sunrise and sunset times'),
  kinds: ['city'],

  pages(place) {
    const row = topicTable<IssRow>('iss').rows[place.id];
    if (!row) return [];
    return [{ slug: 'sun', data: { tz: row.tz }, index: indexedIds().has(place.id) }];
  },

  header(place, _page, t) {
    const name = (t: Translate) => nameOf(place, t);
    const [short, long] = extremes(place);
    const at = { city: name(t), lat: latitudeOf(place.at[1], t) };
    return {
      title: fit([
        t => t('{place} sunrise and sunset times today', { place: placeName(place, t) }),
        t => t('{city} sunrise and sunset times today', { city: name(t) }),
        t => t('Sunrise and sunset in {city}', { city: name(t) }),
        t => t('{city} sunrise and sunset', { city: name(t) }),
      ], t, TITLE_MAX),
      description: fit([
        t => t('Sunrise and sunset times for {place} today, in local time, with day length, solar noon, twilight and golden hour, and a month-by-month table.', { place: placeName(place, t) }),
        t => t('Sunrise and sunset times for {city} today, in local time, with day length, solar noon, twilight and golden hour, and a month-by-month table.', { city: name(t) }),
        t => t('Sunrise and sunset in {city} today, in local time, with day length, twilight and golden hour, and a table for each month.', { city: name(t) }),
        t => t('Sunrise and sunset in {city} today, with day length, twilight and a month-by-month table.', { city: name(t) }),
      ], t, DESCRIPTION_RANGE[1], DESCRIPTION_RANGE[0]),
      heading: t('Sunrise and sunset in {city}', { city: placeName(place, t) }),
      lede: long - short < EVEN_YEAR
        ? t(wordingOf(place, 'lede', [msg('Today’s sunrise, sunset and twilight in {city}, in local time. At {lat}, near the equator, the day lasts about {length} all year round.'), msg('Sunrise, sunset and twilight for {city} today, in local time. Near the equator, at {lat}, the day lasts about {length} all year round.')]), { ...at, length: hoursOf((long + short) / 2, t) })
        : long >= FULL_DAY && short <= 0
        ? t(wordingOf(place, 'lede', [msg('Today’s sunrise, sunset and twilight in {city}, in local time. At {lat}, the Sun doesn’t set for weeks around the summer solstice and doesn’t rise for weeks around the winter one.'), msg('Sunrise, sunset and twilight for {city} today, in local time. At {lat}, the Sun stays up for weeks around the summer solstice and down for weeks around the winter one.')]), at)
        : long >= FULL_DAY
          ? t(wordingOf(place, 'lede', [msg('Today’s sunrise, sunset and twilight in {city}, in local time. At {lat}, the Sun doesn’t set around the summer solstice, and the shortest day lasts {short}.'), msg('Sunrise, sunset and twilight for {city} today, in local time. At {lat}, the Sun stays up around the summer solstice, and the shortest day lasts {short}.')]), { ...at, short: hoursOf(short, t) })
          : t(wordingOf(place, 'lede', [msg('Today’s sunrise, sunset and twilight in {city}, in local time. At {lat}, the day lasts from {short} at the winter solstice to {long} at the summer solstice.'), msg('Sunrise, sunset and twilight for {city} today, in local time. At {lat}, days run from {short} at the winter solstice to {long} at the summer solstice.')]), { ...at, short: hoursOf(short, t), long: hoursOf(long, t) }),
    };
  },

  summary: (_place, _page, t) => t('Sunrise, sunset, day length and twilight in local time, today and through the year.'),

  // Close enough that the line between day and night crosses the frame at dawn and dusk.
  open: () => ({ layers: ['day_night'], zoom: 3 }),

  live: async (place, { data }) => sunToday(place, data.tz),

  liveLabel: msg('Today · worked out at {time}'),
};

export type SunPage = TopicPage<SunData>;
