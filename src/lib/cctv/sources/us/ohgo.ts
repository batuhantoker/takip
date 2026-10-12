import type { CctvCamera } from '@/lib/cctv/types';
import type { Bounds } from '@/lib/cctv/sources/platforms/cars';
import { stealthFetch } from '@/lib/stealthFetch';

/**
 * TAKIP — Ohio DOT cameras (~1,120): the keyless camera list ohgo.com's own map loads from api.ohgo.com.
 * Terms: ODOT states OHGO data is public domain; its documented API (publicapi.ohgo.com) asks for a free key, this feed does not.
 */

const API = 'https://api.ohgo.com/cameras';
export const OHGO_BOUNDS: Bounds = { minLat: 38.4, maxLat: 42.0, minLng: -84.9, maxLng: -80.5 };

/** kentucky.ts carries the KYTC cameras OHGO lists around Cincinnati and the river crossings. */
const COVERED_ELSEWHERE = ['trimarc.org'];

export interface OhgoSite {
  Id?: string | null;
  Latitude?: number | null;
  Longitude?: number | null;
  Location?: string | null;
  Description?: string | null;
  Cameras?: { Direction?: string | null; SmallURL?: string | null; LargeURL?: string | null }[] | null;
}

function stillUrl(raw: string | null | undefined): string | null {
  let url: URL;
  try {
    url = new URL(raw ?? '');
  } catch {
    return null;
  }
  // The site's own check for a camera with no picture.
  if (url.protocol !== 'https:' || url.pathname.endsWith('/blank.jpg')) return null;
  const host = url.hostname.toLowerCase();
  if (COVERED_ELSEWHERE.some(h => host === h || host.endsWith('.' + h))) return null;
  return url.href;
}

export function mapOhgoCamera(site: OhgoSite | null | undefined): CctvCamera | null {
  const rawId = site?.Id?.trim();
  if (!rawId || !/^[\w-]+$/.test(rawId)) return null;
  const id = rawId.replace(/^0+(?=\d)/, '');

  const lat = Number(site?.Latitude);
  const lng = Number(site?.Longitude);
  const b = OHGO_BOUNDS;
  if (!(lat > b.minLat && lat < b.maxLat && lng > b.minLng && lng < b.maxLng)) return null;

  // A multi-view site lists its quad first.
  const view = site?.Cameras?.[0];
  const feed = stillUrl(view?.LargeURL || view?.SmallURL);
  if (!feed) return null;

  return {
    id: `ohgo-${id}`,
    lat,
    lng,
    name: (site?.Location || site?.Description)?.trim() || `ODOT Camera ${id}`,
    city: 'Ohio',
    country: 'US',
    feed_url: feed,
    stream_type: 'jpg',
    source: 'ODOT OHGO',
  };
}

export async function fetchOhgoCameras(): Promise<CctvCamera[]> {
  const res = await stealthFetch(API, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`OHGO cameras HTTP ${res.status}`);

  const json = await res.json();
  const rows = json?.d ?? json;
  if (!Array.isArray(rows)) throw new Error('OHGO cameras: unexpected response');

  const seen = new Map<string, CctvCamera>();
  for (const row of rows) {
    const cam = mapOhgoCamera(row);
    if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
  }
  console.log(`[TAKIP] Ohio cameras — ODOT OHGO: ${seen.size}`);
  return [...seen.values()];
}
