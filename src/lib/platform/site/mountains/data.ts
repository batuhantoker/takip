import type { Locale } from '@/lib/core/i18n/locales';
import { msg } from '@/lib/core/i18n/translator';

/*
 * The mountain index, data/db/mountains.db (tools/site/build-mountains.ts): every mountain, hill and volcano on
 * Wikidata (CC0) with coordinates and an article in a Wikipedia not written by a bot. Shared by the builder and the
 * pages.
 */

export const MOUNTAINS_DB = 'mountains.db';

export type MountainKind = 'mountain' | 'volcano' | 'hill';

export const KIND_LABEL: Record<MountainKind, string> = { mountain: msg('Mountain'), volcano: msg('Volcano'), hill: msg('Hill') };

/** Names and article titles by page language. */
export type ByLocale = Partial<Record<Locale, string>>;

/** A row of `mountain`, its JSON columns parsed. */
export interface Mountain {
  qid: number;
  slug: string;
  kind: MountainKind;
  names: ByLocale;
  /** Article titles in the page languages' Wikipedias. */
  wiki: ByLocale;
  /** Wikipedias with an article, bot-written ones left out. */
  articles: number;
  lon: number;
  lat: number;
  /** Metres above sea level. */
  elev: number | null;
  /** Metres. */
  prom: number | null;
  /** Kilometres to the nearest higher ground. */
  isol: number | null;
  parent: number | null;
  range: number | null;
  /** ISO 3166-1 alpha-2, the first the one Wikidata lists first. */
  cc: string[];
  /** First ascent: YYYY, YYYY-MM or YYYY-MM-DD. */
  ascent: string | null;
  /** A Wikimedia Commons file name. */
  image: string | null;
  /** The Smithsonian Global Volcanism Program's volcano number. */
  gvp: string | null;
  /** Places it is the highest point of. */
  highest: number[];
  /** The nearest city or town in the gazetteer (a GeoNames id), within about 300 km. */
  place: number | null;
  /** That town's time zone, for the forecast's clock. */
  tz: string | null;
  indexed: boolean;
}

/** What `place` holds: the ranges, countries, continents and regions mountains name. */
export interface MountainPlace {
  qid: number;
  kind: 'world' | 'continent' | 'country' | 'range' | 'other';
  names: ByLocale;
  cc: string | null;
}

/** The name in the page's language, else English, else any. */
export function nameIn(names: ByLocale, locale: Locale): string | null {
  return names[locale] ?? names.en ?? Object.values(names)[0] ?? null;
}
