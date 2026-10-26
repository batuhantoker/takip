import type { Locale } from '@/lib/core/i18n/locales';
import { dbStamp, readDb, stmt } from '@/lib/core/read-db';
import type { Box } from '@/lib/feeds/reference/bbox';
import { topicTable } from '@/lib/platform/site/places/tables';
import {
  attractionName, wikiLang, type AttractionItem, type AttractionKind, type AttractionsMeta, type AttractionsRow,
} from '@/lib/platform/site/places/topics/attractions-data';
import { ATTRACTIONS_DB, type SpotCollection, type SpotProps } from './spots';
import { ALL_ZOOM, FIRST_ZOOM, shownFrom } from './zoom';

/**
 * The things to do in a box, from data/db/attractions.db. Where the file isn't there (a server it hasn't been copied
 * to), the place pages' own table stands in: only each city's best known, but the pages' mini-maps still show theirs.
 */

export const MAX_SPOTS = 3000;

type Spot = { id: string; k: AttractionKind; l: number; h: number; lon: number; lat: number; name: string | null; w: string };

const IN_BOX = `SELECT i.id, i.k, i.l, i.h, i.lon, i.lat, coalesce(json_extract(i.names, ?), json_extract(i.names, '$.en')) AS name, i.w
  FROM spot s JOIN item i ON i.n = s.n
  WHERE s.min_x <= ? AND s.max_x >= ? AND s.min_y <= ? AND s.max_y >= ? AND s.min_z <= ?
  ORDER BY i.l DESC LIMIT ?`;

let fallback: { generated: string; items: { id: string; item: AttractionItem; z: number }[] } | null = null;

function tableItems() {
  const table = topicTable<AttractionsRow, AttractionsMeta>('attractions');
  if (fallback?.generated !== table.generated) {
    const entries = Object.entries(table.meta?.items ?? {});
    const from = shownFrom(entries.map(([, item]) => item));
    fallback = { generated: table.generated, items: entries.map(([id, item], i) => ({ id, item, z: from[i] })) };
  }
  return fallback.items;
}

function fromTable([w, s, e, n]: Box, z: number, locale: Locale): Spot[] {
  return tableItems()
    .filter(({ item: { at }, z: from }) => from <= z && at[0] >= w && at[0] <= e && at[1] >= s && at[1] <= n)
    .map(({ id, item }) => ({ id, k: item.k, l: item.l, h: item.h ?? 0, lon: item.at[0], lat: item.at[1], name: attractionName(item, locale), w: item.w }));
}

/** What the data changed with, for an ETag. */
export const spotsVersion = () => dbStamp(ATTRACTIONS_DB) ?? `table:${topicTable('attractions').generated}`;

/** The best known first, up to MAX_SPOTS; below FIRST_ZOOM none. */
export function spotsIn(boxes: readonly Box[], zoom: number, locale: Locale): SpotCollection {
  if (zoom < FIRST_ZOOM) return { type: 'FeatureCollection', features: [], truncated: false };
  const z = Math.min(ALL_ZOOM, Math.floor(zoom));
  const db = readDb(ATTRACTIONS_DB);
  const spots = boxes.flatMap(([w, s, e, n]) => db
    ? stmt(db, IN_BOX).all(`$.${locale}`, e, w, n, s, z, MAX_SPOTS + 1) as Spot[]
    : fromTable([w, s, e, n], z, locale));
  spots.sort((a, b) => b.l - a.l);
  return {
    type: 'FeatureCollection',
    features: spots.slice(0, MAX_SPOTS).map(r => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lon, r.lat] },
      properties: { id: r.id, k: r.k, name: r.name ?? '', l: r.l, ...(r.h ? { h: 1 as const } : {}), wl: wikiLang(r.w, locale) } satisfies SpotProps,
    })),
    truncated: spots.length > MAX_SPOTS,
  };
}
