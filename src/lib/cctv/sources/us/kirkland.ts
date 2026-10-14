import type { CctvCamera } from '@/lib/cctv/types';
import type { Bounds } from '@/lib/cctv/sources/platforms/cars';
import { stealthFetch } from '@/lib/stealthFetch';

/**
 * TAKIP — City of Kirkland (WA) traffic cameras (~28): the city's camera layer, no key.
 * Terms: "© City of Kirkland, all rights reserved".
 */

/** The layer's `LAT`/`LON` columns hold each other's values; the geometry is right. */
const API = 'https://services2.arcgis.com/loGMwowmR0OPlOQb/arcgis/rest/services/TRN_TrafficCams_10032022/FeatureServer/0/query'
  + '?where=1%3D1&outFields=LOCATION,OWNER,IMAGE_&outSR=4326&f=json';
const STILL_HOST = 'its.kirklandwa.gov';
export const KIRKLAND_BOUNDS: Bounds = { minLat: 47.62, maxLat: 47.76, minLng: -122.27, maxLng: -122.12 };

export interface KirklandFeature {
  attributes?: {
    LOCATION?: string | null;
    /** `CoK`; the layer also lists WSDOT's, Bellevue's (`CoB`) and Redmond's (`CoR`), which their own feeds carry. */
    OWNER?: string | null;
    /** `https://its.kirklandwa.gov/CamView/100thAve132ndStPTZ.jpg` */
    IMAGE_?: string | null;
  } | null;
  geometry?: { x?: number | null; y?: number | null } | null;
}

export function mapKirklandCamera(f: KirklandFeature | null | undefined): CctvCamera | null {
  const a = f?.attributes;
  if (a?.OWNER !== 'CoK') return null;

  let still: URL;
  try {
    still = new URL(a.IMAGE_?.trim() ?? '');
  } catch {
    return null;
  }
  if (still.protocol !== 'https:' || still.hostname !== STILL_HOST) return null;
  // `TRAFCAM_ID` repeats across cameras; the file name doesn't.
  const id = still.pathname.match(/\/([\w-]+)\.jpg$/i)?.[1];
  if (!id) return null;

  const lat = Number(f?.geometry?.y);
  const lng = Number(f?.geometry?.x);
  const b = KIRKLAND_BOUNDS;
  if (!(lat > b.minLat && lat < b.maxLat && lng > b.minLng && lng < b.maxLng)) return null;

  return {
    id: `kirkland-${id}`,
    lat,
    lng,
    name: a.LOCATION?.replace(/\s+/g, ' ').trim() || `Kirkland Camera ${id}`,
    city: 'Kirkland',
    country: 'US',
    feed_url: still.href,
    stream_type: 'jpg',
    source: 'City of Kirkland',
  };
}

export async function fetchKirklandCameras(): Promise<CctvCamera[]> {
  const res = await stealthFetch(API, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`Kirkland cameras HTTP ${res.status}`);

  const json = await res.json();
  // ArcGIS reports query errors with a 200 and an `error` body.
  if (!Array.isArray(json?.features)) throw new Error(`Kirkland cameras: ${json?.error?.message ?? 'no features in response'}`);

  const seen = new Map<string, CctvCamera>();
  for (const f of json.features) {
    const cam = mapKirklandCamera(f);
    if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
  }
  console.log(`[TAKIP] Kirkland cameras — City of Kirkland: ${seen.size}`);
  return [...seen.values()];
}
