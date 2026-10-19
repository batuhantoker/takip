import type { AppDb } from '../db/app-db';
import { noLocator, type IpLocator } from '../geoip/ip-location';
import type { ActionCounts, DeviceFix } from './map-time-input';

export type PlaceSubject = { type: 'user' | 'visitor'; id: string };
export type ActionSubject = { type: 'anon' | 'user' | 'visitor'; id: string };
/** Names a point ("City, region, country"), or null; v1/geo/reverse.ts nameCoordinate in the server. */
export type NamePoint = (lat: number, lng: number) => Promise<string | null>;

// Fixes within this of a spot already noted (about 28 m of latitude) add to it rather than making another.
const NEAR_DEG = 0.00025;
const noName: NamePoint = async () => null;

/**
 * Where accounts and visitors use the map from (place_seen) and the actions they take (action_count). An address is
 * placed once, when first seen for that subject, from the DB-IP database or else Cloudflare's country. Locations people
 * share go to device_place as given, named in the background by `name` without holding up the tick.
 */
export function activityBook(db: AppDb, locate: IpLocator = noLocator, name: NamePoint = noName) {
  const known = db.prepare('SELECT 1 FROM place_seen WHERE subject_type = ? AND subject_id = ? AND ip = ?').pluck();
  const insertPlace = db.prepare(`
    INSERT INTO place_seen (subject_type, subject_id, ip, country, region, city, latitude, longitude, first_seen_at, last_seen_at, minutes)
    VALUES (@type, @id, @ip, @country, @region, @city, @latitude, @longitude, @at, @at, @minutes)`);
  const touchPlace = db.prepare(`
    UPDATE place_seen SET last_seen_at = @at, minutes = minutes + @minutes WHERE subject_type = @type AND subject_id = @id AND ip = @ip`);
  const nearby = db.prepare(`
    SELECT latitude, longitude, label FROM device_place
    WHERE subject_type = ? AND subject_id = ? AND latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?
    ORDER BY last_seen_at DESC LIMIT 1`);
  const insertDevice = db.prepare(`
    INSERT INTO device_place (subject_type, subject_id, latitude, longitude, accuracy_m, label, first_seen_at, last_seen_at, fixes)
    VALUES (@type, @id, @latitude, @longitude, @accuracyM, NULL, @at, @at, 1)`);
  const touchDevice = db.prepare(`
    UPDATE device_place SET last_seen_at = @at, fixes = fixes + 1,
      accuracy_m = CASE WHEN accuracy_m IS NULL OR @accuracyM < accuracy_m THEN coalesce(@accuracyM, accuracy_m) ELSE accuracy_m END
    WHERE subject_type = @type AND subject_id = @id AND latitude = @latitude AND longitude = @longitude`);
  const setLabel = db.prepare(`
    UPDATE device_place SET label = ? WHERE subject_type = ? AND subject_id = ? AND latitude = ? AND longitude = ? AND label IS NULL`);
  const addAction = db.prepare(`
    INSERT INTO action_count (day, subject_type, subject_id, action, count) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (day, subject_type, subject_id, action) DO UPDATE SET count = count + excluded.count`);

  return {
    /** A minute (or a tick behind the wall, `minutes` 0) from `ip`. */
    place(subject: PlaceSubject, ip: string, at: number, minutes: number, edgeCountry: string | null) {
      const row = { ...subject, ip, at, minutes };
      if (known.get(subject.type, subject.id, ip)) return void touchPlace.run(row);
      const place = locate(ip) ?? { country: edgeCountry, region: null, city: null, latitude: null, longitude: null };
      insertPlace.run({ ...row, ...place });
    },
    /** A shared location; a spot without a name yet is (re)named in the background, so a busy Nominatim only delays it. */
    device(subject: PlaceSubject, fix: DeviceFix, at: number) {
      const dLon = NEAR_DEG / Math.max(0.01, Math.cos((fix.latitude * Math.PI) / 180));
      const near = nearby.get(subject.type, subject.id, fix.latitude - NEAR_DEG, fix.latitude + NEAR_DEG, fix.longitude - dLon, fix.longitude + dLon) as
        { latitude: number; longitude: number; label: string | null } | undefined;
      const spot = near ?? { latitude: fix.latitude, longitude: fix.longitude, label: null };
      if (near) touchDevice.run({ ...subject, latitude: near.latitude, longitude: near.longitude, accuracyM: fix.accuracyM, at });
      else insertDevice.run({ ...subject, ...fix, at });
      if (spot.label) return;
      void name(spot.latitude, spot.longitude)
        .then(label => label && setLabel.run(label, subject.type, subject.id, spot.latitude, spot.longitude))
        .catch(() => {});
    },
    actions: db.transaction((subject: ActionSubject, day: number, counts: ActionCounts) => {
      for (const [action, n] of counts) addAction.run(day, subject.type, subject.id, action, n);
    }),
  };
}

export type ActivityBook = ReturnType<typeof activityBook>;
