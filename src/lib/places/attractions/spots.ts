import type { Locale } from '@/lib/core/i18n/locales';
import type { AttractionKind } from '@/lib/platform/site/places/topics/attractions-data';

/*
 * What /api/things-to-do serves the map: the things to do in a box (data/db/attractions.db, built by
 * tools/site/topics/attractions.ts), named in the reader's language. Shared by the route and the map.
 */

export const ATTRACTIONS_DB = 'attractions.db';

/** A feature's properties. */
export interface SpotProps {
  /** Wikidata id. */
  id: string;
  k: AttractionKind;
  name: string;
  /** How many Wikipedias have an article. */
  l: number;
  /** On UNESCO's World Heritage List. */
  h?: 1;
  /** The Wikipedia to link (wikiLang), '' for none. */
  wl: string;
}

export type SpotCollection = GeoJSON.FeatureCollection<GeoJSON.Point, SpotProps> & { truncated: boolean };

export const spotsUrl = (box: readonly number[], zoom: number, locale: Locale) =>
  `/api/things-to-do?bbox=${box.map(n => +n.toFixed(4)).join(',')}&zoom=${zoom}&lang=${locale}`;
