import type { CctvCamera } from '@/lib/cctv/types';
import type { Bounds } from '@/lib/cctv/sources/platforms/cars';

/**
 * TAKIP — ARDOT cameras (~514 views): the keyless GeoJSON layer behind IDrive Arkansas, with each camera's
 * public still. The HLS needs CloudFront signed cookies, so cameras stay on their still.
 */

const API = 'https://layers.idrivearkansas.com/cameras.geojson';
const STILLS = 'https://layers.idrivearkansas.com/cameras';
const UA = 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)';
export const ARDOT_BOUNDS: Bounds = { minLat: 33.0, maxLat: 36.5, minLng: -94.62, maxLng: -89.64 };
/** About 60% of today's 514: fewer is a broken read, not a smaller network. */
const MIN_CAMERAS = 300;
/** Neighbours' cameras ARDOT relays (TDOT's Memphis stills are frozen, MDOT's are a placeholder); their owners win. */
const RELAYED_NUMBER = /^(TN|MS|MO|OK|TX|LA)\d/;
const RELAYED_CAMERA = /^(Tennessee|Mississippi|Missouri|Oklahoma|Texas|Louisiana):/;

export interface ArdotFeature {
  geometry?: { coordinates?: (number | null)[] | null } | null;
  properties?: {
    id?: number | null;
    status?: string | null;
    name?: string | null;
    direction_name?: string | null;
    camera?: string | null;
    ahtd_camera_number?: string | number | null;
  } | null;
}

export function mapArdotCamera(f: ArdotFeature | null | undefined): CctvCamera | null {
  const p = f?.properties;
  if (!p || p.status !== 'online') return null;
  if (RELAYED_NUMBER.test(String(p.ahtd_camera_number ?? '')) || RELAYED_CAMERA.test(p.camera ?? '')) return null;

  const id = p.id;
  if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) return null;

  const [lng, lat] = f?.geometry?.coordinates ?? [];
  const b = ARDOT_BOUNDS;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!(lat > b.minLat && lat < b.maxLat && lng > b.minLng && lng < b.maxLng)) return null;

  const label = p.name?.replace(/\s+/g, ' ').trim();
  const direction = p.direction_name?.trim();
  return {
    id: `ardot-${id}`,
    lat,
    lng,
    name: label ? (direction ? `${label} - ${direction}` : label) : `ARDOT Camera ${id}`,
    city: 'Arkansas',
    country: 'US',
    feed_url: `${STILLS}/${id}.jpg`,
    stream_type: 'jpg',
    source: 'ARDOT',
  };
}

export async function fetchArdotCameras(): Promise<CctvCamera[]> {
  const res = await fetch(API, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`ARDOT cameras HTTP ${res.status}`);

  const json = await res.json();
  if (!Array.isArray(json?.features)) throw new Error('ARDOT cameras: no features in response');

  const seen = new Map<string, CctvCamera>();
  for (const f of json.features as ArdotFeature[]) {
    const cam = mapArdotCamera(f);
    if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
  }
  if (seen.size < MIN_CAMERAS) throw new Error(`ARDOT cameras short read: ${seen.size}`);
  console.log(`[TAKIP] Arkansas cameras — ARDOT: ${seen.size}`);
  return [...seen.values()];
}
