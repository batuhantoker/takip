import type { CctvCamera } from '@/lib/feeds/cameras/types';
import { stealthFetch } from '@/lib/core/net/stealth-fetch';

/**
 * TAKIP — Seattle DOT traffic cameras: the feed behind web.seattle.gov/Travelers.
 * Terms: City of Seattle public traveller information; its terms of use set no reuse restriction.
 */

/** Below zoom 19 the API clusters cameras onto shared points; 20 returns nothing. */
const API = 'https://web.seattle.gov/Travelers/api/Map/Data?zoomId=19&type=2';
const IMAGE_BASE = 'https://www.seattle.gov/trafficcams/images';
const SEATTLE_BOUNDS = { minLat: 47.48, maxLat: 47.75, minLng: -122.45, maxLng: -122.22 };
/** wsdot.ts lists this SDOT camera at the Fauntleroy ferry dock. */
const CARRIED_BY_WSDOT = new Set(['Fauntleroy_SW_Cloverdale_NS.jpg']);

export interface SeattleCamera {
  Id?: string | null;
  Description?: string | null;
  /** A file name under IMAGE_BASE. */
  ImageUrl?: string | null;
  /** `sdot`, or `wsdot` for WSDOT's own cameras on images.wsdot.wa.gov, a host wsdot.ts owns. */
  Type?: string | null;
}

export interface SeattleFeature {
  /** `[lat, lng]`, latitude first. */
  PointCoordinate?: (number | null)[] | null;
  Cameras?: SeattleCamera[] | null;
}

export function mapSeattleCamera(point: SeattleFeature['PointCoordinate'], cam: SeattleCamera | null | undefined): CctvCamera | null {
  if (cam?.Type !== 'sdot') return null;
  const id = cam.Id?.trim();
  const file = cam.ImageUrl?.trim();
  if (!id || !/^[\w-]+$/.test(id)) return null;
  if (!file || !/^[\w.-]+\.jpg$/i.test(file) || CARRIED_BY_WSDOT.has(file)) return null;

  const [lat, lng] = point ?? [];
  const b = SEATTLE_BOUNDS;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!(lat > b.minLat && lat < b.maxLat && lng > b.minLng && lng < b.maxLng)) return null;

  return {
    id: `seattle-${id}`,
    lat,
    lng,
    name: cam.Description?.replace(/\s+/g, ' ').trim() || `SDOT Camera ${id}`,
    city: 'Seattle',
    country: 'US',
    feed_url: `${IMAGE_BASE}/${file}`,
    stream_type: 'jpg',
    source: 'SDOT',
  };
}

export async function fetchSeattleCameras(): Promise<CctvCamera[]> {
  const res = await stealthFetch(API, {
    signal: AbortSignal.timeout(12000),
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Seattle DOT HTTP ${res.status}`);

  const json = await res.json();
  if (!Array.isArray(json?.Features)) throw new Error('Seattle DOT: no Features in response');

  const seen = new Map<string, CctvCamera>();
  for (const f of json.Features as SeattleFeature[]) {
    for (const c of f?.Cameras ?? []) {
      const cam = mapSeattleCamera(f.PointCoordinate, c);
      if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
    }
  }
  console.log(`[TAKIP] Seattle cameras — SDOT: ${seen.size}`);
  return [...seen.values()];
}
