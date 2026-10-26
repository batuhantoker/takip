import { msg, type Translate } from '@/lib/core/i18n/translator';
import type { Box, NearItem } from '@/lib/feeds/hazards/near-now';
import { DESCRIPTION_RANGE, fit, listOf, nameOf, placeFirst, placeName, TITLE_MAX, wordingOf } from '../copy/format';
import { ownApi } from '../../live/own-api';
import { allPlaces, placeById } from '../gazetteer';
import type { Place } from '../place';
import { tableRow } from '../tables';
import type { PlaceTopic, TopicPage } from '../topic';
import { CAMERAS } from './cameras';
import { FLIGHTS } from './flights';
import type { HazardRow } from './hazards-data';
import { PORTS } from './ports';
import { TRANSIT } from './transit';
import { WEATHER } from './weather';

/**
 * What is happening right now, at /city/<place>/now and /country/<place>/now, from /api/near-now (the phone widget's
 * feed, lib/feeds/hazards/near-now.ts). A city: the nearest warning, the strongest quake of the last day, fires,
 * lightning and rain, and the city's other live pages. A country: what is in force or recent inside the box its map
 * frames (so just across a border too, and the copy says "in and around"), and its biggest cities' own pages.
 */

export interface NowCity {
  scope: 'city';
  radar: boolean;
  lightning: boolean;
  /** The airports the flights page watches, by IATA code. */
  airports: string[];
  /** Cameras on air within the cameras page's reach. */
  cameras: number;
  /** Transit operators whose vehicles move live on the map. */
  operators: string[];
  /** The place's other live pages, by topic id, in the order the body lists them. */
  pages: string[];
}

export interface NowCountry {
  scope: 'country';
  box: Box;
  /** Its biggest cities with a page of their own, by GeoNames id, biggest first. */
  cities: number[];
}

export type NowData = NowCity | NowCountry;

export interface NowLive { items: NearItem[]; at: number }

/** The live pages a city's "now" page gathers, in its order. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each topic has its own data type
export const NOW_TOPICS: readonly PlaceTopic<any, any>[] = [WEATHER, FLIGHTS, CAMERAS, TRANSIT, PORTS];

const MIN_INDEXED_POP = 100_000;
const MIN_INDEXED_COUNTRY_POP = 1_000_000;
const COUNTRY_CITIES = 8;
/** One line for each kind near-now knows: warnings, quakes, fires, lightning, rain. */
const KINDS = 5;

let citiesByCountry: Map<string, Place[]> | null = null;
/** A country's cities that have a weather page (and so a "now" page), biggest first. */
export function nowCitiesOf(cc: string): Place[] {
  if (!citiesByCountry) {
    citiesByCountry = new Map();
    for (const p of allPlaces()) {
      if (p.kind !== 'city' || !WEATHER.pages(p).length) continue;
      const list = citiesByCountry.get(p.cc) ?? [];
      list.push(p);
      citiesByCountry.set(p.cc, list);
    }
    for (const list of citiesByCountry.values()) list.sort((a, b) => b.pop - a.pop);
  }
  return citiesByCountry.get(cc) ?? [];
}

function cityPage(place: Place): TopicPage<NowCity>[] {
  const weather = WEATHER.pages(place)[0];
  if (!weather) return [];
  const flights = FLIGHTS.pages(place)[0];
  const cameras = CAMERAS.pages(place)[0];
  const transit = TRANSIT.pages(place)[0];
  const found: Record<string, unknown> = { weather, flights, cameras, transit, ports: PORTS.pages(place)[0] };
  const data: NowCity = {
    scope: 'city',
    radar: weather.data.radar === true,
    lightning: !!weather.data.lightning,
    airports: (flights?.data.airports ?? []).map(a => a.iata).filter(Boolean).slice(0, 2),
    cameras: cameras?.data.onAir ?? 0,
    operators: (transit?.data.operators ?? []).filter(o => o.how !== 'timetable').map(o => o.name).slice(0, 2),
    pages: NOW_TOPICS.map(topic => topic.id).filter(id => !!found[id]),
  };
  const measured = data.radar || data.lightning;
  return [{ slug: 'now', data, index: measured && data.pages.length >= 3 && place.pop >= MIN_INDEXED_POP }];
}

function countryPage(place: Place): TopicPage<NowCountry>[] {
  const box = tableRow<HazardRow>('hazards', place.id)?.box;
  if (!box) return [];
  const cities = nowCitiesOf(place.cc).slice(0, COUNTRY_CITIES).map(p => p.id);
  return [{ slug: 'now', data: { scope: 'country', box, cities }, index: place.pop >= MIN_INDEXED_COUNTRY_POP }];
}

const cityNames = (ids: number[], k: number, t: Translate) =>
  listOf(ids.slice(0, k).map(placeById).filter(p => !!p).map(p => nameOf(p, t)), t);

