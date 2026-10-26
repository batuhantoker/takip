import type { Locale } from '@/lib/core/i18n/locales';
import { msg, type Translate } from '@/lib/core/i18n/translator';
import type { Bbox, EmbedSpec } from '@/lib/map/embed/spec';
import { cachedSource } from '@/lib/core/net/source-cache';
import { MIN_STOPS, planDays, shortestPath, type PlanDay } from '@/lib/places/attractions/plan';
import { walkThrough, type Walk } from '@/lib/places/attractions/walk';
import { DESCRIPTION_RANGE, fit, listOf, nameOf, placeFirst, placeName, TITLE_MAX } from '../copy/format';
import { km, placeById } from '../gazetteer';
import type { Place } from '../place';
import { topicTable } from '../tables';
import type { PlaceTopic, TopicPage } from '../topic';
import type { Photo } from '@/lib/places/attractions/photos';
import { ownApi } from '../../live/own-api';
import { ATTRACTIONS, photosFor } from './attractions';
import { attractionName, type AttractionItem, type AttractionsMeta, type AttractionsRow } from './attractions-data';

/**
 * Plans built from the things-to-do table: /city/<place>/one-day-itinerary (the best-known place and the best known
 * near it, five or six stops in the shortest walking order), /city/<place>/one-week-itinerary (seven such days, each
 * from what the days before left) and /country/<place>/one-week-itinerary (a day in each of its best-known cities, in
 * the order that keeps the travel short). Straight lines between stops; no opening hours. Each page's live map
 * outlines its route (EmbedSpec.plan, drawn from /api/things-to-do/plan).
 */

export interface PlanStop { id: string; item: AttractionItem }
export interface PlanDayData { stops: PlanStop[]; km: number; /** A country's: the city the day is spent in. */ city?: number }
export interface PlansData { length: 'day' | 'week'; days: PlanDayData[] }

/** What the plan's own page fetches: its pictures, and each day's walk by day number (from 1). */
export interface PlanDetail { photos: Record<string, Photo> | null; walks: Record<number, { km: number; minutes: number }> }

export const ONE_DAY = 'one-day-itinerary';
export const ONE_WEEK = 'one-week-itinerary';
const WEEK = 7;
const INDEX_DAY_STOPS = 5;
const INDEX_WEEK_STOPS = 4 * WEEK;
const INDEX_COUNTRY_CITIES = 4;
const WALK_TTL_MS = 30 * 86_400_000;
const WEEK_S = 7 * 86_400;
/** A country's week spends its first days this far apart at least, rather than in a capital's suburbs. */
const CITY_APART_KM = 40;

type Point = PlanStop & { at: readonly [number, number]; l: number };

const table = () => topicTable<AttractionsRow, AttractionsMeta>('attractions');

function cityPool(id: number): Point[] {
  const { rows, meta } = table();
  return (rows[String(id)]?.a ?? []).flatMap(([itemId]) => {
    const item = meta?.items[itemId];
    return item ? [{ id: itemId, item, at: item.at, l: item.l }] : [];
  });
}

const dayOf = (day: PlanDay<Point>, city?: number): PlanDayData =>
  ({ stops: day.stops.map(({ id, item }) => ({ id, item })), km: day.km, ...(city ? { city } : {}) });

const thingsIndexed = (place: Place) => ATTRACTIONS.pages(place).some(p => p.index);

function cityPages(place: Place): TopicPage<PlansData>[] {
  const days = planDays(cityPool(place.id), WEEK);
  const [first] = days;
  if (!first) return [];
  const known = thingsIndexed(place);
  const pages: TopicPage<PlansData>[] = [{
    slug: ONE_DAY, label: msg('One day'), data: { length: 'day', days: [dayOf(first)] },
    index: known && first.stops.length >= INDEX_DAY_STOPS,
  }];
  if (days.length === WEEK) {
    pages.push({
      slug: ONE_WEEK, label: msg('One week'), listed: false, data: { length: 'week', days: days.map(d => dayOf(d)) },
      index: known && days.reduce((n, d) => n + d.stops.length, 0) >= INDEX_WEEK_STOPS,
    });
  }
  return pages;
}

