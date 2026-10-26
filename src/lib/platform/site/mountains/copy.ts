import type { Translate } from '@/lib/core/i18n/translator';
import { msg } from '@/lib/core/i18n/translator';
import { leadSentences } from '@/lib/core/wikipedia/summary';
import { allPlaces } from '@/lib/platform/site/places/gazetteer';
import type { Place } from '@/lib/platform/site/places/place';
import { KIND_LABEL, nameIn, type Mountain, type MountainPlace } from './data';

/* The words on a mountain page that come from its data: heights in the reader's units, titles and descriptions. */

const FT_PER_M = 3.28084;
const CJK = new Set(['zh', 'ja']);

/** US peaks are known by their height in feet; everyone else's in metres, with feet beside for English readers. */
export const feetFirst = (m: Pick<Mountain, 'cc'>) => m.cc[0] === 'US';

/** "8,849 m (29,032 ft)", or the other way round for a US peak. */
export function heightText(t: Translate, metres: number, feet: boolean): string {
  const nf = new Intl.NumberFormat(t.intl, { maximumFractionDigits: 0 });
  const m = t('{n} m', { n: nf.format(metres) });
  const ft = t('{n} ft', { n: nf.format(metres * FT_PER_M) });
  return feet ? `${ft} (${m})` : `${m} (${ft})`;
}

/** The short form, for lists: "8,849 m" or "14,505 ft". */
export function heightShort(t: Translate, metres: number, feet: boolean): string {
  const nf = new Intl.NumberFormat(t.intl, { maximumFractionDigits: 0 });
  return feet ? t('{n} ft', { n: nf.format(metres * FT_PER_M) }) : t('{n} m', { n: nf.format(metres) });
}

export const kindLabel = (t: Translate, m: Pick<Mountain, 'kind'>) => t(KIND_LABEL[m.kind]);

let countries: { from: readonly Place[]; byCc: Map<string, Place> } | null = null;

/** The gazetteer's country by ISO code, without a scan of every place per call. */
export function countryOf(cc: string): Place | undefined {
  const places = allPlaces();
  if (countries?.from !== places) countries = { from: places, byCc: new Map(places.filter(p => p.kind === 'country').map(p => [p.cc, p])) };
  return countries.byCc.get(cc);
}

/**
 * A country's name in the reader's language: in English the place pages' own ("Turkey", which is what people search
 * for, where CLDR now says "Türkiye"), elsewhere CLDR's short form ("Çin", not the gazetteer's "Çin Halk Cumhuriyeti").
 */
export function countryName(t: Translate, cc: string): string {
  const own = t.locale === 'en' ? countryOf(cc)?.name : undefined;
  if (own) return own;
  try {
    return new Intl.DisplayNames(t.intl, { type: 'region' }).of(cc) ?? cc;
  } catch {
    return cc;
  }
}

/** "1953-05-29" → "29 May 1953"; a year alone stays a year. */
export function ascentText(t: Translate, ascent: string): string {
  const [y, mo, d] = ascent.split('-').map(Number);
  if (!mo) return String(y);
  const opts: Intl.DateTimeFormatOptions = d ? { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' } : { year: 'numeric', month: 'long', timeZone: 'UTC' };
  return new Intl.DateTimeFormat(t.intl, opts).format(Date.UTC(y, mo - 1, d || 1));
}

export const placeLabel = (t: Translate, p: MountainPlace | undefined) => (p ? nameIn(p.names, t.locale) : null);

const TOPS: MountainPlace['kind'][] = ['world', 'continent', 'country', 'range'];
const MAX_TOPS = 6;

/**
 * What a peak is the highest point of, as a reader would list it: the Earth, then continents, countries and ranges.
 * Wikidata also files Everest as the top of districts, parks, hemispheres and expeditions.
 */
export function topsOf(t: Translate, m: Pick<Mountain, 'highest'>, places: Map<number, MountainPlace>): string[] {
  return m.highest.flatMap(q => places.get(q) ?? [])
    .filter(p => TOPS.includes(p.kind))
    .sort((a, b) => TOPS.indexOf(a.kind) - TOPS.indexOf(b.kind))
    .flatMap(p => (p.kind === 'country' && p.cc ? countryName(t, p.cc) : placeLabel(t, p)) ?? [])
    .slice(0, MAX_TOPS);
}

const TITLES = [
  msg('{name}, {country}: height, weather and map'),
  msg('{name}: height, weather and map'),
  msg('{name}, {country}'),
];
const VOLCANO_TITLES = [
  msg('{name} volcano, {country}: height, eruptions and map'),
  msg('{name}, {country}: volcano height, weather and map'),
  msg('{name}: volcano height, weather and map'),
  msg('{name}, {country}'),
];

/**
 * The title search sees: the name and its country, then the words people type after a mountain's name (its height,
 * its weather, a map), dropping words until it fits; volcanoes add their eruptions when they have any.
 */
export function mountainTitle(t: Translate, m: Mountain, name: string, eruptions: number): string {
  const max = CJK.has(t.locale) ? 32 : 60;
  const country = m.cc[0] ? countryName(t, m.cc[0]) : '';
  const pool = (m.kind === 'volcano' ? VOLCANO_TITLES.slice(eruptions ? 0 : 1) : TITLES).filter(p => country || !p.includes('{country}'));
  const fits = pool.map(p => t(p, { name, country })).find(s => [...s].length <= max);
  return fits ?? name;
}

/** "a 5,137 m volcano in Turkey, in the Armenian Highlands" as a sentence of its own. */
export function mountainLine(t: Translate, m: Mountain, name: string, range: string | null): string {
  // Mid-sentence the kind is lowercase, but German capitalises its nouns.
  const kind = t.locale === 'de' ? kindLabel(t, m) : kindLabel(t, m).toLocaleLowerCase(t.intl);
  const country = new Intl.ListFormat(t.intl, { type: 'conjunction' }).format(m.cc.map(cc => countryName(t, cc)));
  const height = m.elev !== null ? heightShort(t, m.elev, feetFirst(m)) : null;
  if (height && country && range) return t('{name} is a {kind} in the {range}, {country}, {height} high.', { name, height, kind, country, range });
  if (height && country) return t('{name} is a {kind} in {country}, {height} high.', { name, height, kind, country });
  if (country) return t('{name} is a {kind} in {country}.', { name, kind, country });
  return height ? t('{name} is a {kind}, {height} high.', { name, height, kind }) : t('{name} is a {kind}.', { name, kind });
}

/**
 * The search description: Wikipedia's opening in the page's language where it is long enough, else the mountain's
 * own line, then what the page holds that others don't.
 */
export function mountainDescription(t: Translate, m: Mountain, name: string, range: string | null, extract: string | null): string {
  const [min, max] = CJK.has(t.locale) ? [40, 90] : [110, 160];
  const tail = t('Summit weather forecast, nearby peaks and a 3D map.');
  if (extract) {
    const lead = leadSentences(extract, max);
    const both = `${lead} ${tail}`;
    if ([...both].length >= min && [...both].length <= max) return both;
    if ([...lead].length >= min) return lead;
  }
  const line = mountainLine(t, m, name, range);
  return [`${line} ${tail}`, line].find(d => [...d].length <= max) ?? line;
}

/** Wikidata's coordinates as people write them: 27.988°N 86.925°E. */
export function coordinatesText(m: Pick<Mountain, 'lat' | 'lon'>): string {
  return `${Math.abs(m.lat).toFixed(3)}°${m.lat >= 0 ? 'N' : 'S'} ${Math.abs(m.lon).toFixed(3)}°${m.lon >= 0 ? 'E' : 'W'}`;
}
