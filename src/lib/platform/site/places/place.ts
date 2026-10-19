import type { Locale } from '@/lib/core/i18n/locales';

export type PlaceKind = 'city' | 'country';

/** A place a public page can be about, from data/site/gazetteer.json (tools/site/build-gazetteer.ts). */
export interface Place {
  /** GeoNames id: every topic table is keyed by it. */
  id: number;
  kind: PlaceKind;
  slug: string;
  /** GeoNames' name, in English or the local Latin spelling. */
  name: string;
  /** The name in other languages, where it differs. */
  names?: Partial<Record<Locale, string>>;
  /** ISO 3166-1 alpha-2. */
  cc: string;
  /** State, province or region. */
  region?: string;
  /** The US state's postal code. */
  regionCode?: string;
  /** [lon, lat]; a country's is where its label goes. */
  at: [number, number];
  pop: number;
  /** A country's area in km². */
  area?: number;
}

export interface GazetteerFile { generated: string; places: Place[] }

/** "Kraków" → "krakow", "St. John's" → "st-johns". */
export function placeSlugBase(name: string): string {
  return name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[łŁ]/g, 'l').replace(/[ıİ]/g, 'i').toLowerCase()
    .replace(/['’.]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
