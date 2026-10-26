import type { Locale } from '@/lib/core/i18n/locales';
import { msg, type Translate } from '@/lib/core/i18n/translator';
import { DESCRIPTION_RANGE, fit, listOf, nameOf, placeFirst, placeName, TITLE_MAX } from '../copy/format';
import { topicTable } from '../tables';
import type { PlaceTopic, TopicPage } from '../topic';
import { KIND_GROUPS, type AttractionItem, type AttractionKind, type AttractionsMeta, type AttractionsRow } from './attractions-data';

/**
 * Things to do at /city/<place>/things-to-do and /country/<place>/things-to-do: museums, landmarks, castles, palaces,
 * cathedrals, parks, gardens and zoos from Wikidata, ranked by how many Wikipedias have an article about each
 * (tools/site/topics/attractions.ts). Each counts for one city only, so a district doesn't repeat its city's list.
 * Indexed where enough of them are well known: eight with articles in five Wikipedias for a city, ten for a country.
 */

export interface AttractionEntry {
  id: string;
  item: AttractionItem;
  /** A city's: km from its centre. */
  km?: number;
  /** A country's: the GeoNames id of the city it counts for, 0 for none. */
  city?: number;
}

export interface AttractionsData { entries: AttractionEntry[]; reachKm: number }

/** Articles in this many Wikipedias make an item well known, for the index bar. */
const KNOWN_LINKS = 5;
const MIN_KNOWN_CITY = 8;
const MIN_KNOWN_COUNTRY = 10;

const table = () => topicTable<AttractionsRow, AttractionsMeta>('attractions');

export const KIND_LABEL: Record<AttractionKind, string> = {
  museum: msg('Museum'), castle: msg('Castle'), palace: msg('Palace'), cathedral: msg('Cathedral'), park: msg('Park'),
  garden: msg('Garden'), zoo: msg('Zoo or aquarium'), square: msg('Square'), monument: msg('Monument'),
  fountain: msg('Fountain'), statue: msg('Statue'), landmark: msg('Landmark'),
};

/** The item's name in the reader's language, English where it has none. */
export const attractionName = (item: AttractionItem, locale: Locale) => item.n[locale] ?? item.n.en ?? '';

/** Its article in the reader's Wikipedia where there is one, else English's, through Wikidata's redirect. */
export function attractionWiki(id: string, item: AttractionItem, locale: Locale): string {
  const langs = item.w.split(' ').filter(Boolean);
  const lang = langs.includes(locale) ? locale : langs.includes('en') ? 'en' : langs[0];
  return lang ? `https://www.wikidata.org/wiki/Special:GoToLinkedPage/${lang}wiki/${id}` : `https://www.wikidata.org/wiki/${id}`;
}

export const groupCounts = (entries: AttractionEntry[]) =>
  Object.fromEntries(KIND_GROUPS.map(g => [g.id, entries.filter(e => g.kinds.includes(e.item.k)).length])) as Record<string, number>;

const COUNT: Record<string, string> = {
  museums: msg('{n, plural, one {# museum} other {# museums}}'),
  landmarks: msg('{n, plural, one {# landmark} other {# landmarks}}'),
  historic: msg('{n, plural, one {# castle, palace or cathedral} other {# castles, palaces and cathedrals}}'),
  outdoors: msg('{n, plural, one {# park, garden or zoo} other {# parks, gardens and zoos}}'),
};

/** "12 museums, 9 landmarks and 5 parks, gardens and zoos", the `k` biggest groups. */
function counts(entries: AttractionEntry[], k: number, t: Translate) {
  const c = groupCounts(entries);
  return listOf(KIND_GROUPS.map(g => g.id).filter(id => c[id] > 0).sort((a, b) => c[b] - c[a]).slice(0, k).map(id => t(COUNT[id], { n: c[id] })), t);
}

const top = (entries: AttractionEntry[], k: number, t: Translate) => listOf(entries.slice(0, k).map(e => attractionName(e.item, t.locale)), t);

