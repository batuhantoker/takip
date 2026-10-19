import type { AppDb } from '../db/app-db';
import { noLocator, type IpLocator } from '../geoip/ip-location';
import type { ActionCounts } from './map-time-input';

export type PlaceSubject = { type: 'user' | 'visitor'; id: string };
export type ActionSubject = { type: 'anon' | 'user' | 'visitor'; id: string };

/**
 * Where accounts and visitors use the map from (place_seen) and the actions they take (action_count). An address is
 * placed once, when first seen for that subject, from the DB-IP database or else Cloudflare's country.
 */
export function activityBook(db: AppDb, locate: IpLocator = noLocator) {
  const known = db.prepare('SELECT 1 FROM place_seen WHERE subject_type = ? AND subject_id = ? AND ip = ?').pluck();
  const insertPlace = db.prepare(`
    INSERT INTO place_seen (subject_type, subject_id, ip, country, region, city, latitude, longitude, first_seen_at, last_seen_at, minutes)
    VALUES (@type, @id, @ip, @country, @region, @city, @latitude, @longitude, @at, @at, @minutes)`);
  const touchPlace = db.prepare(`
    UPDATE place_seen SET last_seen_at = @at, minutes = minutes + @minutes WHERE subject_type = @type AND subject_id = @id AND ip = @ip`);
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
    actions: db.transaction((subject: ActionSubject, day: number, counts: ActionCounts) => {
      for (const [action, n] of counts) addAction.run(day, subject.type, subject.id, action, n);
    }),
  };
}

export type ActivityBook = ReturnType<typeof activityBook>;
