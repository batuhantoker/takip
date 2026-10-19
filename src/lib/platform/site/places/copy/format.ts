import { createTranslator, msg, type Translate } from '@/lib/core/i18n/translator';
import { sortModes, type TransitMode } from '@/lib/feeds/transit/modes';
import { placeLabel, regionLabel } from '../gazetteer';
import { placeSlugBase, type Place } from '../place';

export const EN = createTranslator('en', {});

/** Countries whose towns people name with their state or province. */
const WITH_REGION = new Set(['US', 'CA', 'AU']);

export const countryName = (cc: string, t: Translate) => {
  try {
    return new Intl.DisplayNames([t.intl], { type: 'region' }).of(cc) ?? cc;
  } catch {
    return cc;
  }
};

/** Another place took the plain name ("London"), so this one is told apart by where it is. */
const sharesName = (place: Place) => place.kind === 'city' && place.slug !== placeSlugBase(place.name);

/** What tells a shared name apart: the region, unless it is named like the place (Sinop in Sinop), then the country. */
function qualifier(place: Place, t: Translate) {
  return place.region && placeSlugBase(place.region) !== placeSlugBase(place.name) ? regionLabel(place, t.locale)! : countryName(place.cc, t);
}

/** The place's name in the reader's language: "Nevşehir", "ネヴシェヒル", "Fulton County, GA", and "London, Ontario" where the plain name is taken. */
export function nameOf(place: Place, t: Translate): string {
  if (place.kind === 'country') return countryName(place.cc, t);
  if (place.kind === 'state') return placeLabel(place, t.locale);
  // Thirty states have a Washington County.
  if (place.kind === 'county' || place.kind === 'town') return `${placeLabel(place, t.locale)}, ${place.regionCode}`;
  const label = placeLabel(place, t.locale);
  return sharesName(place) ? `${label}, ${qualifier(place, t)}` : label;
}

/** "Cincinnati, Ohio", "Nevşehir, Türkiye", "London, Ontario, Canada"; a country is just itself. */
export function placeName(place: Place, t: Translate): string {
  if (place.kind === 'country') return countryName(place.cc, t);
  if (place.kind === 'state') return `${placeLabel(place, t.locale)}, ${countryName(place.cc, t)}`;
  if (place.kind === 'county' || place.kind === 'town') return `${placeLabel(place, t.locale)}, ${regionLabel(place, t.locale)}`;
  if (sharesName(place)) return `${nameOf(place, t)}${qualifier(place, t) === regionLabel(place, t.locale) ? `, ${countryName(place.cc, t)}` : ''}`;
  return `${nameOf(place, t)}, ${WITH_REGION.has(place.cc) && place.region ? regionLabel(place, t.locale) : countryName(place.cc, t)}`;
}

/** "a, b and c": English without the serial comma, like the rest of the site. */
export const listOf = (items: string[], t: Translate) =>
  new Intl.ListFormat(t.locale === 'en' ? 'en-GB' : t.intl, { type: 'conjunction' }).format(items);

export const count = (n: number, t: Translate) => new Intl.NumberFormat(t.intl).format(n);

export const dayOf = (iso: string, t: Translate) =>
  new Intl.DateTimeFormat(t.intl, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(Date.parse(iso));

const MODE_PLURAL: Record<TransitMode, string> = {
  metro: msg('metro'), rail: msg('trains'), tram: msg('trams'), bus: msg('buses'), trolleybus: msg('trolleybuses'), ferry: msg('ferries'), cable: msg('cable cars'),
};

/** "buses and trams", heaviest first. */
export const modesPlural = (modes: readonly TransitMode[], t: Translate) => listOf(sortModes(modes).map(m => t(MODE_PLURAL[m])), t);

export const sentenceStart = (s: string) => s.charAt(0).toLocaleUpperCase() + s.slice(1);

/**
 * The first candidate whose English fits within [min, max] characters, rendered in the reader's language. The
 * choice is made on the English so every language says the same thing; the last candidate is the fallback.
 */
export function fit(candidates: ((t: Translate) => string)[], t: Translate, max: number, min = 0): string {
  const i = candidates.findIndex(c => {
    const n = c(EN).length;
    return n <= max && n >= min;
  });
  return candidates[i < 0 ? candidates.length - 1 : i](t);
}

export const TITLE_MAX = 60;
export const DESCRIPTION_RANGE = [110, 160] as const;
