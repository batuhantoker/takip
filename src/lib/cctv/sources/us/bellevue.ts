import type { CctvCamera } from '@/lib/cctv/types';
import type { Bounds } from '@/lib/cctv/sources/platforms/cars';
import { stealthFetch } from '@/lib/stealthFetch';

/**
 * TAKIP — City of Bellevue (WA) traffic cameras (~200): the city's public camera layer, no key. Live HLS only, no stills.
 * Terms: the layer's licence forbids commercial use without the city's written authorization.
 */

const API = 'https://services1.arcgis.com/EYzEZbDhXZjURPbP/ArcGIS/rest/services/TrafficCameras_Public_View/FeatureServer/0/query'
  + '?where=1%3D1&outFields=ID,Address,Display_Address,OwnedBy,Media&outSR=4326&f=json';
const STREAM_BASE = 'https://trafficcams.bellevuewa.gov/traffic-edge';
export const BELLEVUE_BOUNDS: Bounds = { minLat: 47.5, maxLat: 47.68, minLng: -122.25, maxLng: -122.05 };
/** WSDOT's and Redmond's cameras on the layer are stills that ./wsdot and ./redmond carry. */
const OTHER_OWNERS = new Set(['WSDOT', 'Redmond']);
/** About 80% of today's 206. */
const MIN_CAMERAS = 160;

export interface BellevueFeature {
  attributes?: {
    /** `CCTV218`, sometimes lower-case. */
    ID?: string | null;
    Address?: string | null;
    /** Padded with trailing spaces to the column width. */
    Display_Address?: string | null;
    OwnedBy?: string | null;
    /** `Stream`, `Image` or `None` */
    Media?: string | null;
  } | null;
  geometry?: { x?: number | null; y?: number | null } | null;
}

export function mapBellevueCamera(f: BellevueFeature | null | undefined): CctvCamera | null {
  const a = f?.attributes;
  if (a?.Media !== 'Stream' || OTHER_OWNERS.has(a.OwnedBy ?? '')) return null;
  const id = a.ID?.trim().toUpperCase();
  if (!id || !/^CCTV\d+$/.test(id)) return null;

  const lat = Number(f?.geometry?.y);
  const lng = Number(f?.geometry?.x);
  const b = BELLEVUE_BOUNDS;
  if (!(lat > b.minLat && lat < b.maxLat && lng > b.minLng && lng < b.maxLng)) return null;

  const tidy = (s: string | null | undefined) => s?.replace(/\s+/g, ' ').trim();
  const name = tidy(a.Display_Address) || tidy(a.Address);
  return {
    id: `bellevue-${id}`,
    lat,
    lng,
    name: name || `Bellevue Camera ${id}`,
    city: 'Bellevue',
    country: 'US',
    stream_url: `${STREAM_BASE}/${id}L.stream/playlist.m3u8`,
    stream_type: 'hls',
    source: 'City of Bellevue',
  };
}

export async function fetchBellevueCameras(): Promise<CctvCamera[]> {
  const res = await stealthFetch(API, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`Bellevue cameras HTTP ${res.status}`);

  const json = await res.json();
  // ArcGIS reports query errors with a 200 and an `error` body.
  if (!Array.isArray(json?.features)) throw new Error(`Bellevue cameras: ${json?.error?.message ?? 'no features in response'}`);

  const seen = new Map<string, CctvCamera>();
  for (const f of json.features) {
    const cam = mapBellevueCamera(f);
    if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
  }
  if (seen.size < MIN_CAMERAS) throw new Error(`Bellevue cameras short read: ${seen.size}`);
  console.log(`[TAKIP] Bellevue cameras — City of Bellevue: ${seen.size}`);
  return [...seen.values()];
}
