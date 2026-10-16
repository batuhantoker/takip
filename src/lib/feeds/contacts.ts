import { bearing, haversine } from '@/lib/core/geodesic';

/*
 * The contacts around a subject: the nearest airborne aircraft and ships, nearest first, after God's
 * Eye View's Contacts roster (250 km). For "what's around this plane or ship".
 */

export const CONTACT_RADIUS_KM = 250;

const BUCKETS = ['commercial_flights', 'private_flights', 'private_jets', 'military_flights'] as const;

export interface Contact {
  kind: 'aircraft' | 'ship';
  id: string;
  name: string;
  km: number;
  /** From the subject to the contact, degrees from north. */
  bearing: number;
  /** Aircraft altitude in metres, or ship speed in knots. */
  alt?: number;
  speed?: number;
}

type Row = Record<string, unknown> & { lat?: number; lng?: number };
type Feed = Record<string, unknown>;

/** A quick box test before the great-circle one, since the feed holds tens of thousands of aircraft. */
function near(origin: { lat: number; lng: number }, row: Row, radiusKm: number): number | null {
  if (typeof row.lat !== 'number' || typeof row.lng !== 'number') return null;
  const dLat = Math.abs(row.lat - origin.lat);
  if (dLat * 111 > radiusKm) return null;
  const dLng = Math.abs(((row.lng - origin.lng + 540) % 360) - 180);
  if (dLng * 111 * Math.cos((origin.lat * Math.PI) / 180) > radiusKm) return null;
  const km = haversine([origin.lng, origin.lat], [row.lng, row.lat]);
  return km <= radiusKm ? km : null;
}

export function nearestContacts(data: Feed, subject: { kind: string; id: string; lat: number; lng: number }, max = 8, radiusKm = CONTACT_RADIUS_KM): Contact[] {
  const out: Contact[] = [];
  const add = (kind: Contact['kind'], id: string, row: Row, km: number, extra: Partial<Contact>) => {
    if (kind === subject.kind && id === subject.id) return;
    out.push({ kind, id, km, bearing: bearing([subject.lng, subject.lat], [row.lng as number, row.lat as number]), name: '', ...extra });
  };
  for (const bucket of BUCKETS) {
    for (const f of (data[bucket] as Row[] | undefined) ?? []) {
      if (f.grounded || !f.icao24) continue;
      const km = near(subject, f, radiusKm);
      if (km == null) continue;
      add('aircraft', String(f.icao24), f, km, { name: String(f.callsign || f.icao24).trim(), alt: typeof f.alt === 'number' ? f.alt : undefined });
    }
  }
  for (const s of (data.maritime_ships as Row[] | undefined) ?? []) {
    if (s.mmsi == null) continue;
    const km = near(subject, s, radiusKm);
    if (km == null) continue;
    add('ship', String(s.mmsi), s, km, { name: String(s.name || s.mmsi).trim(), speed: typeof s.speed === 'number' ? s.speed : undefined });
  }
  return out.sort((a, b) => a.km - b.km).slice(0, max);
}
