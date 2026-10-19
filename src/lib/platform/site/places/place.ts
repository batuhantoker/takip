import type { Locale } from '@/lib/core/i18n/locales';

/** Towns, counties and states are US-only, from the Census (us-areas.ts). */
export type PlaceKind = 'city' | 'town' | 'county' | 'state' | 'country';

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
  /** State, province or region, in English. */
  region?: string;
  /** GeoNames' key for the region, "TR.34": its name in other languages is in GazetteerFile.regions. */
  admin1?: string;
  /** The US state's postal code. */
  regionCode?: string;
  /** [lon, lat]; a country's is where its label goes. */
  at: [number, number];
  pop: number;
  /** A country's, state's or county's area in km². */
  area?: number;
  /** The places it lies within, outermost first: a county's state, a US city's or town's state and county. */
  parents?: number[];
}

export interface GazetteerFile {
  generated: string;
  /** Region names in other languages, where they differ from the English, by admin1 key. */
  regions?: Record<string, Partial<Record<Locale, string>>>;
  places: Place[];
}

/** Letters that Unicode doesn't split into a base and an accent, so stripping accents would drop them. */
const LETTERS: Record<string, string> = { ø: 'o', æ: 'ae', œ: 'oe', ß: 'ss', đ: 'd', ð: 'd', þ: 'th', ł: 'l', ı: 'i', ħ: 'h', ŧ: 't', ŋ: 'n', ŀ: 'l' };

/** "Kraków" → "krakow", "Tromsø" → "tromso", "St. John's" → "st-johns". */
export function placeSlugBase(name: string): string {
  return name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[øæœßđðþłıħŧŋŀ]/g, ch => LETTERS[ch])
    .replace(/['’.]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
