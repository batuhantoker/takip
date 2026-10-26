import { stmt } from '@/lib/core/read-db';
import { mapHref } from '@/lib/platform/site/map-link';
import { pagesDb } from '@/lib/platform/site/events/store';
import { allPlaces, km } from '@/lib/platform/site/places/gazetteer';
import type { Place } from '@/lib/platform/site/places/place';
import { camerasNear, type CatalogueCamera } from '@/lib/platform/site/places/topics/camera-catalogue';
import type { Mountain, MountainPlace } from './data';
import {
  childPeaks, highestInCountry, highestInRange, mountainBySlug, mountainsByQid, mountainsIn, placesByQid, rangeSize,
} from './store';

/**
 * Everything a mountain page shows besides Wikipedia and the forecast: the places it names, its neighbours by
 * distance, range and country, its eruptions and the history around it, the towns near it and their cameras.
 */

export interface Near<T> { item: T; km: number }

export interface EventLink { slug: string; title: string | null; year: number; indexed: boolean }

export interface MountainPage {
  mountain: Mountain;
  places: Map<number, MountainPlace>;
  parent: Mountain | null;
  /** Peaks whose parent this one is. */
  children: Mountain[];
  nearby: Near<Mountain>[];
  rangePeaks: Mountain[];
  rangeTotal: number;
  countryPeaks: Mountain[];
  eruptions: EventLink[];
  eruptionTotal: number;
  history: EventLink[];
  towns: Near<Place>[];
  cameras: Near<CatalogueCamera>[];
}

const NEARBY_KM = 60;
const NEARBY = 10;
const TOWNS_KM = 80;
const TOWNS = 6;
const CAMERAS_KM = 30;
const HISTORY_KM = 20;
const ERUPTIONS = 12;
/** Wikidata gives some countries' highest hills Everest as their parent; a sub-peak is nearer than this. */
const CHILD_KM = 500;

/** A box `r` km around a point, for the R*Tree. */
function box([lon, lat]: [number, number], r: number): [number, number, number, number] {
  const dLat = r / 111;
  const dLon = r / (111 * Math.max(0.05, Math.cos((lat * Math.PI) / 180)));
  return [lon - dLon, lat - dLat, lon + dLon, lat + dLat];
}

const yearOf = (ms: number) => new Date(ms).getUTCFullYear();

/** A volcano's eruptions, newest first: the History events filed under its English article (lib/history). */
function eruptions(m: Mountain): { shown: EventLink[]; total: number } {
  const db = pagesDb();
  if (!db || m.kind !== 'volcano' || !m.wiki.en) return { shown: [], total: 0 };
  const rows = stmt(db, `SELECT slug, title, t_start, indexed FROM event WHERE kind = 'hazard.volcano' AND wiki = ? AND canonical_id = event_id
    ORDER BY t_start DESC`).all(m.wiki.en) as { slug: string; title: string | null; t_start: number; indexed: number }[];
  return { shown: rows.slice(0, ERUPTIONS).map(r => ({ slug: r.slug, title: r.title, year: yearOf(r.t_start), indexed: !!r.indexed })), total: rows.length };
}

/** History's indexed events within HISTORY_KM, eruptions left to their own list. */
function historyNear(m: Mountain): EventLink[] {
  const db = pagesDb();
  if (!db) return [];
  const [w, s, e, n] = box([m.lon, m.lat], HISTORY_KM);
  const rows = stmt(db, `SELECT ev.slug, ev.title, ev.t_start, ev.lon, ev.lat FROM near JOIN event ev ON ev.event_id = near.id
    WHERE near.min_x <= ? AND near.max_x >= ? AND near.min_y <= ? AND near.max_y >= ? AND ev.kind != 'hazard.volcano'
    ORDER BY ev.sources DESC, ev.t_start DESC LIMIT 20`).all(e, w, n, s) as { slug: string; title: string | null; t_start: number; lon: number; lat: number }[];
  return rows.filter(r => km([m.lon, m.lat], [r.lon, r.lat]) <= HISTORY_KM).slice(0, 8)
    .map(r => ({ slug: r.slug, title: r.title, year: yearOf(r.t_start), indexed: true }));
}

function townsNear(m: Mountain): Near<Place>[] {
  const at: [number, number] = [m.lon, m.lat];
  return allPlaces()
    .filter(p => (p.kind === 'city' || p.kind === 'town') && Math.abs(p.at[1] - m.lat) < TOWNS_KM / 111)
    .map(p => ({ item: p, km: km(at, p.at) }))
    .filter(x => x.km <= TOWNS_KM)
    .sort((a, b) => a.km - b.km)
    .slice(0, TOWNS);
}

export function findMountain(slug: string): { page: MountainPage } | { redirect: string } | null {
  const found = mountainBySlug(slug);
  if (!found || 'redirect' in found) return found;
  const m = found.mountain;
  const at: [number, number] = [m.lon, m.lat];
  const nearby = mountainsIn(box(at, NEARBY_KM), 60)
    .filter(x => x.qid !== m.qid)
    .map(x => ({ item: x, km: km(at, [x.lon, x.lat]) }))
    .filter(x => x.km <= NEARBY_KM)
    .sort((a, b) => Number(b.item.indexed) - Number(a.item.indexed) || a.km - b.km)
    .slice(0, NEARBY);
  const parent = m.parent !== null ? mountainsByQid([m.parent]).get(m.parent) ?? null : null;
  const places = placesByQid([...(m.range !== null ? [m.range] : []), ...(m.parent !== null && !parent ? [m.parent] : []), ...m.highest]);
  const cc = m.cc[0];
  const { shown, total } = eruptions(m);
  const cams = camerasNear(at, CAMERAS_KM)?.cameras.filter(c => !c.offline && c.look === 'still' && c.frame) ?? [];
  return {
    page: {
      mountain: m,
      places,
      parent,
      children: childPeaks(m.qid, 20).filter(c => km(at, [c.lon, c.lat]) <= CHILD_KM).slice(0, 8),
      nearby,
      rangePeaks: m.range !== null ? highestInRange(m.range, 9).filter(x => x.qid !== m.qid).slice(0, 8) : [],
      rangeTotal: m.range !== null ? rangeSize(m.range) : 0,
      countryPeaks: cc ? highestInCountry(cc, 11, true).filter(x => x.qid !== m.qid).slice(0, 10) : [],
      eruptions: shown,
      eruptionTotal: total,
      history: historyNear(m),
      towns: townsNear(m),
      cameras: cams.slice(0, 6).map(c => ({ item: c, km: c.km })),
    },
  };
}

/** The live map on the summit with 3D terrain on and hiking routes drawn; tilted from zoom 10 (world-map.tsx). */
export const mountainMapPath = (m: Pick<Mountain, 'lat' | 'lon'>) =>
  mapHref({ layers: ['terrain_elevation', 'hiking_routes'], view: { lat: m.lat, lon: m.lon, zoom: 12.5 } });

export const mountainPath = (slug: string) => `/mountain/${slug}`;
