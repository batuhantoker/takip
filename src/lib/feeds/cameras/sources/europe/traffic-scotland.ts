import type { CctvCamera } from '@/lib/feeds/cameras/types';
import type { Bounds } from '@/lib/feeds/cameras/sources/platforms/cars';

/**
 * TAKIP — Transport Scotland trunk-road cameras (~415) from traffic.gov.scot, no key.
 * Terms: Traffic Scotland asks that camera images are not hyperlinked directly; frames are re-served
 * from our own route, which needs Transport Scotland's permission: not yet asked.
 * There is no image URL: each frame is a base64 JPEG inside the camera's HTML fragment, decoded on demand.
 */

export const TS_BASE = 'https://www.traffic.gov.scot/tsis';
const UA = 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)';
export const TRAFFIC_SCOTLAND_BOUNDS: Bounds = { minLat: 54.6, maxLat: 60.9, minLng: -8.7, maxLng: -0.7 };

export interface TrafficScotlandRow {
  sid?: string | null;
  title?: string | null;
  lat?: string | number | null;
  lng?: string | number | null;
  roadname?: string | null;
  region?: string | null;
}

export function mapTrafficScotlandCamera(r: TrafficScotlandRow | null | undefined): CctvCamera | null {
  const sid = String(r?.sid ?? '').trim();
  if (!/^\d+$/.test(sid)) return null;
  const lat = Number(r?.lat);
  const lng = Number(r?.lng);
  const b = TRAFFIC_SCOTLAND_BOUNDS;
  if (!(lat > b.minLat && lat < b.maxLat && lng > b.minLng && lng < b.maxLng)) return null;
  return {
    id: `trafficscot-${sid}`,
    lat,
    lng,
    name: r?.title?.trim() || `Traffic Scotland Camera ${sid}`,
    city: r?.region?.trim() || 'Scotland',
    country: 'United Kingdom',
    feed_url: `/api/cctv/traffic-scotland/frame?sid=${sid}`,
    stream_type: 'jpg',
    external_url: 'https://www.traffic.gov.scot/traffic-cameras',
    source: 'Traffic Scotland',
  };
}

/** The JPEG inside a camerahtml fragment, or null when the page carries none. */
export function extractTrafficScotlandFrame(html: string): Buffer | null {
  const b64 = html.match(/<img[^>]+src="data:image\/jpeg;base64,([A-Za-z0-9+/=]+)"/)?.[1];
  if (!b64 || b64.length > 8_000_000) return null;
  const image = Buffer.from(b64, 'base64');
  return image.length > 3 && image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff ? image : null;
}

export async function fetchTrafficScotlandCameras(): Promise<CctvCamera[]> {
  const res = await fetch(`${TS_BASE}/cameras`, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(12_000) });
  if (!res.ok) throw new Error(`Traffic Scotland cameras HTTP ${res.status}`);
  const json = await res.json();
  if (!Array.isArray(json?.results)) throw new Error('Traffic Scotland cameras: unexpected response');
  const seen = new Map<string, CctvCamera>();
  for (const row of json.results) {
    const cam = mapTrafficScotlandCamera(row);
    if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
  }
  if (seen.size < json.results.length * 0.8) throw new Error(`Traffic Scotland cameras: only ${seen.size} of ${json.results.length} usable`);
  return [...seen.values()];
}
