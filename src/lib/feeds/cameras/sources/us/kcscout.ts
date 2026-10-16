import type { CctvCamera } from '@/lib/feeds/cameras/types';
import type { Bounds } from '@/lib/feeds/cameras/sources/platforms/cars';
import { stealthFetch } from '@/lib/core/net/stealth-fetch';

/**
 * TAKIP — KC Scout cameras on the Missouri side of Kansas City (~189): the list kcscout.net's own map loads, no key.
 * Stills only: the video needs a per-session token. The Kansas-side (`K…`) rows are KanDrive's, which `kansas` carries.
 * Terms: none found on kcscout.net.
 */

const API = 'https://www.kcscout.net/DataProvider.asmx/LoadEntities';
const STILLS = 'https://www.kcscout.net/TransSuite.VCS.CameraSnapshots';
export const KC_SCOUT_BOUNDS: Bounds = { minLat: 38.4, maxLat: 39.7, minLng: -95.1, maxLng: -94.0 };
/** About 60% of today's 189. */
const MIN_CAMERAS = 110;
const MISSOURI_ID = /^M[\w-]+$/;

export interface KcScoutCamera {
  ID?: string | null;
  OnStreetName?: string | null;
  Latitude?: number | null;
  Longitude?: number | null;
}

export function mapKcScoutCamera(c: KcScoutCamera | null | undefined): CctvCamera | null {
  const id = c?.ID?.trim();
  if (!id || !MISSOURI_ID.test(id)) return null;

  const lat = c?.Latitude;
  const lng = c?.Longitude;
  const b = KC_SCOUT_BOUNDS;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!(lat > b.minLat && lat < b.maxLat && lng > b.minLng && lng < b.maxLng)) return null;

  return {
    id: `kcscout-${id}`,
    lat,
    lng,
    name: c?.OnStreetName?.replace(/\s+/g, ' ').trim() || `KC Scout Camera ${id}`,
    city: 'Kansas City area, Missouri',
    country: 'US',
    feed_url: `${STILLS}/${id}.jpg`,
    stream_type: 'jpg',
    source: 'KC Scout',
  };
}

export async function fetchKcScoutCameras(): Promise<CctvCamera[]> {
  const res = await stealthFetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: '{}',
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`KC Scout cameras HTTP ${res.status}`);

  const json = await res.json();
  const rows = json?.d?.Camera;
  if (!Array.isArray(rows)) throw new Error('KC Scout cameras: unexpected response');

  const seen = new Map<string, CctvCamera>();
  for (const row of rows) {
    const cam = mapKcScoutCamera(row);
    if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
  }
  if (seen.size < MIN_CAMERAS) throw new Error(`KC Scout cameras short read: ${seen.size}`);
  console.log(`[TAKIP] Kansas City cameras — KC Scout (Missouri side): ${seen.size}`);
  return [...seen.values()];
}
