import type { Locale } from '@/lib/core/i18n/locales';
import { msg } from '@/lib/core/i18n/translator';

/*
 * The things-to-do table (data/site/topics/attractions.json, tools/site/topics/attractions.ts): places from Wikidata
 * (CC0) with coordinates and articles in several Wikipedias, each credited to one city. Shared by the builder and
 * the pages.
 */

export type AttractionKind =
  | 'museum' | 'castle' | 'palace' | 'cathedral' | 'park' | 'garden' | 'zoo' | 'square' | 'monument' | 'fountain' | 'statue' | 'landmark';

/**
 * Wikidata classes for each kind (P31/P279*), most specific first: an item that is several takes the first.
 * Statues and fountains are many and mostly minor, so they need more Wikipedias to count.
 */
export const KINDS: readonly { kind: AttractionKind; classes: string[]; minLinks: number }[] = [
  { kind: 'museum', classes: ['Q33506'], minLinks: 3 },
  { kind: 'castle', classes: ['Q23413'], minLinks: 3 },
  { kind: 'palace', classes: ['Q16560'], minLinks: 3 },
  { kind: 'cathedral', classes: ['Q2977'], minLinks: 3 },
  { kind: 'zoo', classes: ['Q43501', 'Q2281788'], minLinks: 3 },
  { kind: 'garden', classes: ['Q1107656'], minLinks: 3 },
  { kind: 'park', classes: ['Q22698'], minLinks: 3 },
  { kind: 'square', classes: ['Q174782'], minLinks: 5 },
  { kind: 'monument', classes: ['Q4989906'], minLinks: 3 },
  { kind: 'fountain', classes: ['Q483453'], minLinks: 5 },
  { kind: 'statue', classes: ['Q179700'], minLinks: 5 },
  { kind: 'landmark', classes: ['Q570116'], minLinks: 3 },
];

/** UNESCO World Heritage Site, as P1435 (heritage designation): how the Grand-Place qualifies. */
export const WORLD_HERITAGE = 'Q9259';

/** The section each kind is listed under, in the page's order. */
export const KIND_GROUPS: readonly { id: string; label: string; kinds: AttractionKind[] }[] = [
  { id: 'museums', label: msg('Museums'), kinds: ['museum'] },
  { id: 'landmarks', label: msg('Landmarks and monuments'), kinds: ['landmark', 'monument', 'square', 'fountain', 'statue'] },
  { id: 'historic', label: msg('Castles, palaces and cathedrals'), kinds: ['castle', 'palace', 'cathedral'] },
  { id: 'outdoors', label: msg('Parks, gardens and zoos'), kinds: ['park', 'garden', 'zoo'] },
];

export interface AttractionItem {
  k: AttractionKind;
  /** On UNESCO's World Heritage List. */
  h?: 1;
  /** How many Wikipedias have an article: the notability every list is ranked by. */
  l: number;
  /** [lon, lat], 4 decimals. */
  at: [number, number];
  /** Its name in English, and in our other languages where it differs. */
  n: Partial<Record<Locale, string>>;
  /** Which of our languages' Wikipedias have an article, "en fr de". */
  w: string;
}

export interface AttractionsMeta {
  /** By Wikidata id. */
  items: Record<string, AttractionItem>;
  /** How far from a city's centre its attractions may be credited to it. */
  cityKm: number;
}

/**
 * A city's: [item id, km from the centre], most Wikipedias first. A country's: [item id, the GeoNames id of the city
 * it is credited to, or 0].
 */
export interface AttractionsRow { a: [string, number][] }
