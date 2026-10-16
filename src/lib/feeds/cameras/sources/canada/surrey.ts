import type { CctvCamera } from '@/lib/feeds/cameras/types';
import type { Bounds } from '@/lib/feeds/cameras/sources/platforms/cars';
import { stealthFetch } from '@/lib/core/net/stealth-fetch';

/**
 * TAKIP — City of Surrey (BC) traffic cameras (~620): the camera layer behind the city's Traffic Cameras map, no key.
 * Terms: none stated on the layer or the map.
 */

const API = 'https://gisservices.surrey.ca/arcgis/rest/services/Public/Transportation/MapServer/2/query'
  + '?where=1%3D1&outFields=LOCATION,IMAGE&outSR=4326&f=json';
export const SURREY_BOUNDS: Bounds = { minLat: 48.99, maxLat: 49.24, minLng: -122.95, maxLng: -122.65 };
/** The layer also lists DriveBC's cameras (which ./drivebc carries) and old cosmos.surrey.ca stills that 404. */
const STILL_HOST = 'stcameleonprod.blob.core.windows.net';
/** About 80% of today's 620. */
const MIN_CAMERAS = 500;

export interface SurreyFeature {
  attributes?: {
    LOCATION?: string | null;
    /** `…/prodcameleon-blob/TMCNVR02/enc_83A_140_cam1.jpg` */
    IMAGE?: string | null;
  } | null;
  geometry?: { x?: number | null; y?: number | null } | null;
}

export function mapSurreyCamera(f: SurreyFeature | null | undefined): CctvCamera | null {
  let still: URL;
  try {
    still = new URL(f?.attributes?.IMAGE ?? '');
  } catch {
    return null;
  }
  if (still.protocol !== 'https:' || still.hostname !== STILL_HOST) return null;
  const view = still.pathname.match(/\/enc_([\w-]+)\.jpg$/i)?.[1];
  if (!view) return null;

  const lat = Number(f?.geometry?.y);
  const lng = Number(f?.geometry?.x);
  const b = SURREY_BOUNDS;
  if (!(lat > b.minLat && lat < b.maxLat && lng > b.minLng && lng < b.maxLng)) return null;

  // Most intersections have one `cam1`; the rest add a `cam2`, a `pano` or a direction.
  const label = view.match(/_(cam\d+\w*|pano|quad\w*)$/i)?.[1];
  const place = f?.attributes?.LOCATION?.replace(/\s+/g, ' ').trim();
  const name = place && label && label !== 'cam1' ? `${place} (${label})` : place;

  return {
    id: `surrey-${view}`,
    lat,
    lng,
    name: name || `Surrey Camera ${view}`,
    city: 'Surrey',
    country: 'Canada',
    feed_url: still.href,
    stream_type: 'jpg',
    source: 'City of Surrey',
  };
}

export async function fetchSurreyCameras(): Promise<CctvCamera[]> {
  const res = await stealthFetch(API, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Surrey cameras HTTP ${res.status}`);

  const json = await res.json();
  // ArcGIS reports query errors with a 200 and an `error` body.
  if (!Array.isArray(json?.features)) throw new Error(`Surrey cameras: ${json?.error?.message ?? 'no features in response'}`);

  const seen = new Map<string, CctvCamera>();
  for (const f of json.features) {
    const cam = mapSurreyCamera(f);
    if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
  }
  if (seen.size < MIN_CAMERAS) throw new Error(`Surrey cameras short read: ${seen.size}`);
  console.log(`[TAKIP] Surrey cameras — City of Surrey: ${seen.size}`);
  return [...seen.values()];
}
