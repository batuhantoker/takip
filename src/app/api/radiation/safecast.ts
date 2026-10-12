/**
 * TAKIP — Safecast real-time radiation sensors (Pointcast, Solarcast, bGeigie
 * "geigiecast"), no key. Data is CC0.
 *
 * `tt.safecast.org/devices` returns the latest message per device, ~2k rows of
 * which ~500 carry a Geiger tube and ~150 reported in the last day; the rest
 * are air-quality Airnotes or long-dead units. Only latest values come back, so
 * there is no per-device baseline here: readings are UNRATED, never NORMAL.
 * `when_captured` is device-reported and sometimes garbage ("2044-00-00…").
 */

import type { RadiationStation } from './types';

export const SAFECAST_DEVICES_URL = 'https://tt.safecast.org/devices';

/** Tube field → CPM per µSv/h; the beta-shielded 7318c is closest to a gamma dose rate, so it goes first. */
const TUBES: [field: string, cpmPerUsvh: number][] = [
  ['lnd_7318c', 334],
  ['lnd_7318u', 334],
  ['lnd_7128ec', 108],
  ['lnd_712u', 108],
];

export const MAX_AGE_MS = 24 * 3_600_000;

type Device = Record<string, unknown>;

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

export function mapSafecastDevice(d: Device, now: number): RadiationStation | null {
  const urn = str(d.device_urn);
  const lat = num(d.loc_lat);
  const lng = num(d.loc_lon);
  if (!urn || lat == null || lng == null || Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) return null;

  const t = Date.parse(str(d.when_captured));
  if (!Number.isFinite(t) || t > now + 3_600_000 || now - t > MAX_AGE_MS) return null;

  const tube = TUBES.find(([field]) => num(d[field]) != null && (d[field] as number) > 0);
  if (!tube) return null;
  const nsvh = ((d[tube[0]] as number) / tube[1]) * 1000;

  return {
    id: `safecast-${urn}`.replace(/[^a-zA-Z0-9-]+/g, '-'),
    name: str(d.device_sn) || `Safecast ${urn}`,
    city: str(d.loc_name),
    country: str(d.loc_country),
    lat,
    lng,
    reading: Math.round(nsvh),
    time: new Date(t).toISOString(),
    status: 'UNRATED',
    network: 'Safecast',
    source: str(d.dev_dashboard) || 'https://safecast.org/',
  };
}

/** Newest reading per device among those with a tube and a fix in the last day. */
export function parseSafecastDevices(json: unknown, now: number): RadiationStation[] {
  if (!Array.isArray(json)) throw new Error('Safecast: unexpected /devices shape');
  const byDevice = new Map<string, RadiationStation>();
  for (const row of json) {
    if (!row || typeof row !== 'object') continue;
    const s = mapSafecastDevice(row as Device, now);
    if (!s) continue;
    const prev = byDevice.get(s.id);
    if (!prev || prev.time < s.time) byDevice.set(s.id, s);
  }
  return [...byDevice.values()];
}