/** A day in each of the country's cities in the order of their best-known place, then second days, until a week. */
function countryPages(place: Place): TopicPage<PlansData>[] {
  const row = table().rows[String(place.id)];
  if (!row) return [];
  const cities = [...new Set(row.a.map(([, city]) => city).filter(Boolean))].flatMap(id => {
    const city = placeById(id);
    const days = city ? planDays(cityPool(id), 2).filter(d => d.stops.length >= MIN_STOPS) : [];
    return city && days.length ? [{ city, days }] : [];
  });
  const picked: { city: Place; day: PlanDay<Point> }[] = [];
  const apart = (city: Place) => picked.every(p => km(p.city.at, city.at) >= CITY_APART_KM);
  for (const c of cities) if (picked.length < WEEK && apart(c.city)) picked.push({ city: c.city, day: c.days[0] });
  for (const c of cities) if (picked.length < WEEK && c.days[1] && picked.some(p => p.city.id === c.city.id)) picked.push({ city: c.city, day: c.days[1] });
  if (picked.length < WEEK) return [];
  const visited = [...new Map(picked.map(p => [p.city.id, p.city])).values()];
  // The week starts in the best-known city, where most trips land.
  const route = shortestPath(visited.map(c => ({ id: String(c.id), at: c.at, l: 0 })), true).map(p => Number(p.id));
  const days = route.flatMap(id => picked.filter(p => p.city.id === id).map(p => dayOf(p.day, id)));
  return [{
    slug: ONE_WEEK, label: msg('One week'), data: { length: 'week', days },
    index: thingsIndexed(place) && visited.length >= INDEX_COUNTRY_CITIES && days.reduce((n, d) => n + d.stops.length, 0) >= INDEX_WEEK_STOPS,
  }];
}

// pages() runs for every place in the sitemap and the nearby cards, so each place's plans are worked out once per table.
const memo = { generated: '', pages: new Map<number, TopicPage<PlansData>[]>() };

function plansOf(place: Place): TopicPage<PlansData>[] {
  const { generated } = table();
  if (memo.generated !== generated) Object.assign(memo, { generated, pages: new Map() });
  let pages = memo.pages.get(place.id);
  if (!pages) memo.pages.set(place.id, (pages = place.kind === 'country' ? countryPages(place) : cityPages(place)));
  return pages;
}

export const stopName = (stop: PlanStop, locale: Locale) => attractionName(stop.item, locale);

const stopsOf = (data: PlansData) => data.days.flatMap(d => d.stops);
const named = (stops: PlanStop[], k: number, t: Translate) => listOf(stops.slice(0, k).map(s => stopName(s, t.locale)), t);
const cityNames = (data: PlansData, t: Translate) =>
  listOf([...new Set(data.days.map(d => d.city))].flatMap(id => (id && placeById(id) ? [nameOf(placeById(id)!, t)] : [])), t);
const totalKm = (data: PlansData) => Math.max(0.1, Math.round(data.days.reduce((km, d) => km + d.km, 0) * 10) / 10);

/** The box the stops fit in, with room around them. */
export function planBox(data: PlansData): Bbox {
  const at = stopsOf(data).map(s => s.item.at);
  const lons = at.map(a => a[0]);
  const lats = at.map(a => a[1]);
  const [w, e, s, n] = [Math.min(...lons), Math.max(...lons), Math.min(...lats), Math.max(...lats)];
  const padX = Math.max(0.004, (e - w) * 0.12);
  const padY = Math.max(0.003, (n - s) * 0.12);
  return [w - padX, s - padY, e + padX, n + padY];
}

