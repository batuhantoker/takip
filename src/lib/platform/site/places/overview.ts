import type { Translate } from '@/lib/core/i18n/translator';
import { DESCRIPTION_RANGE, fit, listOf, nameOf, placeFirst, placeName, TITLE_MAX } from './copy/format';
import { inNavOrder, type PlacePageRef } from './pages';
import type { Place } from './place';
import type { PlaceCopy } from './topic';

/** A place's overview page: what it has on the map, by its topics' own names and summaries. */
export function overviewCopy(place: Place, all: PlacePageRef[], t: Translate, places = 0): PlaceCopy {
  // Faith pages are reached from the place's Prayers page, not named among its topics; a country names its strongest first.
  const pages = inNavOrder(place, all.filter(p => !p.topic.faith));
  if (!pages.length && place.kind !== 'city') return countryOverview(place, t, places);
  const name = (t: Translate) => nameOf(place, t);
  // A topic with several pages (earthquakes over 10 and 100 years) is named once.
  const labels = (t: Translate, k: number) => listOf([...new Set(pages.map(p => t(p.topic.inline)))].slice(0, k), t);
  const n = pages.length;
  return {
    title: fit(placeFirst(place, [
      ...[n, 3, 2].map(k => (t: Translate, city: string) => t('{city} live map: {things}', { city, things: labels(t, k) })),
      (t, city) => t('{city} live map', { city }),
    ]), t, TITLE_MAX),
    description: fit([
      ...[n, 3, 2].map(k => (t: Translate) => t('{place} on one free live map: {things}, each with where its data comes from and what is true right now.', { place: placeName(place, t), things: labels(t, k) })),
      ...[n, 3, 2].map(k => (t: Translate) => t('{city} on one free live map: {things}, with where the data comes from.', { city: name(t), things: labels(t, k) })),
      t => t('{place} on one free live map, with where each layer’s data comes from and what is true there right now.', { place: placeName(place, t) }),
    ], t, DESCRIPTION_RANGE[1], DESCRIPTION_RANGE[0]),
    heading: t('{city}, live', { city: name(t) }),
    lede: t('What TAKIP’s live map has for {place}: {things}. Each page says where its data comes from and what is true there right now.', {
      place: placeName(place, t), things: labels(t, n),
    }),
  };
}

/** A country, state or county with no pages of its own yet: the way to its places. */
function countryOverview(place: Place, t: Translate, places: number): PlaceCopy {
  const name = (t: Translate) => nameOf(place, t);
  return {
    title: fit([
      t => t('{country} live map: transit, cameras and weather by city', { country: name(t) }),
      t => t('{country} live map by city', { country: name(t) }),
    ], t, TITLE_MAX),
    description: fit([
      t => t('{n, plural, one {One place} other {# places}} in {country} on TAKIP’s free live map, each with its buses and trains, public cameras, flights and weather where they exist.', { n: places, country: name(t) }),
      t => t('Places in {country} on TAKIP’s free live map, each with its buses and trains, public cameras, flights and weather where they exist.', { country: name(t) }),
    ], t, DESCRIPTION_RANGE[1], DESCRIPTION_RANGE[0]),
    heading: t('{country}, live', { country: name(t) }),
    lede: t('{n, plural, one {One place} other {# places}} in {country} have pages of their own, each with what the live map has there and where the data comes from.', { n: places, country: name(t) }),
  };
}