function countryHeader(place: Place, data: NowCountry, t: Translate) {
  const country = (t: Translate) => nameOf(place, t);
  return {
    title: fit([
      t => t('{country} right now: warnings, earthquakes and fires', { country: country(t) }),
      t => t('What’s happening in {city} right now', { city: country(t) }),
      t => t('{city} right now', { city: country(t) }),
    ], t, TITLE_MAX),
    description: fit([
      ...[3, 2, 1].filter(k => k <= data.cities.length).map(k => (t: Translate) =>
        t('What is happening in and around {country} right now: weather warnings in force, the strongest earthquake of the last day and fires, with live pages for {cities}.', { country: country(t), cities: cityNames(data.cities, k, t) })),
      t => t('What is happening in and around {country} right now: weather warnings in force, the strongest earthquake of the last day and fires, on one live map.', { country: country(t) }),
      t => t('{country} right now: weather warnings in force, the strongest earthquake of the last day and fires, on one live map.', { country: country(t) }),
    ], t, DESCRIPTION_RANGE[1], DESCRIPTION_RANGE[0]),
    heading: t('{city} right now', { city: country(t) }),
    lede: t('Weather warnings in force, the strongest earthquake of the last day and fires in and around {country}, counted across the whole country; each city’s own page adds the lightning and rain around it.', { country: country(t) }),
  };
}

function cityHeader(place: Place, data: NowCity, t: Translate) {
  const name = (t: Translate) => nameOf(place, t);
  // What else moves on the map there, most first; fewer of them where the sentence runs long.
  const extras = (t: Translate, k: number) => listOf([
    ...(data.airports.length ? [t('flights at {airports}', { airports: listOf(data.airports, t) })] : []),
    ...(data.cameras ? [t('{n, plural, one {# public camera} other {# public cameras}}', { n: data.cameras })] : []),
    ...(data.operators.length ? [t('{operators} vehicles', { operators: listOf(data.operators, t) })] : []),
  ].slice(0, k), t);
  const kinds = [data.airports.length > 0, data.cameras > 0, data.operators.length > 0].filter(Boolean).length;
  return {
    title: fit(placeFirst(place, [
      (t, city) => t('{city} right now: warnings, weather and live map', { city }),
      (t, city) => t('What’s happening in {city} right now', { city }),
      (t, city) => t('{city} right now: what’s happening', { city }),
      (t, city) => t('{city} right now', { city }),
    ]), t, TITLE_MAX),
    description: fit([
      ...[3, 2, 1].filter(k => k <= kinds).flatMap(k => [
        (t: Translate) => t('What is happening in {place} right now: warnings, earthquakes, fires, lightning and rain nearby, with {extras} on one live map.', { place: placeName(place, t), extras: extras(t, k) }),
        (t: Translate) => t('What is happening in {city} right now: warnings, earthquakes, fires, lightning and rain nearby, with {extras} on one live map.', { city: name(t), extras: extras(t, k) }),
      ]),
      t => t('What is happening in {place} right now: weather warnings, earthquakes, fires, lightning and rain nearby, each with how far away it is, on one live map.', { place: placeName(place, t) }),
      t => t('What is happening around {place} right now: warnings, earthquakes, fires, lightning and rain, on one live map.', { place: placeName(place, t) }),
      t => t('What is happening around {city} right now: warnings, earthquakes, fires, lightning and rain, nearest and strongest first, on one live map.', { city: name(t) }),
    ], t, DESCRIPTION_RANGE[1], DESCRIPTION_RANGE[0]),
    heading: t('{city} right now', { city: placeName(place, t) }),
    lede: t(wordingOf(place, 'lede', [
      msg('What is happening around {city} as TAKIP sees it now: the nearest warning, the strongest earthquake of the last day, fires, lightning and rain, each with how far away it is and how long ago.'),
      msg('Warnings, earthquakes, fires, lightning and rain around {city} right now, the most pressing first, with how far away each is and when it happened.'),
    ]), { city: name(t) }),
  };
}

export const NOW: PlaceTopic<NowData, NowLive> = {
  id: 'now',
  label: msg('Right now'),
  inline: msg('what is happening now'),
  kinds: ['city', 'country'],

  pages: place => (place.kind === 'city' ? cityPage(place) : place.kind === 'country' ? countryPage(place) : []),

  header: (place, { data }, t) => (data.scope === 'country' ? countryHeader(place, data, t) : cityHeader(place, data, t)),

  summary: (place, { data }, t) => (data.scope === 'country'
    ? t('Warnings, earthquakes and fires in and around {country} now', { country: nameOf(place, t) })
    : t('Warnings, earthquakes, fires, lightning and rain around {city} now', { city: nameOf(place, t) })),

  open: (_place, { data }) => (data.scope === 'country'
    ? { layers: ['weather', 'earthquakes', 'fires'] }
    : { layers: ['weather', 'earthquakes', 'fires', ...(data.radar ? ['wx_radar'] : []), ...(data.lightning ? ['wx_lightning'] : [])], zoom: 8 }),

  async live(place, { data }, t) {
    const where = data.scope === 'country' ? `bbox=${data.box.join(',')}` : `lat=${place.at[1]}&lon=${place.at[0]}`;
    const near = await ownApi<NowLive>(`/api/near-now?${where}&lang=${t.locale}&unit=${t.distance}&limit=${KINDS}`, 120);
    return near && { items: near.items, at: near.at };
  },
};

export type NowPage = TopicPage<NowData>;
