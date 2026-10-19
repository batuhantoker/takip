import type { AppDb } from '../db/app-db';
import type { IpLocator } from '../geoip/ip-location';
import { dayStartMs, notAdmin, visitorNotAdmin, type Range } from './range';

/* Addresses accounts and visitors used the map from (place_seen, written by access/map-time.ts). */

type SubjectType = 'user' | 'visitor';

export type Place = {
  ip: string; country: string | null; region: string | null; city: string | null; latitude: number | null; longitude: number | null;
  firstSeenAt: number; lastSeenAt: number; minutes: number;
};
export type PlaceBrief = { ip: string; country: string | null; region: string | null; city: string | null };

const CITIES = 50;
const POINTS = 2000;

/** Every address a subject used the map from, most recent first. */
export function placesOf(db: AppDb, type: SubjectType, id: string) {
  return db.prepare(`
    SELECT ip, country, region, city, latitude, longitude, first_seen_at AS firstSeenAt, last_seen_at AS lastSeenAt, minutes
    FROM place_seen WHERE subject_type = ? AND subject_id = ? ORDER BY last_seen_at DESC, ip`).all(type, id) as Place[];
}

/** Each listed subject's most recent address. SQLite takes bare columns from the row that holds max(). */
export function latestPlaces(db: AppDb, type: SubjectType, ids: string[]) {
  const rows = db.prepare(`
    SELECT id, ip, country, region, city FROM (
      SELECT subject_id AS id, ip, country, region, city, max(last_seen_at) FROM place_seen
      WHERE subject_type = ? AND subject_id IN (SELECT value FROM json_each(?)) GROUP BY subject_id)`)
    .all(type, JSON.stringify(ids)) as (PlaceBrief & { id: string })[];
  return new Map(rows.map(({ id, ...place }) => [id, place as PlaceBrief]));
}

/** Where `ip` is, looked up now, without the address itself; null when it can't be placed. */
export function placeOfIp(locate: IpLocator, ip: string | null) {
  const place = ip ? locate(ip) : null;
  return place ? { country: place.country, region: place.region, city: place.city } : null;
}

/** Accounts by the countries they used the map from in the range (a place counts when last seen in it). */
export function accountCountries(db: AppDb, r: Range) {
  return db.prepare(`
    SELECT country, count(DISTINCT subject_id) AS users FROM place_seen
    WHERE subject_type = 'user' AND country IS NOT NULL AND last_seen_at >= ? ${notAdmin(r, 'subject_id')}
    GROUP BY country ORDER BY users DESC, country`).all(dayStartMs(r.first)) as { country: string; users: number }[];
}

/** Visitors by country and city over the range, and one point per placed visitor's latest address. */
export function visitorPlaces(db: AppDb, r: Range) {
  const params = { from: dayStartMs(r.first) };
  const base = `FROM place_seen p JOIN visitor v ON v.visitor_id = p.subject_id
    WHERE p.subject_type = 'visitor' AND p.last_seen_at >= @from ${visitorNotAdmin(r)}`;
  const countries = db.prepare(`
    SELECT p.country, count(DISTINCT p.subject_id) AS visitors, count(DISTINCT CASE WHEN v.user_id IS NOT NULL THEN p.subject_id END) AS signedIn
    ${base} AND p.country IS NOT NULL GROUP BY p.country ORDER BY visitors DESC, p.country`).all(params) as { country: string; visitors: number; signedIn: number }[];
  const cities = db.prepare(`
    SELECT p.country, p.region, p.city, count(DISTINCT p.subject_id) AS visitors
    ${base} AND p.country IS NOT NULL AND p.city IS NOT NULL
    GROUP BY p.country, p.region, p.city ORDER BY visitors DESC, p.country, p.city LIMIT ${CITIES}`).all(params) as {
    country: string; region: string | null; city: string; visitors: number;
  }[];
  const points = db.prepare(`
    SELECT round(lat, 2) AS latitude, round(lon, 2) AS longitude, count(*) AS visitors FROM (
      SELECT p.subject_id, p.latitude AS lat, p.longitude AS lon, max(p.last_seen_at) ${base} GROUP BY p.subject_id)
    WHERE lat IS NOT NULL AND lon IS NOT NULL
    GROUP BY 1, 2 ORDER BY visitors DESC, 1, 2 LIMIT ${POINTS}`).all(params) as { latitude: number; longitude: number; visitors: number }[];
  return { countries, cities, points };
}
