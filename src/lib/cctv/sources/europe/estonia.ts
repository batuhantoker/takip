import type { CctvCamera } from '@/lib/cctv/types';
import { admitRoadCondition, type RoadCondition } from '@/lib/cctv/road-condition';
import { stealthFetch } from '@/lib/stealthFetch';

/**
 * TAKIP — Estonian road-weather cameras (~180) from Transpordiamet's Tark Tee map, no key.
 * Terms: Transpordiamet public open data; the layer itself publishes no licence text.
 *
 * `image_path` names one timestamped frame (`94/94_202610121656.jpg`). Old frames stay online for
 * at least a week, so the URL never expires, but it shows the frame as of the last refresh.
 * Each camera names the road-weather station Transpordiamet pairs it with, its distance and its surface reading.
 */

const LAYER = 'https://tarktee.transpordiamet.ee/tarktee/rest/services/tram/road_cameras/MapServer/0/query'
  + '?where=1%3D1&outFields=objectid,site_name,image_path,closest_weather_station,distance,air_temp,road_temp,road_status,road_status_aggregate,weather_time'
  + '&outSR=4326&f=json';
const IMAGE_BASE = 'https://tarktee.transpordiamet.ee/images';

export const ESTONIA_BOUNDS = { minLat: 57.5, maxLat: 59.75, minLng: 21.7, maxLng: 28.25 };

/** `<camera>/<camera>_<yyyymmddhhmm>.jpg`; the camera number is stable, objectid is only a layer row. */
const IMAGE_PATH = /^(\d+)\/\1_\d{12}\.jpg$/;

export interface TarkTeeFeature {
  attributes?: {
    objectid?: number; site_name?: string | null; image_path?: string | null;
    closest_weather_station?: string | null; distance?: number | null; air_temp?: number | null; road_temp?: number | null;
    road_status?: string | null; road_status_aggregate?: string | null; weather_time?: number | null;
  };
  geometry?: { x?: number; y?: number };
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

/** The station's reading, unless Transpordiamet itself flags it as over two hours old. */
export function tarkTeeRoad(a: TarkTeeFeature['attributes'], now = Date.now()): RoadCondition | null {
  const surface = a?.road_status?.trim();
  if (!surface || a?.road_status_aggregate === 'OVER_2_HOURS' || typeof a?.weather_time !== 'number') return null;
  return admitRoadCondition({
    surface: surface.charAt(0) + surface.slice(1).toLowerCase(),
    road_temp: num(a.road_temp),
    air_temp: num(a.air_temp),
    observed_at: new Date(a.weather_time).toISOString(),
    station: a.closest_weather_station?.trim() || undefined,
    distance_km: num(a.distance),
    source: 'Transpordiamet',
  }, now);
}

export function mapFeature(feature: TarkTeeFeature, now = Date.now()): CctvCamera | null {
  const a = feature?.attributes;
  const path = a?.image_path?.trim();
  const m = path?.match(IMAGE_PATH);
  if (!m) return null;

  const lat = feature.geometry?.y;
  const lng = feature.geometry?.x;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const b = ESTONIA_BOUNDS;
  if (lat! < b.minLat || lat! > b.maxLat || lng! < b.minLng || lng! > b.maxLng) return null;

  const road = tarkTeeRoad(a, now);
  return {
    ...(road ? { road } : {}),
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
  console.log(`[TAKIP] Estonia cameras — Transpordiamet: ${seen.size}`);
  return [...seen.values()];
}
