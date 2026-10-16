import type { CctvCamera } from '@/lib/feeds/cameras/types';
import type { Bounds } from '@/lib/feeds/cameras/sources/platforms/cars';

/**
 * TAKIP — New Mexico DOT cameras (~185): the camera list behind nmroads.com's map, no key.
 * Stills come from the https image endpoint, since `snapshotFile` is http-only. About 1 in 5 answers with an empty
 * body or a 511-logo placeholder, and nothing in the row says which.
 * Terms: NMDOT's disclaimer covers accuracy only; it sets no reuse restriction.
 */

const API = 'https://servicev5.nmroads.com/RealMapWAR/GetCameraInfo';
const IMAGE = 'https://servicev5.nmroads.com/RealMapWAR/GetCameraImage';
const UA = 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)';
export const NMDOT_BOUNDS: Bounds = { minLat: 31.3, maxLat: 37.05, minLng: -109.1, maxLng: -103.0 };
/** About 60% of today's 185: fewer is a broken read, not a smaller network. */
const MIN_CAMERAS = 110;

export interface NmdotCamera {
  /** The native id, e.g. `I-25@La_Bajada_Lower`; it can hold `@`, `/` and spaces. */
  name?: string | null;
  title?: string | null;
  lat?: number | null;
  lon?: number | null;
  enabled?: boolean | null;
  grouping?: string | null;
}

export function mapNmdotCamera(r: NmdotCamera | null | undefined): CctvCamera | null {
  if (!r || r.enabled === false || !r.name?.trim()) return null;
  const key = encodeURIComponent(r.name);

  const lat = Number(r.lat);
  const lng = Number(r.lon);
  const b = NMDOT_BOUNDS;
  if (!(lat > b.minLat && lat < b.maxLat && lng > b.minLng && lng < b.maxLng)) return null;

  const group = r.grouping?.trim();
  return {
    id: `nmdot-${key}`,
    lat,
    lng,
    name: r.title?.replace(/\s+/g, ' ').trim() || `NMDOT Camera ${r.name}`,
    // `Statewide` is the map's catch-all group, not a place.
    city: group && group !== 'Statewide' ? group : 'New Mexico',
    country: 'US',
    feed_url: `${IMAGE}?cameraName=${key}`,
    stream_type: 'jpg',
    source: 'NMDOT',
  };
}

export async function fetchNmdotCameras(): Promise<CctvCamera[]> {
  const res = await fetch(API, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`NMDOT cameras HTTP ${res.status}`);

  const json = await res.json();
  if (!Array.isArray(json?.cameraInfo)) throw new Error('NMDOT cameras: no cameraInfo in response');

  const seen = new Map<string, CctvCamera>();
  for (const row of json.cameraInfo) {
    const cam = mapNmdotCamera(row);
    if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
  }
  if (seen.size < MIN_CAMERAS) throw new Error(`NMDOT cameras short read: ${seen.size}`);
  console.log(`[TAKIP] New Mexico cameras — NMDOT: ${seen.size}`);
  return [...seen.values()];
}
