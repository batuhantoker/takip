import type { CctvCamera } from '@/lib/feeds/cameras/types';
import type { Bounds } from '@/lib/feeds/cameras/sources/platforms/cars';
import { stealthFetch } from '@/lib/core/net/stealth-fetch';

/**
 * TAKIP — Alabama DOT cameras (~594): ALGO Traffic's camera list, no key.
 * Terms: ALGO Traffic allows real-time viewing only; recording, commercial use, or transmitting its images without ALDOT's permission is prohibited.
 */

const API = 'https://api.algotraffic.com/v4.0/Cameras';
export const ALGO_BOUNDS: Bounds = { minLat: 30.1, maxLat: 35.1, minLng: -88.6, maxLng: -84.8 };

export interface AlgoCamera {
  id?: number | null;
  location?: {
    latitude?: number | null;
    longitude?: number | null;
    city?: string | null;
    county?: string | null;
    displayRouteDesignator?: string | null;
    displayCrossStreet?: string | null;
    /** `North`, `East`, … or `Any` for a camera that pans. */
    direction?: string | null;
  } | null;
  playbackUrls?: { hls?: string | null } | null;
  /** `Public`, or `ALDOT` / `FirstResponder` for cameras the public map hides. */
  accessLevel?: string | null;
  permLink?: string | null;
  snapshotImageUrl?: string | null;
}

function httpsUrl(raw: string | null | undefined): URL | null {
  try {
    const url = new URL(raw ?? '');
    return url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

function clean(s: string | null | undefined): string {
  return s?.replace(/\s+/g, ' ').trim() ?? '';
}

function cameraName(loc: NonNullable<AlgoCamera['location']>): string {
  const road = clean(loc.displayRouteDesignator);
  const cross = clean(loc.displayCrossStreet);
  const dir = clean(loc.direction);
  const place = road && cross ? `${road} at ${cross}` : road || cross;
  return place && dir && dir !== 'Any' ? `${place} (${dir})` : place;
}

export function mapAlgoCamera(r: AlgoCamera | null | undefined): CctvCamera | null {
  if (!r || !Number.isInteger(r.id) || r.accessLevel !== 'Public') return null;
  const loc = r.location;
  if (!loc) return null;

  const lat = Number(loc.latitude);
  const lng = Number(loc.longitude);
  const b = ALGO_BOUNDS;
  if (!(lat > b.minLat && lat < b.maxLat && lng > b.minLng && lng < b.maxLng)) return null;

  const feed = httpsUrl(r.snapshotImageUrl)?.href;
  const hlsUrl = httpsUrl(r.playbackUrls?.hls);
  const hls = hlsUrl && /\.m3u8$/i.test(hlsUrl.pathname) ? hlsUrl.href : undefined;
  if (!feed && !hls) return null;

  const page = httpsUrl(r.permLink)?.href;
  const city = clean(loc.city) || (clean(loc.county) ? `${clean(loc.county)} County` : 'Alabama');

  return {
    id: `aldot-${r.id}`,
    lat,
    lng,
    name: cameraName(loc) || `ALDOT Camera ${r.id}`,
    city,
    country: 'US',
    ...(feed ? { feed_url: feed } : {}),
    ...(hls ? { stream_url: hls, stream_type: 'hls' as const } : { stream_type: 'jpg' as const }),
    ...(page ? { external_url: page } : {}),
    source: 'ALGO Traffic',
  };
}

export async function fetchAlgoCameras(): Promise<CctvCamera[]> {
  const res = await stealthFetch(API, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`ALGO Traffic cameras HTTP ${res.status}`);

  const rows = await res.json();
  if (!Array.isArray(rows)) throw new Error('ALGO Traffic cameras: unexpected response');

  const seen = new Map<string, CctvCamera>();
  for (const row of rows) {
    const cam = mapAlgoCamera(row);
    if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
  }
  console.log(`[TAKIP] Alabama cameras — ALGO Traffic: ${seen.size}`);
  return [...seen.values()];
}