export const ATTRACTIONS: PlaceTopic<AttractionsData> = {
  id: 'attractions',
  label: msg('Things to do'),
  inline: msg('things to do'),
  kinds: ['city', 'country'],

  pages(place) {
    const { rows, meta } = table();
    const row = rows[String(place.id)];
    if (!row || !meta) return [];
    const entries = row.a.flatMap(([id, n]) => {
      const item = meta.items[id];
      return item ? [place.kind === 'country' ? { id, item, city: n } : { id, item, km: n }] : [];
    });
    if (!entries.length) return [];
    const known = entries.filter(e => e.item.l >= KNOWN_LINKS).length;
    const reachKm = Math.max(1, ...entries.map(e => e.km ?? 0));
    return [{ slug: 'things-to-do', data: { entries, reachKm }, index: known >= (place.kind === 'country' ? MIN_KNOWN_COUNTRY : MIN_KNOWN_CITY) }];
  },

  header(place, { data: { entries, reachKm } }, t) {
    const historicLeads = groupCounts(entries).historic > groupCounts(entries).museums;
    if (place.kind === 'country') {
      const country = (t: Translate) => nameOf(place, t);
      return {
        title: fit([
          t => t('Things to do in {country}: museums, castles and landmarks', { country: country(t) }),
          t => t('Things to do in {country}', { country: country(t) }),
        ], t, TITLE_MAX),
        description: fit([
          ...[3, 2].map(k => (t: Translate) => t('Things to do in {country}: {top} and more of its best-known museums, castles, parks and landmarks, each with its Wikipedia article.', { country: country(t), top: top(entries, k, t) })),
          t => t('Things to do in {country}: its best-known museums, castles, parks and landmarks, ranked by how many Wikipedias write about them.', { country: country(t) }),
        ], t, DESCRIPTION_RANGE[1], DESCRIPTION_RANGE[0]),
        heading: t('Things to do in {country}', { country: country(t) }),
        lede: t('The best-known places to see in {country}, by how many Wikipedias have an article about them: {top}, and {n} more across the country.', { country: country(t), top: top(entries, 3, t), n: Math.max(0, entries.length - 3) }),
      };
    }
    const city = (t: Translate) => nameOf(place, t);
    return {
      title: fit(placeFirst(place, [
        historicLeads
          ? (t, city) => t('Things to do in {city}: castles, museums and parks', { city })
          : (t, city) => t('Things to do in {city}: museums, parks and landmarks', { city }),
        (t, city) => t('Things to do in {city}: sights and museums', { city }),
        (t, city) => t('Things to do in {city}', { city }),
      ]), t, TITLE_MAX),
      description: fit([
        ...[3, 2, 1].flatMap(k => [
          (t: Translate) => t('Things to do in {place}: {counts} within {km, radius} of the centre, each with its Wikipedia article and its place on the map.', { place: placeName(place, t), counts: counts(entries, k, t), km: reachKm }),
          (t: Translate) => t('Things to do in {city}: {counts} within {km, radius} of the centre, each with its Wikipedia article.', { city: city(t), counts: counts(entries, k, t), km: reachKm }),
        ]),
        t => t('Things to do in {place}: its best-known museums, parks and landmarks, ranked by how many Wikipedias write about them.', { place: placeName(place, t) }),
      ], t, DESCRIPTION_RANGE[1], DESCRIPTION_RANGE[0]),
      heading: t('Things to do in {city}', { city: placeName(place, t) }),
      lede: entries.length > 3
        ? t('The best-known places to see in {city}, by how many Wikipedias have an article about them: {top}, and {n} more within {km, radius} of the centre.', { city: city(t), top: top(entries, 3, t), n: entries.length - 3, km: reachKm })
        : t('The best-known places to see in {city}, by how many Wikipedias have an article about them: {top}.', { city: city(t), top: top(entries, 3, t) }),
    };
  },

  summary: (place, { data: { entries } }, t) => t('{n, plural, one {# place to see} other {# places to see}}, led by {top}', { n: entries.length, top: top(entries, 2, t) }),

  open: place => ({ zoom: place.kind === 'country' ? undefined : 13 }),
};

export type AttractionsPage = TopicPage<AttractionsData>;
