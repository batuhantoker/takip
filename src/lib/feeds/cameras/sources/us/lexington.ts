import type { CctvCamera } from '@/lib/feeds/cameras/types';
import type { Bounds } from '@/lib/feeds/cameras/sources/platforms/cars';
import { stealthFetch } from '@/lib/core/net/stealth-fetch';

/**
 * TAKIP — Lexington, KY city traffic cameras (~107): LFUCG Traffic Engineering's public ArcGIS layer, no key.
 * Terms: LFUCG open-data Terms of Use (use and derivative works allowed, as-is, no warranty).
 * Stills only: the Wowza HLS path answers 403. kentucky.ts carries KYTC's interstate cameras around the city.
 */

const LAYER = 'https://services1.arcgis.com/Mg7DLdfYcSWIaDnu/arcgis/rest/services/Traffic_Camera_Locations_Public_view/FeatureServer/0/query'
  + '?where=1%3D1&outFields=objectid,location,still_url&outSR=4326&f=json';
export const LEXINGTON_BOUNDS: Bounds = { minLat: 37.85, maxLat: 38.25, minLng: -84.75, maxLng: -84.25 };

export interface LexingtonFeature {
  attributes?: { objectid?: number | null; location?: string | null; still_url?: string | null } | null;
  geometry?: { x?: number | null; y?: number | null } | null;
}

// The layer is bulk-reloaded, so objectids can renumber; the Wowza stream name is the camera's own number.
const STREAM = /^lex-cam-(\d+)\.stream$/;

export function mapLexingtonCamera(feature: LexingtonFeature | null | undefined): CctvCamera | null {
  const a = feature?.attributes;
  let still: URL;
  try {
    still = new URL(a?.still_url ?? '');
  } catch {
    return null;
  }
  if (still.protocol !== 'https:') return null;
  const num = still.searchParams.get('streamname')?.match(STREAM)?.[1];
  if (!num) return null;

  const lat = Number(feature?.geometry?.y);
  const lng = Number(feature?.geometry?.x);
  const b = LEXINGTON_BOUNDS;
  if (!(lat > b.minLat && lat < b.maxLat && lng > b.minLng && lng < b.maxLng)) return null;

  return {
    id: `lexky-${num}`,
    lat,
    lng,
    name: a?.location?.trim() || `Lexington Camera ${num}`,
    city: 'Lexington',
    country: 'US',
    feed_url: still.href,
    stream_type: 'jpg',
    source: 'LFUCG Traffic Engineering',
  };
}

export async function fetchLexingtonCameras(): Promise<CctvCamera[]> {
  const res = await stealthFetch(LAYER, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`Lexington cameras HTTP ${res.status}`);

  const json = await res.json();
  // ArcGIS reports query errors as HTTP 200 with an error body.
  if (json?.error) throw new Error(`Lexington cameras: ${json.error.message ?? 'query error'}`);
  if (!Array.isArray(json?.features)) throw new Error('Lexington cameras: no features in response');

  const seen = new Map<string, CctvCamera>();
  for (const f of json.features) {
    const cam = mapLexingtonCamera(f);
    if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
  }
  console.log(`[TAKIP] Lexington cameras — LFUCG: ${seen.size}`);
  return [...seen.values()];
}
