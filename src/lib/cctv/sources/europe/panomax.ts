import type { CctvCamera } from '@/lib/cctv/types';
import { stealthFetch } from '@/lib/stealthFetch';

/**
 * TAKIP — Panomax 360° panorama cameras (~600, mostly the Alps, a few worldwide) from Panomax's own public instance
 * list, no key.
 * Terms: content is for personal use only; reproduction or distribution to third parties needs Panomax GmbH's consent,
 * and framing its pages is prohibited (panomax.com imprint).
 *
 * The public list also keeps long-dead cameras; the instances on panomax.com's own map are the live set.
 */

const PUBLIC_API = 'https://api.panomax.com/1.0/instances/lists/public';
const MAP_API = 'https://api.panomax.com/1.0/maps/panomaxweb';
const SOURCE = 'Panomax';

export const PANOMAX_BOUNDS = { minLat: -60, maxLat: 72, minLng: -180, maxLng: 180 };

export interface PanomaxInstance {
  id?: number | null;
  name?: string | null;
  camId?: number | null;
  /** Decimal strings. */
  latitude?: string | number | null;
  longitude?: string | number | null;
  countryName?: string | null;
  city?: string | null;
  webcamUrl?: string | null;
  images?: { url?: string | null }[] | null;
  /** Ships and other moving cameras: the listed point is a stale snapshot. */
  tourCam?: boolean | null;
}

export interface PanomaxMap {
  instances?: Record<string, { id?: number | null }> | null;
}

export function liveInstanceIds(map: PanomaxMap | null | undefined): Set<number> {
  const ids = new Set<number>();
  for (const inst of Object.values(map?.instances ?? {})) {
    if (Number.isInteger(inst?.id)) ids.add(inst.id!);
  }
  return ids;
}

export function mapPanomaxInstance(inst: PanomaxInstance, live: Set<number>): CctvCamera | null {
  const { id, camId } = inst ?? {};
  if (!Number.isInteger(id) || !Number.isInteger(camId) || !live.has(id!) || inst.tourCam !== false) return null;

  const feed = `https://live-image.panomax.com/cams/${camId}/recent_reduced.jpg`;
  if (!inst.images?.some(img => img?.url === feed)) return null;

  const lat = Number(inst.latitude);
  const lng = Number(inst.longitude);
  if (inst.latitude == null || inst.longitude == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat === 0 && lng === 0) return null;
  const b = PANOMAX_BOUNDS;
  if (lat < b.minLat || lat > b.maxLat || lng < b.minLng || lng > b.maxLng) return null;

  const page = inst.webcamUrl?.trim();
  return {
    id: `panomax-${id}`,
    lat,
    lng,
    name: inst.name?.trim() || `${SOURCE} ${id}`,
    city: inst.city?.trim() || '',
    country: inst.countryName?.trim() || '',
    feed_url: feed,
    ...(page?.startsWith('https://') ? { external_url: page } : {}),
    source: SOURCE,
  };
}

async function getJson(url: string): Promise<unknown> {
  const res = await stealthFetch(url, { signal: AbortSignal.timeout(12000), headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Panomax HTTP ${res.status}`);
  return res.json();
}

export async function fetchPanomaxCameras(): Promise<CctvCamera[]> {
  const [list, map] = await Promise.all([getJson(PUBLIC_API), getJson(MAP_API)]);
  if (!Array.isArray(list)) throw new Error('Panomax: no instance list in response');
  const live = liveInstanceIds(map as PanomaxMap);
  if (!live.size) throw new Error('Panomax: no instances on the map');

  const seen = new Map<string, CctvCamera>();
  for (const inst of list) {
    const cam = mapPanomaxInstance(inst, live);
    if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
  }
  console.log(`[TAKIP] Panorama cameras — ${SOURCE}: ${seen.size}`);
  return [...seen.values()];
}
