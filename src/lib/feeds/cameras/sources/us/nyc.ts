import type { CctvCamera } from '@/lib/feeds/cameras/types';
import { snapshotUrl } from '@/lib/feeds/cameras/sources/platforms/cars';

/** NYC DOT traffic cameras: the feed behind webcams.nyctmc.org/cameras-list. */

const API = 'https://webcams.nyctmc.org/api/cameras';
const UA = 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)';
const NYC_BOUNDS = { minLat: 40.47, maxLat: 40.95, minLng: -74.28, maxLng: -73.68 };

export interface NycCamera {
  id?: string | null;
  name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  /** The borough. */
  area?: string | null;
  /** A string, `"true"` / `"false"`. */
  isOnline?: string | boolean | null;
  imageUrl?: string | null;
}

/** Expressway cameras are named by asset code: `C2-BQE-22-WB_at_Lee_Ave-Ex31` → `BQE WB at Lee Ave Exit 31`. */
const ASSET_CODE = /^C\d-([A-Z]+)-\d+[A-Z]?[-_ ]+/;

export function cameraName(raw: string | null | undefined): string | null {
  const name = raw?.replace(/\s+/g, ' ').trim();
  if (!name) return null;
  const m = name.match(ASSET_CODE);
  if (!m) return name;
  return `${m[1]} ${name.slice(m[0].length)}`
    .replace(/_/g, ' ')
    .replace(/[- ]Ex(\d+[A-Z]?)$/i, ' Exit $1')
    .replace(/\s+/g, ' ')
    .trim();
}

export function mapNycCamera(r: NycCamera | null | undefined): CctvCamera | null {
  if (!r || String(r.isOnline) !== 'true') return null;
  const id = r.id?.trim();
  if (!id || !/^[\w-]+$/.test(id)) return null;

  const lat = Number(r.latitude);
  const lng = Number(r.longitude);
  const b = NYC_BOUNDS;
  if (!(lat > b.minLat && lat < b.maxLat && lng > b.minLng && lng < b.maxLng)) return null;

  const feed = snapshotUrl(r.imageUrl);
  if (!feed) return null;

  return {
    id: `nycdot-${id}`,
    lat,
    lng,
    name: cameraName(r.name) || 'NYC DOT Camera',
    city: r.area?.trim() || 'New York City',
    country: 'US',
    feed_url: feed,
    stream_type: 'jpg',
    source: 'NYC DOT',
  };
}

export async function fetchNycCameras(): Promise<CctvCamera[]> {
  const res = await fetch(API, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`NYC DOT cameras HTTP ${res.status}`);

  const json = await res.json();
  if (!Array.isArray(json)) throw new Error('NYC DOT cameras: unexpected response');

  const seen = new Map<string, CctvCamera>();
  for (const row of json) {
    const cam = mapNycCamera(row);
    if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
  }
  console.log(`[TAKIP] NYC DOT cameras: ${seen.size} of ${json.length}`);
  return [...seen.values()];
}
