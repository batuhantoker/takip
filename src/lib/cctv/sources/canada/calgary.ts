import type { CctvCamera } from '@/lib/cctv/types';
import type { Bounds } from '@/lib/cctv/sources/platforms/cars';
import { stealthFetch } from '@/lib/stealthFetch';

/**
 * TAKIP — City of Calgary traffic cameras (~214): the Traffic Cameras open dataset (data.calgary.ca k7p9-kppz), no key.
 * Terms: City of Calgary open data terms of use; attribution "The City of Calgary".
 */

const API = 'https://data.calgary.ca/resource/k7p9-kppz.json?$limit=5000';
export const CALGARY_BOUNDS: Bounds = { minLat: 50.8, maxLat: 51.25, minLng: -114.35, maxLng: -113.8 };
const STILL_HOST = 'trafficcam.calgary.ca';

export interface CalgaryCamera {
  /** `description` is a display label (`Camera 75`) one off from the file name (`loc74.jpg`). */
  camera_url?: { url?: string | null; description?: string | null } | null;
  quadrant?: string | null;
  camera_location?: string | null;
  point?: { coordinates?: (number | null)[] | null } | null;
}

export function mapCalgaryCamera(r: CalgaryCamera | null | undefined): CctvCamera | null {
  let still: URL;
  try {
    still = new URL(r?.camera_url?.url ?? '');
  } catch {
    return null;
  }
  // Most rows still say http; the host 301s those to https.
  if (still.hostname !== STILL_HOST || !/^https?:$/.test(still.protocol)) return null;
  still.protocol = 'https:';
  const id = still.pathname.match(/^\/(loc\d+)\.jpg$/i)?.[1];
  if (!id) return null;

  const [lng, lat] = r?.point?.coordinates ?? [];
  const b = CALGARY_BOUNDS;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!(lat > b.minLat && lat < b.maxLat && lng > b.minLng && lng < b.maxLng)) return null;

  return {
    id: `calgary-${id}`,
    lat,
    lng,
    name: r?.camera_location?.replace(/\s+/g, ' ').trim() || `Calgary Camera ${id}`,
    city: 'Calgary',
    country: 'Canada',
    feed_url: still.href,
    stream_type: 'jpg',
    source: 'City of Calgary',
  };
}

export async function fetchCalgaryCameras(): Promise<CctvCamera[]> {
  const res = await stealthFetch(API, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`Calgary cameras HTTP ${res.status}`);

  const rows = await res.json();
  if (!Array.isArray(rows)) throw new Error('Calgary cameras: unexpected response');

  const seen = new Map<string, CctvCamera>();
  for (const row of rows) {
    const cam = mapCalgaryCamera(row);
    if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
  }
  console.log(`[TAKIP] Calgary cameras — City of Calgary: ${seen.size}`);
  return [...seen.values()];
}
