import type { CctvCamera } from '@/lib/feeds/cameras/types';
import type { Bounds } from '@/lib/feeds/cameras/sources/platforms/cars';

/**
 * TAKIP — North Dakota DOT cameras (~809 views at 189 sites): the GeoJSON behind the ND Roads travel map, no key.
 * Terms: nd.gov's disclaimer covers accuracy only; it sets no reuse restriction.
 */

const API = 'https://travelfiles.dot.nd.gov/geojson/cameras/cameras.json';
const UA = 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)';
export const NDDOT_BOUNDS: Bounds = { minLat: 45.9, maxLat: 49.05, minLng: -104.1, maxLng: -96.55 };
/** About 60% of today's 809: fewer is a broken read, not a smaller network. */
const MIN_CAMERAS = 480;
/** A few file names carry an `@` (`ND1806@RP22.81FortYatesNorth`); they serve like the rest. */
const NATIVE_ID = /^[\w.@-]+$/;

export interface NddotView {
  Description?: string | null;
  /** The still, sometimes padded with spaces or CRLF. `FullPath` repeats it with typos. */
  LinkPath?: string | null;
}

export interface NddotSite {
  geometry?: { coordinates?: (number | null)[] | null } | null;
  properties?: { Region?: string | null; Cameras?: NddotView[] | null } | null;
}

export function mapNddotCamera(site: NddotSite | null | undefined, view: NddotView | null | undefined): CctvCamera | null {
  let still: URL;
  try {
    still = new URL(view?.LinkPath?.trim() ?? '');
  } catch {
    return null;
  }
  if (still.protocol !== 'https:') return null;
  const id = still.pathname.match(/\/([^/]+)\.jpg$/i)?.[1];
  if (!id || !NATIVE_ID.test(id)) return null;

  const [lng, lat] = site?.geometry?.coordinates ?? [];
  const b = NDDOT_BOUNDS;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!(lat > b.minLat && lat < b.maxLat && lng > b.minLng && lng < b.maxLng)) return null;

  return {
    id: `nddot-${id}`,
    lat,
    lng,
    name: view?.Description?.replace(/\s+/g, ' ').trim().replace(/ - NDDOT$/i, '') || `NDDOT Camera ${id}`,
    city: site?.properties?.Region?.trim() || 'North Dakota',
    country: 'US',
    feed_url: still.href,
    stream_type: 'jpg',
    source: 'NDDOT',
  };
}

export async function fetchNddotCameras(): Promise<CctvCamera[]> {
  const res = await fetch(API, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`NDDOT cameras HTTP ${res.status}`);

  const json = await res.json();
  if (!Array.isArray(json?.features)) throw new Error('NDDOT cameras: no features in response');

  const seen = new Map<string, CctvCamera>();
  for (const site of json.features as NddotSite[]) {
    for (const view of site?.properties?.Cameras ?? []) {
      const cam = mapNddotCamera(site, view);
      if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
    }
  }
  if (seen.size < MIN_CAMERAS) throw new Error(`NDDOT cameras short read: ${seen.size}`);
  console.log(`[TAKIP] North Dakota cameras — NDDOT: ${seen.size}`);
  return [...seen.values()];
}
