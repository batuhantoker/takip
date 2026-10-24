import type { Translate } from '@/lib/core/i18n/translator';
import { nameOf } from '../places/copy/format';
import { placeById, placeBySlug } from '../places/gazetteer';
import type { Place } from '../places/place';
import { indicatorTable } from '../places/topics/indicators-table';
import { COUNTRY_ALIASES, foldName, matchCountries, type CountryOption } from './country-search';

/** Every country with numbers, by name in the reader's language, as the pickers offer them and find them. */
export function countryOptions(t: Translate): (CountryOption & { place: Place })[] {
  const collator = new Intl.Collator(t.intl);
  const { rows } = indicatorTable();
  return Object.entries(rows).flatMap(([id, row]) => {
    const place = placeById(Number(id));
    if (!place) return [];
    const name = nameOf(place, t);
    const also = foldName(name.replaceAll('&', 'and')) !== foldName(place.name) ? place.name : undefined;
    const alias = COUNTRY_ALIASES[place.cc] ?? {};
    const shown = new Set([foldName(name), ...(also ? [foldName(also)] : [])]);
    const alt = [...new Set([...(alias.alt ?? []), ...Object.values(place.names ?? {}).map(foldName)])].filter(n => n && !shown.has(n));
    const codes = [...new Set([place.cc, ...(row.key ? [row.key] : [])].map(c => c.toLowerCase()).concat(alias.codes ?? []))];
    return [{ place, slug: place.slug, name, ...(also && { also }), ...(alt.length && { alt }), codes }];
  }).sort((x, y) => collator.compare(x.name, y.name));
}

/** What the browser needs of them. */
export const pickerOptions = (t: Translate, skip: Set<number> = new Set()): CountryOption[] =>
  countryOptions(t).flatMap(({ place, ...option }) => (skip.has(place.id) ? [] : [option]));

/** The country a picker sent: its slug, or whatever the picker would have found first for the text as typed. */
export function findCountry(text: string, t: Translate): Place | undefined {
  const bySlug = placeBySlug('country', text);
  if (bySlug && indicatorTable().rows[String(bySlug.id)]) return bySlug;
  return foldName(text) ? matchCountries(countryOptions(t), text)[0]?.place : undefined;
}