/** Each day's walk along the streets, or null for a day Valhalla had none for; kept for weeks per day's stops. */
export async function planWalks(data: PlansData): Promise<(Walk | null)[]> {
  const walks: (Walk | null)[] = [];
  // One day at a time: FOSSGIS's public router asks for gentle use.
  for (const day of data.days) {
    const key = `plan-walk:${day.stops.map(s => s.id).join(',')}`;
    const [walk] = await cachedSource<Walk | null>(key, async () => [await walkThrough(day.stops.map(s => s.item.at)).catch(() => null)], WALK_TTL_MS)().catch(() => [null]);
    walks.push(walk ?? null);
  }
  return walks;
}

/**
 * The route for the live map: a line per day (along the streets where `walks` has it, else straight), a line
 * between a country's cities, and each stop numbered within its day.
 */
export function planFeatures(data: PlansData, locale: Locale, walks: readonly (Walk | null)[] = []): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  const firsts: [number, number][] = [];
  data.days.forEach((d, i) => {
    const coords = d.stops.map(s => [s.item.at[0], s.item.at[1]] as [number, number]);
    if (d.city !== undefined && d.city !== data.days[i - 1]?.city) firsts.push(coords[0]);
    const walk = walks[i];
    if (coords.length > 1) {
      features.push({
        type: 'Feature', geometry: { type: 'LineString', coordinates: walk?.coords ?? coords },
        properties: { kind: 'walk', day: i + 1, ...(walk ? { km: walk.km, minutes: walk.minutes } : {}) },
      });
    }
    d.stops.forEach((s, n) => features.push({
      type: 'Feature', geometry: { type: 'Point', coordinates: coords[n] },
      properties: { kind: 'stop', day: i + 1, n: n + 1, id: s.id, k: s.item.k, name: stopName(s, locale) },
    }));
  });
  if (firsts.length > 1) features.unshift({ type: 'Feature', geometry: { type: 'LineString', coordinates: firsts }, properties: { kind: 'trip' } });
  return { type: 'FeatureCollection', features };
}

