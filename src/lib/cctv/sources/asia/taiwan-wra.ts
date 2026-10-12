import type { CctvCamera } from '@/lib/cctv/types';
import { stealthFetch } from '@/lib/stealthFetch';

/**
 * TAKIP — Taiwan Water Resources Agency river-watch cameras (~131 at 121 stations), no key.
 * Terms: Open Government Data License v1.0; credit 經濟部水利署 (data.gov.tw dataset 36687).
 *
 * This is WRA's own network. The ~4,000-camera list behind fhy.wra.gov.tw (fhyv.wra.gov.tw) sits
 * behind a WAF that answers 403 from outside Taiwan. Stills are PNG served as `image/jpeg`.
 */

const API = 'https://opendata.wra.gov.tw/api/v2/f71b74eb-cbe5-42c6-8be5-7500450e7db0?format=JSON';
const IMAGE_HOST = 'fmg.wra.gov.tw';
const MAP_PAGE = 'https://fhy.wra.gov.tw/fhyv2/monitor/cctv';

export const TAIWAN_WRA_BOUNDS = { minLat: 21.8, maxLat: 25.4, minLng: 119.3, maxLng: 122.1 };

export interface WraCamera {
  cameraid?: string | null;
  cameraname?: string | null;
  videosurveillancestationname?: string | null;
  countiesandcitieswherethemonitoringpointsarelocated?: string | null;
  imageurl?: string | null;
  latitude_4326?: string | null;
  longitude_4326?: string | null;
  /** `1` is in service. */
  status?: string | null;
}

export function mapWraCamera(r: WraCamera | null | undefined): CctvCamera | null {
  const id = r?.cameraid?.trim();
  if (!id || !/^\d+$/.test(id) || r?.status !== '1') return null;

  const lat = Number(r.latitude_4326);
  const lng = Number(r.longitude_4326);
  const b = TAIWAN_WRA_BOUNDS;
  if (!(lat > b.minLat && lat < b.maxLat && lng > b.minLng && lng < b.maxLng)) return null;

  let image: URL;
  try {
    image = new URL(r.imageurl ?? '');
  } catch {
    return null;
  }
  if (image.protocol !== 'https:' || image.hostname !== IMAGE_HOST) return null;

  return {
    id: `tw-wra-${id}`,
    lat,
    lng,
    name: r.cameraname?.trim() || r.videosurveillancestationname?.trim() || `WRA Camera ${id}`,
    city: r.countiesandcitieswherethemonitoringpointsarelocated?.trim() || '',
    country: 'Taiwan',
    feed_url: image.href,
    stream_type: 'jpg',
    external_url: MAP_PAGE,
    source: 'WRA',
  };
}

export async function fetchTaiwanWraCameras(): Promise<CctvCamera[]> {
  const res = await stealthFetch(API, { signal: AbortSignal.timeout(12000), headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Taiwan WRA HTTP ${res.status}`);
  const rows = await res.json();
  if (!Array.isArray(rows)) throw new Error('Taiwan WRA: unexpected response');

  const seen = new Map<string, CctvCamera>();
  for (const r of rows as (WraCamera | null)[]) {
    const cam = mapWraCamera(r);
    if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
  }
  if (!seen.size) throw new Error('Taiwan WRA: no cameras in the response');
  console.log(`[TAKIP] Taiwan cameras — WRA: ${seen.size}`);
  return [...seen.values()];
}
