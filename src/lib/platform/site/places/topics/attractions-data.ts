import type { Locale } from '@/lib/core/i18n/locales';
import { msg } from '@/lib/core/i18n/translator';

/*
 * The things-to-do table (data/site/topics/attractions.json, tools/site/topics/attractions.ts): places from Wikidata
 * (CC0) with coordinates and articles in several Wikipedias, each credited to one city. Shared by the builder and
 * the pages.
 */

export type AttractionKind =
  | 'museum' | 'castle' | 'palace' | 'cathedral' | 'church' | 'mosque' | 'temple' | 'synagogue' | 'park' | 'garden' | 'zoo' | 'square'
  | 'bridge' | 'tower' | 'skyscraper' | 'theatre' | 'ruins' | 'monument' | 'fountain' | 'statue' | 'landmark';

/**
 * Wikidata classes for each kind (P31/P279*), most specific first: an item that is several takes the first.
 * Statues and fountains are many and mostly minor, so they need more Wikipedias to count.
 */
export const KINDS: readonly { kind: AttractionKind; classes: string[]; minLinks: number }[] = [
  { kind: 'museum', classes: ['Q33506'], minLinks: 3 },
  { kind: 'castle', classes: ['Q23413'], minLinks: 3 },
  { kind: 'palace', classes: ['Q16560'], minLinks: 3 },
  { kind: 'cathedral', classes: ['Q2977'], minLinks: 3 },
  { kind: 'mosque', classes: ['Q32815'], minLinks: 5 },
  { kind: 'synagogue', classes: ['Q34627'], minLinks: 8 },
  // Temples of every faith, and Shinto shrines.
  { kind: 'temple', classes: ['Q44539', 'Q697295'], minLinks: 5 },
  { kind: 'church', classes: ['Q16970'], minLinks: 8 },
  { kind: 'zoo', classes: ['Q43501', 'Q2281788'], minLinks: 3 },
  { kind: 'garden', classes: ['Q1107656'], minLinks: 3 },
  { kind: 'park', classes: ['Q22698'], minLinks: 3 },
  { kind: 'square', classes: ['Q174782'], minLinks: 5 },
  { kind: 'theatre', classes: ['Q24354'], minLinks: 10 },
  { kind: 'bridge', classes: ['Q12280'], minLinks: 8 },
  { kind: 'skyscraper', classes: ['Q11303'], minLinks: 15 },
  // Towers of every kind: the Eiffel Tower is a lattice tower, not a tourist attraction, to Wikidata.
  { kind: 'tower', classes: ['Q12518'], minLinks: 8 },
  { kind: 'ruins', classes: ['Q839954'], minLinks: 5 },
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
  { id: 'landmarks', label: msg('Landmarks and monuments'), kinds: ['landmark', 'monument', 'tower', 'bridge', 'skyscraper', 'theatre', 'ruins', 'square', 'fountain', 'statue'] },
  { id: 'historic', label: msg('Castles, palaces and cathedrals'), kinds: ['castle', 'palace', 'cathedral'] },
  { id: 'worship', label: msg('Churches, mosques and temples'), kinds: ['church', 'mosque', 'temple', 'synagogue'] },
  { id: 'outdoors', label: msg('Parks, gardens and zoos'), kinds: ['park', 'garden', 'zoo'] },
];

export const KIND_LABEL: Record<AttractionKind, string> = {
  museum: msg('Museum'), castle: msg('Castle'), palace: msg('Palace'), cathedral: msg('Cathedral'), park: msg('Park'),
  garden: msg('Garden'), zoo: msg('Zoo or aquarium'), square: msg('Square'), monument: msg('Monument'),
  fountain: msg('Fountain'), statue: msg('Statue'), landmark: msg('Landmark'), church: msg('Church'), mosque: msg('Mosque'),
  temple: msg('Temple or shrine'), synagogue: msg('Synagogue'), bridge: msg('Bridge'), tower: msg('Tower'), skyscraper: msg('Skyscraper'),
  theatre: msg('Theatre or opera house'), ruins: msg('Archaeological site'),
};

/** The section a kind is listed under. */
export const groupOf = (kind: AttractionKind) => KIND_GROUPS.find(g => g.kinds.includes(kind))!.id;

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

/** The item's name in the reader's language, English where it has none. */
export const attractionName = (item: AttractionItem, locale: Locale) => item.n[locale] ?? item.n.en ?? '';

/** Which of `w` ("en fr de") to link: the reader's Wikipedia, else English's, else the first; '' for none. */
export function wikiLang(w: string, locale: Locale): string {
  const langs = w.split(' ').filter(Boolean);
  return langs.includes(locale) ? locale : langs.includes('en') ? 'en' : langs[0] ?? '';
}

/** The article in that Wikipedia through Wikidata's redirect, or the Wikidata item where there is none. */
export const wikiLink = (id: string, lang: string) =>
  lang ? `https://www.wikidata.org/wiki/Special:GoToLinkedPage/${lang}wiki/${id}` : `https://www.wikidata.org/wiki/${id}`;

export const attractionWiki = (id: string, item: AttractionItem, locale: Locale) => wikiLink(id, wikiLang(item.w, locale));
