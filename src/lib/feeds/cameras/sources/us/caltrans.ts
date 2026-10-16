import type { CctvCamera } from '@/lib/feeds/cameras/types';
import type { Bounds } from '@/lib/feeds/cameras/sources/platforms/cars';

/**
 * TAKIP — Caltrans cameras (~3,390 in service of ~3,590): the per-district CCTV status JSON on cwwp2, no key.
 * Replaces Caltrans' ArcGIS CCTV layer, a stale copy that lacked ~950 live cameras and still listed dead ones.
 * Stills only: the wzmedia HLS needs a cwwp2 Referer that a browser on our site can't send.
 * Terms: dot.ca.gov conditions of use (public domain unless otherwise indicated); cwwp2: "no charge for the use of this data".
 */

const DISTRICTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const UA = 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)';
/** The still's folder and file share the camera's slug, which is unique statewide. */
const STILL = /^https:\/\/cwwp2\.dot\.ca\.gov\/data\/d\d{1,2}\/cctv\/image\/([a-z0-9]+)\/\1\.jpg$/;

export const CALTRANS_BOUNDS: Bounds = { minLat: 32.4, maxLat: 42.1, minLng: -124.6, maxLng: -114.0 };

export function districtUrl(n: number): string {
  return `https://cwwp2.dot.ca.gov/data/d${n}/cctv/cctvStatusD${String(n).padStart(2, '0')}.json`;
}

/** Every value is a string, booleans and coordinates included. */
export interface CaltransRecord {
  cctv?: {
    index?: string | null;
    location?: {
      district?: string | null;
      locationName?: string | null;
      nearbyPlace?: string | null;
      longitude?: string | null;
      latitude?: string | null;
      /** Unreliable: D7 rows in Los Angeles say "Alameda". */
      county?: string | null;
    } | null;
    inService?: string | null;
    imageData?: {
      streamingVideoURL?: string | null;
      static?: { currentImageURL?: string | null } | null;
    } | null;
  } | null;
}

export function mapCaltransCamera(record: CaltransRecord | null | undefined): CctvCamera | null {
  const c = record?.cctv;
  if (!c || c.inService !== 'true') return null;

  const still = c.imageData?.static?.currentImageURL?.trim() ?? '';
  const slug = still.match(STILL)?.[1];
  if (!slug) return null;

  const loc = c.location;
  const lat = Number(loc?.latitude);
  const lng = Number(loc?.longitude);
  const b = CALTRANS_BOUNDS;
  if (!(lat > b.minLat && lat < b.maxLat && lng > b.minLng && lng < b.maxLng)) return null;

  return {
    id: `cal-${slug}`,
    lat,
    lng,
    name: loc?.locationName?.replace(/\s+/g, ' ').trim() || `Caltrans Camera ${slug}`,
    city: loc?.nearbyPlace?.trim() || loc?.county?.trim() || 'California',
    country: 'US',
    feed_url: still,
    stream_type: 'jpg',
    source: 'Caltrans',
  };
}

async function fetchDistrict(n: number): Promise<CaltransRecord[]> {
  const res = await fetch(districtUrl(n), {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (!Array.isArray(json?.data)) throw new Error('no data in response');
  return json.data;
}

export async function fetchCaltransCameras(): Promise<CctvCamera[]> {
  const results = await Promise.allSettled(DISTRICTS.map(fetchDistrict));

  const seen = new Map<string, CctvCamera>();
  const failed: string[] = [];
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      failed.push(`D${DISTRICTS[i]} (${r.reason instanceof Error ? r.reason.message : r.reason})`);
      return;
    }
    for (const record of r.value) {
      const cam = mapCaltransCamera(record);
      if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
    }
  });
  if (failed.length === DISTRICTS.length) throw new Error(`Caltrans cameras: every district failed — ${failed.join(', ')}`);
  if (failed.length) console.warn(`[TAKIP] Caltrans districts missing: ${failed.join(', ')}`);
  console.log(`[TAKIP] California cameras — Caltrans: ${seen.size}`);
  return [...seen.values()];
}
