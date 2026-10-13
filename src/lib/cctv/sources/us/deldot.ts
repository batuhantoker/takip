import type { CctvCamera } from '@/lib/cctv/types';
import type { Bounds } from '@/lib/cctv/sources/platforms/cars';
import { stealthFetch } from '@/lib/stealthFetch';

/**
 * TAKIP — Delaware DOT cameras (~355): the TMC's public camera list, no key. Live HLS only, no stills.
 * Terms: DelDOT public TMC feed; no licence stated in the feed (deldot.gov's WAF blocks reading its policy pages).
 */

const API = 'https://tmc.deldot.gov/json/videocamera.json';
export const DELDOT_BOUNDS: Bounds = { minLat: 38.4, maxLat: 39.9, minLng: -75.8, maxLng: -75.0 };

export interface DeldotCamera {
  id?: string | null;
  title?: string | null;
  county?: string | null;
  lat?: number | null;
  lon?: number | null;
  enabled?: boolean | null;
  /** `Active` or `Unavailable`. */
  status?: string | null;
  urls?: { m3u8s?: string | null } | null;
}

export function mapDeldotCamera(r: DeldotCamera | null | undefined): CctvCamera | null {
  // Dropped-rows test: Unavailable/disabled cameras are kept; a valid https stream is still required below.
  if (!r) return null;
  const id = r.id?.trim();
  if (!id || !/^[A-Z]+\d+$/i.test(id)) return null;

  const lat = Number(r.lat);
  const lng = Number(r.lon);
  const b = DELDOT_BOUNDS;
  if (!(lat > b.minLat && lat < b.maxLat && lng > b.minLng && lng < b.maxLng)) return null;

  let stream: URL;
  try {
    stream = new URL(r.urls?.m3u8s ?? '');
  } catch {
    return null;
  }
  if (stream.protocol !== 'https:') return null;

  return {
    id: `deldot-${id}`,
    lat,
    lng,
    name: r.title?.replace(/\s+/g, ' ').trim() || `DelDOT Camera ${id}`,
    city: r.county?.trim() ? `${r.county.trim()} County` : 'Delaware',
    country: 'US',
    stream_url: stream.href,
    stream_type: 'hls',
    source: 'DelDOT',
  };
}

export async function fetchDeldotCameras(): Promise<CctvCamera[]> {
  const res = await stealthFetch(API, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`DelDOT cameras HTTP ${res.status}`);

  const json = await res.json();
  if (!Array.isArray(json?.videoCameras)) throw new Error('DelDOT cameras: no videoCameras in response');

  const seen = new Map<string, CctvCamera>();
  for (const row of json.videoCameras) {
    const cam = mapDeldotCamera(row);
    if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
  }
  console.log(`[TAKIP] Delaware cameras — DelDOT: ${seen.size}`);
  return [...seen.values()];
}
