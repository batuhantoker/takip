import type { CctvCamera } from '@/lib/cctv/types';
import type { Bounds } from '@/lib/cctv/sources/platforms/cars';
import { stealthFetch } from '@/lib/stealthFetch';

/**
 * TAKIP — King County Roads (WA) traffic cameras (~58), mostly unincorporated roads: the county's camera layer, no key.
 * Terms: King County GIS terms and conditions.
 */

const API = 'https://services.arcgis.com/Ej0PsM5Aw677QF1W/arcgis/rest/services/TRAFFICCAMERA_POINT_2029/FeatureServer/0/query'
  + "?where=CurrentStatus%3D'Active'+AND+Live%3D1&outFields=AssetID,Location,ImageURL,Owner,CurrentStatus,Live&outSR=4326&f=json";
const STILL_HOST = 'info.kingcounty.gov';
export const KING_COUNTY_BOUNDS: Bounds = { minLat: 47.08, maxLat: 47.78, minLng: -122.55, maxLng: -121.0 };

export interface KingCountyFeature {
  attributes?: {
    AssetID?: number | null;
    Location?: string | null;
    /** `http://info.kingcounty.gov/…/Handler.ashx?id=16SW_107.jpg`, sometimes with a trailing newline. */
    ImageURL?: string | null;
    Owner?: string | null;
    CurrentStatus?: string | null;
    Live?: number | null;
  } | null;
  geometry?: { x?: number | null; y?: number | null } | null;
}

export function mapKingCountyCamera(f: KingCountyFeature | null | undefined): CctvCamera | null {
  const a = f?.attributes;
  if (a?.CurrentStatus !== 'Active' || a.Live !== 1 || !Number.isInteger(a.AssetID)) return null;

  let still: URL;
  try {
    still = new URL(a.ImageURL?.trim() ?? '');
  } catch {
    return null;
  }
  // Redmond's cameras on the layer point at gis.redmond.gov, which ./redmond carries; WSDOT's are retired.
  if (still.hostname !== STILL_HOST || !still.searchParams.get('id')) return null;
  still.protocol = 'https:';

  const lat = Number(f?.geometry?.y);
  const lng = Number(f?.geometry?.x);
  const b = KING_COUNTY_BOUNDS;
  if (!(lat > b.minLat && lat < b.maxLat && lng > b.minLng && lng < b.maxLng)) return null;

  return {
    id: `kingcounty-${a.AssetID}`,
    lat,
    lng,
    name: a.Location?.replace(/\s+/g, ' ').trim() || `King County Camera ${a.AssetID}`,
    city: 'King County',
    country: 'US',
    feed_url: still.href,
    stream_type: 'jpg',
    source: 'King County Roads',
  };
}

export async function fetchKingCountyCameras(): Promise<CctvCamera[]> {
  const res = await stealthFetch(API, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`King County cameras HTTP ${res.status}`);

  const json = await res.json();
  // ArcGIS reports query errors with a 200 and an `error` body.
  if (!Array.isArray(json?.features)) throw new Error(`King County cameras: ${json?.error?.message ?? 'no features in response'}`);

  const seen = new Map<string, CctvCamera>();
  for (const f of json.features) {
    const cam = mapKingCountyCamera(f);
    if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
  }
  console.log(`[TAKIP] King County cameras — King County Roads: ${seen.size}`);
  return [...seen.values()];
}
