import type { CctvCamera } from '@/lib/cctv/types';
import { stealthFetch } from '@/lib/stealthFetch';

/**
 * TAKIP — ALERTCalifornia wildfire cameras (UC San Diego), mostly on ridge-top towers.
 * Source: the keyless index behind cameras.alertcalifornia.org. About 950 of its rows carry no location and are skipped.
 * Terms: CC BY-NC-ND 4.0, and the credit "ALERTCalifornia | UC San Diego" is required, hence the source label.
 */

const INDEX = 'https://cameras.alertcalifornia.org/public-camera-data/all_cameras-v3.json';
const IMAGE_BASE = 'https://cameras.alertcalifornia.org/public-camera-data';
const SOURCE = 'ALERTCalifornia | UC San Diego';
const CA_BOUNDS = { minLat: 32.5, maxLat: 42.1, minLng: -124.5, maxLng: -114.0 };
/** A camera that's off the air keeps serving its last frame from the same URL. */
const MAX_FRAME_AGE_S = 24 * 3600;

export interface AlertCaFeature {
  geometry?: { coordinates?: (number | null)[] | null } | null;
  properties?: {
    id?: string | null;
    name?: string | null;
    /** Unix seconds; 0 when the camera has never reported. */
    last_frame_ts?: number | null;
  } | null;
}

export function mapAlertCaCamera(f: AlertCaFeature | null | undefined, nowS = Date.now() / 1000): CctvCamera | null {
  const p = f?.properties;
  const id = p?.id?.trim();
  if (!id || !/^[\w-]+$/.test(id)) return null;

  const ts = p?.last_frame_ts;
  if (!ts || !(nowS - ts < MAX_FRAME_AGE_S)) return null;

  const [lng, lat] = f?.geometry?.coordinates ?? [];
  const b = CA_BOUNDS;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!(lat > b.minLat && lat < b.maxLat && lng > b.minLng && lng < b.maxLng)) return null;

  return {
    id: `alertca-${id}`,
    lat,
    lng,
    name: p?.name?.replace(/\s+/g, ' ').trim() || `ALERTCalifornia ${id}`,
    city: 'California',
    country: 'US',
    feed_url: `${IMAGE_BASE}/${id}/latest-frame.jpg`,
    stream_type: 'jpg',
    source: SOURCE,
  };
}

export async function fetchAlertCaCameras(): Promise<CctvCamera[]> {
  const res = await stealthFetch(INDEX, {
    signal: AbortSignal.timeout(12000),
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`ALERTCalifornia HTTP ${res.status}`);

  const json = await res.json();
  if (!Array.isArray(json?.features)) throw new Error('ALERTCalifornia: no features in response');

  const nowS = Date.now() / 1000;
  const seen = new Map<string, CctvCamera>();
  for (const f of json.features) {
    const cam = mapAlertCaCamera(f, nowS);
    if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
  }
  console.log(`[TAKIP] California cameras — ALERTCalifornia: ${seen.size} of ${json.features.length}`);
  return [...seen.values()];
}
