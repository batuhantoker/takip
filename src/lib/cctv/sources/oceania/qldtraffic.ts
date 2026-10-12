import type { CctvCamera } from '@/lib/cctv/types';
import { stealthFetch } from '@/lib/stealthFetch';

/**
 * TAKIP — Queensland traffic and flood cameras (~256) from QLDTraffic's map GeoJSON, no key.
 * Terms: CC BY 4.0 AU, credit "State of Queensland (Department of Transport and Main Roads)"; TMR decides display
 * permission case by case.
 *
 * The documented api.qldtraffic.qld.gov.au needs a key; these are the files QLDTraffic's own map reads. Flood
 * stills come back as binary/octet-stream, which an <img> still renders.
 */

const FEEDS = [
  { kind: 'web', url: 'https://data.qldtraffic.qld.gov.au/webcameras.geojson' },
  { kind: 'flood', url: 'https://data.qldtraffic.qld.gov.au/floodcameras.geojson' },
] as const;
const IMAGE_HOST = 'cameras.qldtraffic.qld.gov.au';

export const QLDTRAFFIC_BOUNDS = { minLat: -29.3, maxLat: -9, minLng: 137.9, maxLng: 153.7 };

export interface QldFeature {
  geometry?: { coordinates?: (number | null)[] | null } | null;
  properties?: {
    id?: number | null;
    description?: string | null;
    locality?: string | null;
    image_url?: string | null;
  } | null;
}

export function mapQldCamera(f: QldFeature | null | undefined, kind: 'web' | 'flood'): CctvCamera | null {
  const p = f?.properties;
  const id = p?.id;
  if (typeof id !== 'number' || !Number.isInteger(id)) return null;

  let image: URL;
  try {
    image = new URL(p?.image_url ?? '');
  } catch {
    return null;
  }
  if (image.protocol !== 'https:' || image.hostname !== IMAGE_HOST) return null;

  const [lng, lat] = f?.geometry?.coordinates ?? [];
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  const b = QLDTRAFFIC_BOUNDS;
  if (!(lat > b.minLat && lat < b.maxLat && lng > b.minLng && lng < b.maxLng)) return null;

  return {
    id: `qld-${kind}-${id}`,
    lat,
    lng,
    name: p?.description?.trim() || `Queensland ${kind === 'flood' ? 'flood ' : ''}camera ${id}`,
    city: p?.locality?.trim() || '',
    country: 'Australia',
    feed_url: image.href,
    external_url: 'https://qldtraffic.qld.gov.au/',
    source: 'QLDTraffic',
  };
}

export async function fetchQldTrafficCameras(): Promise<CctvCamera[]> {
  const results = await Promise.allSettled(FEEDS.map(async ({ kind, url }) => {
    const res = await stealthFetch(url, { signal: AbortSignal.timeout(12000), headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`QLDTraffic ${kind} HTTP ${res.status}`);
    const json = await res.json();
    return (Array.isArray(json?.features) ? json.features : []).map((f: QldFeature) => mapQldCamera(f, kind));
  }));
  const answered = results.flatMap(r => (r.status === 'fulfilled' ? [r.value] : []));
  if (!answered.length) throw new Error('QLDTraffic: neither camera list answered');

  const seen = new Map<string, CctvCamera>();
  for (const cam of answered.flat()) if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
  console.log(`[TAKIP] Queensland cameras — QLDTraffic: ${seen.size}`);
  return [...seen.values()];
}
