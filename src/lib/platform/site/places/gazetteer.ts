import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Locale } from '@/lib/core/i18n/locales';
import type { GazetteerFile, Place, PlaceKind } from './place';
import type { UsAreasFile } from './us-areas';

export type { Place, PlaceKind } from './place';

/** Committed data the place pages read from disk; kept out of the server bundle. */
export const SITE_DATA = process.env.SITE_DATA_DIR || join(process.cwd(), 'data', 'site');

/** A rebuilt file is read again when its time changes, checked at most this often. */
export const DATA_RECHECK_MS = 30_000;

/**
 * How long what is worked out from the data (a place's pages, the sitemaps) is kept. Some topics count things
 * at run time, so it still expires; under `next dev` it follows the data as quickly as the files are rechecked.
 */
export const DERIVED_TTL_MS = process.env.NODE_ENV === 'production' ? 60 * 60_000 : DATA_RECHECK_MS;

let loaded: { mtime: number; checked: number; places: Place[]; bySlug: Map<string, Place>; byId: Map<number, Place>; regions: NonNullable<GazetteerFile['regions']> } | null = null;

/** Both files' times, so rebuilding either is noticed. */
const mtimeOf = (gazetteer: string, areas: string) => statSync(gazetteer).mtimeMs + (existsSync(areas) ? statSync(areas).mtimeMs : 0);

function gazetteer() {
  const path = join(SITE_DATA, 'gazetteer.json');
  const areasPath = join(SITE_DATA, 'us-areas.json');
  const now = Date.now();
  if (loaded && now - loaded.checked > DATA_RECHECK_MS) {
    loaded.checked = now;
    if (mtimeOf(path, areasPath) !== loaded.mtime) loaded = null;
  }
  if (!loaded) {
    const mtime = mtimeOf(path, areasPath);
    const file = JSON.parse(readFileSync(path, 'utf8')) as GazetteerFile;
    const areas = existsSync(areasPath) ? JSON.parse(readFileSync(areasPath, 'utf8')) as UsAreasFile : null;
    const places = [
      ...(areas ? file.places.map(p => (areas.parents[p.id] ? { ...p, parents: areas.parents[p.id] } : p)) : file.places),
      ...(areas?.places ?? []),
    ];
    loaded = {
      mtime,
      checked: now,
      places,
      bySlug: new Map(places.map(p => [`${p.kind}/${p.slug}`, p])),
      byId: new Map(places.map(p => [p.id, p])),
      regions: file.regions ?? {},
    };
  }
  return loaded;
}

export const allPlaces = (): readonly Place[] => gazetteer().places;
export const placeBySlug = (kind: PlaceKind, slug: string) => gazetteer().bySlug.get(`${kind}/${slug}`);
export const placeById = (id: number) => gazetteer().byId.get(id);
export const countryPlace = (cc: string) => gazetteer().places.find(p => p.kind === 'country' && p.cc === cc);

/** The place's name in the reader's language. */
export const placeLabel = (place: Place, locale: Locale) => place.names?.[locale] ?? place.name;

/** The place's region in the reader's language: "İstanbul" for a Turkish reader. */
export const regionLabel = (place: Place, locale: Locale) =>
  (place.admin1 && gazetteer().regions[place.admin1]?.[locale]) || place.region;

export function km([lng1, lat1]: [number, number], [lng2, lat2]: [number, number]): number {
  const r = Math.PI / 180;
  return 6371 * Math.hypot((lng2 - lng1) * r * Math.cos(((lat1 + lat2) / 2) * r), (lat2 - lat1) * r);
}

/** How far a place reaches: a town 8 km, a metropolis up to 45 km (as the transit layer folds suburbs into cities). */
export const reachKm = (place: Place) => Math.min(45, Math.max(8, 10 * (place.pop / 100_000) ** 0.4));

/** Places of the same kind, nearest first, that pass `keep`. */
export function nearestPlaces(place: Place, keep: (p: Place) => boolean, limit: number, maxKm = 600): Place[] {
  return gazetteer().places
    .filter(p => p.kind === place.kind && p !== place && Math.abs(p.at[1] - place.at[1]) < maxKm / 111)
    .map(p => ({ p, d: km(place.at, p.at) }))
    .filter(x => x.d <= maxKm)
    .sort((a, b) => a.d - b.d)
    .filter(x => keep(x.p))
    .slice(0, limit)
    .map(x => x.p);
}
