import type { Bbox } from '@/lib/map/embed/spec';
import { ownApi } from '../../live/own-api';
import { km } from '../gazetteer';
import type { Place } from '../place';

/** The last 30 days around a place, from the embed's USGS window route (/api/earthquakes/range). */
export interface HazardsNow {
  days: number;
  floor: number;
  n: number;
  /** A city counts within `km` of its centre; a country, the box its map frames. */
  km?: number;
  latest?: NowQuake;
  strongest?: NowQuake;
}

export interface NowQuake { m: number; time: number; place: string; url: string }

export interface RangeQuake { magnitude: number; time: number; place: string; url: string; lat: number; lng: number }

export const NOW_DAYS = 30;
export const NOW_FLOOR = 4.5;
/**
 * One worldwide question for every page (about 600 quakes, 190 KB), so Next's fetch cache answers them all and the
 * route's per-address limit sees one call in 15 minutes, not one per page.
 */
const NOW_PATH = `/api/earthquakes/range?last=${NOW_DAYS}d&minmag=${NOW_FLOOR}`;

/** Inside [w, s, e, n]; west above east crosses the antimeridian. */
export const inBox = ([w, s, e, n]: Bbox, lng: number, lat: number) => lat >= s && lat <= n && (w <= e ? lng >= w && lng <= e : lng >= w || lng <= e);

/** The quakes that belong to the place: within `cityKm` of a city, inside a country's box. */
export function quakesNow(quakes: RangeQuake[], place: Place, box: Bbox, cityKm: number): HazardsNow {
  const mine = place.kind === 'city' ? quakes.filter(q => km(place.at, [q.lng, q.lat]) <= cityKm) : quakes.filter(q => inBox(box, q.lng, q.lat));
  const pick = (q: RangeQuake): NowQuake => ({ m: q.magnitude, time: q.time, place: q.place, url: q.url });
  return {
    days: NOW_DAYS, floor: NOW_FLOOR, n: mine.length,
    ...(place.kind === 'city' ? { km: cityKm } : {}),
    ...(mine.length ? {
      latest: pick(mine.reduce((a, b) => (b.time > a.time ? b : a))),
      strongest: pick(mine.reduce((a, b) => (b.magnitude > a.magnitude ? b : a))),
    } : {}),
  };
}

/** Null when the route failed, so the page leaves the box out rather than claiming a quiet month. */
export async function hazardsNow(place: Place, box: Bbox, cityKm = 100): Promise<HazardsNow | null> {
  const json = await ownApi<{ earthquakes?: RangeQuake[]; error?: string }>(NOW_PATH, 900);
  return json?.earthquakes && !json.error ? quakesNow(json.earthquakes, place, box, cityKm) : null;
}
