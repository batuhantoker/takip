import type { CctvCamera } from '@/lib/cctv/types';
import type { Bounds } from '@/lib/cctv/sources/platforms/cars';

/**
 * TAKIP — Missouri DOT cameras (~550): the streaming-camera layer behind traveler.modot.org/map, no key. Live HLS
 * only, no stills. Includes the Springfield-area Ozarks Traffic cameras MoDOT carries.
 * Terms: none found on modot.org or the traveler map; attribute MoDOT.
 * KC Scout rows (`traveler.modot.org/tisvc/…/CameraStream/…`) redirect to Referer-gated, tokenized Wowza URLs, so
 * they are dropped; ./kcscout carries their stills.
 */

const API = 'https://traveler.modot.org/timconfig/feed/desktop/StreamingCams2.json';
const UA = 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)';
export const MODOT_BOUNDS: Bounds = { minLat: 35.95, maxLat: 40.65, minLng: -95.8, maxLng: -89.05 };

export interface ModotCamera {
  location?: string | null;
  x?: number | null;
  y?: number | null;
  /** The HLS playlist, despite the name. */
  html?: string | null;
}

const MODOT_HOST = /^sfs\d+-traveler\.modot\.mo\.gov$/;
const OZARKS_HOST = 's2.ozarkstrafficoneview.com';

/** The playlist and the stream name in its `/rtplive/<name>/` path, which is the only stable id the feed has. */
export function modotStream(raw: string | null | undefined): { url: string; name: string; ozarks: boolean } | null {
  let url: URL;
  try {
    url = new URL(raw?.trim() ?? '');
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  const ozarks = url.hostname === OZARKS_HOST;
  if (!ozarks && !MODOT_HOST.test(url.hostname)) return null;
  const m = url.pathname.match(/^\/rtplive\/([\w-]+)\/playlist\.m3u8$/);
  if (!m) return null;
  return { url: url.href, name: m[1], ozarks };
}

export function mapModotCamera(r: ModotCamera | null | undefined): CctvCamera | null {
  if (!r) return null;
  const stream = modotStream(r.html);
  if (!stream) return null;

  const lat = Number(r.y);
  const lng = Number(r.x);
  const b = MODOT_BOUNDS;
  if (!(lat > b.minLat && lat < b.maxLat && lng > b.minLng && lng < b.maxLng)) return null;

  const source = stream.ozarks ? 'Ozarks Traffic' : 'MoDOT';
  return {
    id: `modot-${stream.name}`,
    lat,
    lng,
    name: r.location?.replace(/\s+/g, ' ').trim() || `${source} Camera ${stream.name}`,
    city: stream.ozarks ? 'Springfield area' : 'Missouri',
    country: 'US',
    stream_url: stream.url,
    stream_type: 'hls',
    source,
  };
}

export async function fetchModotCameras(): Promise<CctvCamera[]> {
  const res = await fetch(API, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`MoDOT cameras HTTP ${res.status}`);

  const json = await res.json();
  if (!Array.isArray(json)) throw new Error('MoDOT cameras: unexpected response');

  const seen = new Map<string, CctvCamera>();
  for (const row of json) {
    const cam = mapModotCamera(row);
    if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
  }
  if (seen.size < 330) throw new Error(`MoDOT cameras short read: ${seen.size} of ${json.length}`);
  console.log(`[TAKIP] Missouri cameras — MoDOT: ${seen.size} of ${json.length}`);
  return [...seen.values()];
}
