import type { CctvCamera } from '@/lib/cctv/types';
import type { Bounds } from '@/lib/cctv/sources/platforms/cars';
import { stealthFetch } from '@/lib/stealthFetch';

/**
 * TAKIP — York Region (Ontario) traffic cameras (~394): the region's OpenData/Traffic camera layer, no key.
 * Terms: York Region Open Data Licence.
 */

/** `LATITUDE`/`LONGITUDE` hold UTM metres, not degrees; `outSR=4326` makes the geometry WGS84. */
const API = 'https://ww8.yorkmaps.ca/arcgis/rest/services/OpenData/Traffic/MapServer/0/query'
  + '?where=1%3D1&outFields=FACILITYID,photo,url,cameralocation&outSR=4326&f=json';
export const YORK_REGION_BOUNDS: Bounds = { minLat: 43.7, maxLat: 44.45, minLng: -79.9, maxLng: -79.0 };

export interface YorkRegionFeature {
  attributes?: {
    FACILITYID?: string | null;
    photo?: string | null;
    /** The camera's page on the region's own viewer. */
    url?: string | null;
    cameralocation?: string | null;
  } | null;
  geometry?: { x?: number | null; y?: number | null } | null;
}

function yorkUrl(raw: string | null | undefined): URL | null {
  try {
    const url = new URL(raw ?? '');
    return url.protocol === 'https:' && /(^|\.)yorkmaps\.ca$/.test(url.hostname) ? url : null;
  } catch {
    return null;
  }
}

export function mapYorkRegionCamera(f: YorkRegionFeature | null | undefined): CctvCamera | null {
  const a = f?.attributes;
  const id = a?.FACILITYID?.trim();
  if (!id || !/^\d+$/.test(id)) return null;

  const lat = Number(f?.geometry?.y);
  const lng = Number(f?.geometry?.x);
  const b = YORK_REGION_BOUNDS;
  if (!(lat > b.minLat && lat < b.maxLat && lng > b.minLng && lng < b.maxLng)) return null;

  const still = yorkUrl(a?.photo);
  if (!still || !/\.jpg$/i.test(still.pathname)) return null;
  const page = yorkUrl(a?.url)?.href;

  return {
    id: `yorkregion-${id}`,
    lat,
    lng,
    name: a?.cameralocation?.replace(/\s+/g, ' ').trim() || `York Region Camera ${id}`,
    city: 'York Region',
    country: 'Canada',
    feed_url: still.href,
    stream_type: 'jpg',
    ...(page ? { external_url: page } : {}),
    source: 'York Region',
  };
}

export async function fetchYorkRegionCameras(): Promise<CctvCamera[]> {
  const res = await stealthFetch(API, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`York Region cameras HTTP ${res.status}`);

  const json = await res.json();
  // ArcGIS reports query errors with a 200 and an `error` body.
  if (!Array.isArray(json?.features)) throw new Error(`York Region cameras: ${json?.error?.message ?? 'no features in response'}`);

  const seen = new Map<string, CctvCamera>();
  for (const f of json.features) {
    const cam = mapYorkRegionCamera(f);
    if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
  }
  console.log(`[TAKIP] York Region cameras — York Region: ${seen.size}`);
  return [...seen.values()];
}