export const PLANS: PlaceTopic<PlansData, never, PlanDetail> = {
  id: 'plans',
  label: msg('Plans'),
  inline: msg('day plans'),
  kinds: ['city', 'country'],

  pages: plansOf,

  header(place, { data }, t) {
    const stops = stopsOf(data);
    const km = totalKm(data);
    if (place.kind === 'country') {
      const country = nameOf(place, t);
      return {
        title: fit([
          t => t('A week in {country}: a 7-day itinerary through its cities', { country }),
          t => t('7 days in {country}: a day-by-day itinerary', { country }),
          t => t('A week in {country}', { country }),
        ], t, TITLE_MAX),
        description: fit([
          t => t('A week in {country}: a 7-day itinerary with a day each in {cities}, walking their top sights, in an order that keeps the travel short.', { country, cities: cityNames(data, t) }),
          t => t('A week in {country}: a day each in {cities}, walking their best-known sights, in an order that keeps the travel short.', { country, cities: cityNames(data, t) }),
          t => t('A week in {country}: seven days through its best-known cities and sights, a walk a day, in an order that keeps the travel short.', { country }),
        ], t, DESCRIPTION_RANGE[1], DESCRIPTION_RANGE[0]),
        heading: t('A week in {country}', { country }),
        lede: t('Seven days across {country}: {cities}. Each day is a walk through the best-known places in one city, and the cities follow in the order that keeps the travel between them short.', { country, cities: cityNames(data, t) }),
      };
    }
    const city = (t: Translate) => nameOf(place, t);
    if (data.length === 'day') {
      return {
        title: fit(placeFirst(place, [
          (t, city) => t('One day in {city}: a 1-day itinerary through its top sights', { city }),
          (t, city) => t('One day in {city}: a 1-day itinerary', { city }),
          (t, city) => t('{city} in a day: a 1-day itinerary', { city }),
          (t, city) => t('One day in {city}', { city }),
        ]), t, TITLE_MAX),
        description: fit([
          ...[3, 2].map(k => (t: Translate) => t('One day in {city}: a 1-day itinerary of {n} top sights close together, among them {top}, in the shortest order to walk them.', { city: city(t), top: named(stops, k, t), n: stops.length })),
          ...[3, 2].map(k => (t: Translate) => t('One day in {city}: {top} and more, {n} of its best-known sights close together, in the shortest order to walk them.', { city: city(t), top: named(stops, k, t), n: stops.length })),
          t => t('One day in {city}: {n} of its best-known sights close together, in the shortest order to walk them, each with its Wikipedia article.', { city: city(t), n: stops.length }),
        ], t, DESCRIPTION_RANGE[1], DESCRIPTION_RANGE[0]),
        heading: t('One day in {city}', { city: placeName(place, t) }),
        lede: t('A day through {city}’s best-known sights that lie close together: {top}. {n} stops, about {km, distance} between them in straight lines; the streets make it longer.', { city: city(t), top: named(stops, stops.length, t), n: stops.length, km }),
      };
    }
    return {
      title: fit(placeFirst(place, [
        (t, city) => t('A week in {city}: a 7-day itinerary, day by day', { city }),
        (t, city) => t('7 days in {city}: a day-by-day itinerary', { city }),
        (t, city) => t('A week in {city}', { city }),
      ]), t, TITLE_MAX),
      description: fit([
        ...[2, 1].map(k => (t: Translate) => t('A week in {city}: a 7-day itinerary through {n} of its top attractions, starting with {top}, each day the places that lie close together.', { city: city(t), n: stops.length, top: named(stops, k, t) })),
        ...[2, 1].map(k => (t: Translate) => t('A week in {city}: seven walks through {n} of its best-known sights, starting with {top}, each day the places that lie close together.', { city: city(t), n: stops.length, top: named(stops, k, t) })),
        t => t('A week in {city}: seven walks through {n} of its best-known sights, each day the places that lie close together.', { city: city(t), n: stops.length }),
      ], t, DESCRIPTION_RANGE[1], DESCRIPTION_RANGE[0]),
      heading: t('A week in {city}', { city: placeName(place, t) }),
      lede: t('Seven days in {city}, each a walk through best-known places that lie close together, the best known first: day one starts at {first}. {n} stops in all.', { city: city(t), first: stopName(stops[0], t.locale), n: stops.length }),
    };
  },

  summary: (place, { data }, t) => (place.kind === 'country'
    ? t('Seven days through {cities}', { cities: cityNames(data, t) })
    : data.length === 'day'
      ? t('{n} stops in a day, starting at {first}', { n: data.days[0].stops.length, first: stopName(data.days[0].stops[0], t.locale) })
      : t('Seven days of sights, starting at {first}', { first: stopName(data.days[0].stops[0], t.locale) })),

  open(place, page) {
    const embed: EmbedSpec = { layers: [], bbox: planBox(page.data), plan: `${place.id}:${page.slug}` };
    return { layers: ['things_to_do'], ...(place.kind === 'country' ? {} : { zoom: 13 }), embed };
  },
  openLabel: msg('See the places on the live map'),

  async detail(place, { slug, data }, t) {
    const [photos, route] = await Promise.all([
      photosFor([...new Set(stopsOf(data).map(s => s.id))]),
      ownApi<GeoJSON.FeatureCollection>(`/api/things-to-do/plan?place=${place.id}&slug=${slug}&lang=${t.locale}`, WEEK_S),
    ]);
    const walks = Object.fromEntries((route?.features ?? []).flatMap(f => {
      const p = f.properties as { kind?: string; day?: number; km?: number; minutes?: number } | null;
      return p?.kind === 'walk' && p.day && p.km !== undefined && p.minutes !== undefined ? [[p.day, { km: p.km, minutes: p.minutes }]] : [];
    }));
    return { photos, walks };
  },
};

export type PlansPage = TopicPage<PlansData>;
