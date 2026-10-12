import type { CctvCamera } from './types';
import { stealthFetch } from '@/lib/stealthFetch';

/**
 * OSIRIS — Estonian road-weather cameras (~180) from Transpordiamet's Tark Tee map, no key.
 * Terms: Transpordiamet public open data; the layer itself publishes no licence text.
 *
 * `image_path` names one timestamped frame (`94/94_202610121656.jpg`). Old frames stay online for
 * at least a week, so the URL never expires, but it shows the frame as of the last refresh.
 */

const LAYER = 'https://tarktee.transpordiamet.ee/tarktee/rest/services/tram/road_cameras/MapServer/0/query'
  + '?where=1%3D1&outFields=objectid,site_name,image_path&outSR=4326&f=json';
const IMAGE_BASE = 'https://tarktee.transpordiamet.ee/images';

export const ESTONIA_BOUNDS = { minLat: 57.5, maxLat: 59.75, minLng: 21.7, maxLng: 28.25 };

/** `<camera>/<camera>_<yyyymmddhhmm>.jpg`; the camera number is stable, objectid is only a layer row. */
const IMAGE_PATH = /^(\d+)\/\1_\d{12}\.jpg$/;

export interface TarkTeeFeature {
  attributes?: { objectid?: number; site_name?: string | null; image_path?: string | null };
  geometry?: { x?: number; y?: number };
}

export function mapFeature(feature: TarkTeeFeature): CctvCamera | null {
  const a = feature?.attributes;
  const path = a?.image_path?.trim();
  const m = path?.match(IMAGE_PATH);
  if (!m) return null;

  const lat = feature.geometry?.y;
  const lng = feature.geometry?.x;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const b = ESTONIA_BOUNDS;
  if (lat! < b.minLat || lat! > b.maxLat || lng! < b.minLng || lng! > b.maxLng) return null;

  return {
    id: `tarktee-${m[1]}`,
    lat: lat!,
    lng: lng!,
    name: a?.site_name?.trim() || `Tark Tee Camera ${m[1]}`,
    city: 'Estonia',
    country: 'Estonia',
    feed_url: `${IMAGE_BASE}/${path}`,
    source: 'Transpordiamet',
  };
}

export async function fetchEstoniaCameras(): Promise<CctvCamera[]> {
  const res = await stealthFetch(LAYER, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`Tark Tee HTTP ${res.status}`);
  const data = await res.json();

  const seen = new Map<string, CctvCamera>();
  for (const feature of data?.features || []) {
    const cam = mapFeature(feature);
    if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
  }
  console.log(`[OSIRIS] Estonia cameras — Transpordiamet: ${seen.size}`);
  return [...seen.values()];
}
