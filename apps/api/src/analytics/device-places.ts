import type { AppDb } from '../db/app-db';

/* Locations people shared from their browser (device_place, written by access/map-time.ts), already rounded. */

type SubjectType = 'user' | 'visitor';

export type DevicePlace = {
  latitude: number; longitude: number; accuracyM: number | null; label: string | null; firstSeenAt: number; lastSeenAt: number; fixes: number;
};
export type DeviceBrief = { latitude: number; longitude: number; accuracyM: number | null; label: string | null; at: number };

/** Every location a subject shared, most recent first. */
export function devicePlacesOf(db: AppDb, type: SubjectType, id: string) {
  return db.prepare(`
    SELECT latitude, longitude, accuracy_m AS accuracyM, label, first_seen_at AS firstSeenAt, last_seen_at AS lastSeenAt, fixes
    FROM device_place WHERE subject_type = ? AND subject_id = ? ORDER BY last_seen_at DESC, latitude, longitude`).all(type, id) as DevicePlace[];
}

/** Each listed subject's latest shared location. SQLite takes bare columns from the row that holds max(). */
export function latestDevices(db: AppDb, type: SubjectType, ids: string[]) {
  const rows = db.prepare(`
    SELECT id, latitude, longitude, accuracyM, label, at FROM (
      SELECT subject_id AS id, latitude, longitude, accuracy_m AS accuracyM, label, max(last_seen_at) AS at FROM device_place
      WHERE subject_type = ? AND subject_id IN (SELECT value FROM json_each(?)) GROUP BY subject_id)`)
    .all(type, JSON.stringify(ids)) as (DeviceBrief & { id: string })[];
  return new Map(rows.map(({ id, ...device }) => [id, device as DeviceBrief]));
}
