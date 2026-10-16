import type { CctvCamera } from '@/lib/feeds/cameras/types';
import type { Bounds } from '@/lib/feeds/cameras/sources/platforms/cars';
import { stealthFetch } from '@/lib/core/net/stealth-fetch';

/**
 * TAKIP — City of Redmond (WA) traffic cameras (~70): the city's camera layer, no key.
 * Terms: none stated.
 */

const API = 'https://gis.redmond.gov/arcgis/rest/services/Traffic/Cameras/MapServer/0/query'
  + '?where=1%3D1&outFields=TCID,Description,ImagePath,d_CameraStatus,d_Published&outSR=4326&f=json';
const STILL_HOST = 'gis.redmond.gov';
export const REDMOND_BOUNDS: Bounds = { minLat: 47.6, maxLat: 47.74, minLng: -122.2, maxLng: -122.0 };

export interface RedmondFeature {
  attributes?: {
    TCID?: number | null;
    Description?: string | null;
    /** `https://gis.redmond.gov/traffic/tcimages/16.jpg` */
    ImagePath?: string | null;
    d_CameraStatus?: string | null;
    d_Published?: string | null;
  } | null;
  geometry?: { x?: number | null; y?: number | null } | null;
}

export function mapRedmondCamera(f: RedmondFeature | null | undefined): CctvCamera | null {
  const a = f?.attributes;
  if (a?.d_CameraStatus !== 'Enabled' || a.d_Published !== 'Yes' || !Number.isInteger(a.TCID)) return null;

  let still: URL;
  try {
    still = new URL(a.ImagePath?.trim() ?? '');
  } catch {
    return null;
  }
  if (still.hostname !== STILL_HOST || !/\.jpg$/i.test(still.pathname)) return null;
  still.protocol = 'https:';

  const lat = Number(f?.geometry?.y);
  const lng = Number(f?.geometry?.x);
  const b = REDMOND_BOUNDS;
  if (!(lat > b.minLat && lat < b.maxLat && lng > b.minLng && lng < b.maxLng)) return null;

  return {
    id: `redmond-${a.TCID}`,
    lat,
    lng,
    name: a.Description?.replace(/\s+/g, ' ').trim() || `Redmond Camera ${a.TCID}`,
    city: 'Redmond',
    country: 'US',
    feed_url: still.href,
    stream_type: 'jpg',
    source: 'City of Redmond',
  };
}

export async function fetchRedmondCameras(): Promise<CctvCamera[]> {
  const res = await stealthFetch(API, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`Redmond cameras HTTP ${res.status}`);

  const json = await res.json();
  // ArcGIS reports query errors with a 200 and an `error` body.
  if (!Array.isArray(json?.features)) throw new Error(`Redmond cameras: ${json?.error?.message ?? 'no features in response'}`);

  const seen = new Map<string, CctvCamera>();
  for (const f of json.features) {
    const cam = mapRedmondCamera(f);
    if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
  }
  console.log(`[TAKIP] Redmond cameras — City of Redmond: ${seen.size}`);
  return [...seen.values()];
}
