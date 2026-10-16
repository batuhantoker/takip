import type { CctvCamera } from '@/lib/feeds/cameras/types';
import { stealthFetch } from '@/lib/core/net/stealth-fetch';

/**
 * TAKIP — USGS HIVIS stream and coastal cameras (~1,370 listed, ~930 visible and reporting), no key.
 * Terms: USGS-produced data are US public domain; credit "U.S. Geological Survey" (usgs.gov copyrights-and-credits).
 *
 * The index is the NIMS API behind apps.usgs.gov/hivis. Its app sends an X-Api-Key, but the
 * endpoint answers without one, under an `x-ratelimit-limit` of 2000.
 */

const API = 'https://api.waterdata.usgs.gov/nims/v0/cameras?enabled=true';
/** 720 px wide; `overlay/` holds the ~700 KB full-size frame. */
const SMALL_BASE = 'https://usgs-nims-images.s3.amazonaws.com/720/';
const MAX_AGE_DAYS = 7;

// Guam's two cameras sit across the antimeridian, outside this box.
export const HIVIS_BOUNDS = { minLat: 17, maxLat: 72, minLng: -180, maxLng: -64 };

export interface HivisCamera {
  camId?: string | null;
  camName?: string | null;
  /** Decimal degrees as strings. */
  lat?: string | null;
  lng?: string | null;
  newestImageDT?: string | null;
  /** Cameras the HIVIS app does not list: test rigs, long-silent sites, a few live views. */
  hideCam?: boolean | null;
  smallDir?: string | null;
}

export function mapHivisCamera(cam: HivisCamera | null | undefined, now: number = Date.now()): CctvCamera | null {
  const id = cam?.camId?.trim();
  if (!id || !/^[\w().-]+$/.test(id) || /test/i.test(id) || cam!.hideCam === true) return null;
  if (cam!.smallDir !== `${SMALL_BASE}${id}/`) return null;

  const newest = Date.parse(cam!.newestImageDT ?? '');
  if (!Number.isFinite(newest) || now - newest > MAX_AGE_DAYS * 86_400_000) return null;

  const lat = Number(cam!.lat);
  const lng = Number(cam!.lng);
  if (!cam!.lat || !cam!.lng || !Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
  const b = HIVIS_BOUNDS;
  if (lat < b.minLat || lat > b.maxLat || lng < b.minLng || lng > b.maxLng) return null;

  return {
    id: `hivis-${id}`,
    lat,
    lng,
    name: cam!.camName?.trim() || id.replace(/_/g, ' '),
    city: '',
    country: 'US',
    feed_url: `${cam!.smallDir}${id}_newest.jpg`,
    stream_type: 'jpg',
    external_url: `https://apps.usgs.gov/hivis/camera/${encodeURIComponent(id)}`,
    source: 'USGS HIVIS',
  };
}

export async function fetchHivisCameras(): Promise<CctvCamera[]> {
  const res = await stealthFetch(API, { signal: AbortSignal.timeout(12000), headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`USGS HIVIS HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error('USGS HIVIS: unexpected response');

  const now = Date.now();
  const seen = new Map<string, CctvCamera>();
  for (const row of data as HivisCamera[]) {
    const cam = mapHivisCamera(row, now);
    if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
  }
  console.log(`[TAKIP] HIVIS cameras — USGS HIVIS: ${seen.size}`);
  return [...seen.values()];
}
