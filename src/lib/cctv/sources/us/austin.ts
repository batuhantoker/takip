import type { CctvCamera } from '@/lib/cctv/types';
import type { Bounds } from '@/lib/cctv/sources/platforms/cars';
import { stealthFetch } from '@/lib/stealthFetch';

/**
 * TAKIP — City of Austin traffic cameras (~820): Austin Transportation & Public Works' Socrata dataset, no key.
 * Terms: Public Domain (data.austintexas.gov licence on dataset b4k4-adkb).
 * texas.ts carries TxDOT's own freeway cameras; the city's sit at arterial signals, so near pairs are distinct.
 */

// Socrata returns 1,000 rows unless told otherwise.
const API = 'https://data.austintexas.gov/resource/b4k4-adkb.json?$limit=5000&camera_status=TURNED_ON';
export const AUSTIN_BOUNDS: Bounds = { minLat: 30.05, maxLat: 30.6, minLng: -98.0, maxLng: -97.5 };

export interface AustinCamera {
  camera_id?: string | null;
  location_name?: string | null;
  /** TURNED_ON, DESIRED, VOID or REMOVED; only TURNED_ON serves a still. */
  camera_status?: string | null;
  screenshot_address?: string | null;
  location?: { coordinates?: (number | null)[] | null } | null;
}

export function mapAustinCamera(r: AustinCamera | null | undefined): CctvCamera | null {
  if (r?.camera_status !== 'TURNED_ON') return null;
  const id = r.camera_id?.trim();
  if (!id || !/^\d+$/.test(id)) return null;

  const [lng, lat] = (r.location?.coordinates ?? []).map(Number);
  const b = AUSTIN_BOUNDS;
  if (!(lat > b.minLat && lat < b.maxLat && lng > b.minLng && lng < b.maxLng)) return null;

  let feed: URL;
  try {
    feed = new URL(r.screenshot_address ?? '');
  } catch {
    return null;
  }
  if (feed.protocol !== 'https:') return null;

  return {
    id: `austin-${id}`,
    lat,
    lng,
    name: r.location_name?.replace(/\s+/g, ' ').trim() || `Austin Camera ${id}`,
    city: 'Austin',
    country: 'US',
    feed_url: feed.href,
    stream_type: 'jpg',
    source: 'City of Austin',
  };
}

export async function fetchAustinCameras(): Promise<CctvCamera[]> {
  const res = await stealthFetch(API, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`Austin cameras HTTP ${res.status}`);

  const json = await res.json();
  if (!Array.isArray(json)) throw new Error('Austin cameras: unexpected response');

  const seen = new Map<string, CctvCamera>();
  for (const row of json) {
    const cam = mapAustinCamera(row);
    if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
  }
  console.log(`[TAKIP] Austin cameras — City of Austin: ${seen.size}`);
  return [...seen.values()];
}
