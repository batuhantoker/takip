import type { CctvCamera } from '@/lib/feeds/cameras/types';
import type { Bounds } from '@/lib/feeds/cameras/sources/platforms/cars';

/**
 * TAKIP — Oklahoma DOT cameras (~456): OKTraffic's camera poles, no key. Live HLS only, no stills.
 * Terms: "for transportation purposes only, unless otherwise approved" (oktraffic.org website policy).
 */

const FILTER = {
  include: [{
    relation: 'mapCameras',
    scope: {
      include: 'streamDictionary',
      where: { status: { neq: 'Out Of Service' }, type: 'Web', blockAtis: { neq: '1' } },
    },
  }],
};
const API = `https://oktraffic.org/api/CameraPoles?filter=${encodeURIComponent(JSON.stringify(FILTER))}`;
const UA = 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)';
const STREAM_HOST = 'stream.oktraffic.org';
export const OKTRAFFIC_BOUNDS: Bounds = { minLat: 33.6, maxLat: 37.1, minLng: -103.1, maxLng: -94.4 };

export interface OkTrafficCamera {
  id?: number | null;
  /** Strings, e.g. `"35.39637"`. */
  latitude?: string | number | null;
  longitude?: string | number | null;
  location?: string | null;
  city?: string | null;
  direction?: string | null;
  type?: string | null;
  /** `Free`, `Construction`, `Out Of Service`, … */
  status?: string | null;
  /** A string, `"0"` / `"1"`. */
  blockAtis?: string | null;
  streamDictionary?: { streamSrc?: string | null } | null;
}

export interface OkTrafficPole {
  name?: string | null;
  mapCameras?: (OkTrafficCamera | null)[] | null;
}

// 'POE' is a port of entry, not a city.
const CITY_FIX: Record<string, string> = { OKC: 'Oklahoma City', 'OKLAHOMA CITY': 'Oklahoma City', KAY: 'Kay County', 'N/A': '', POE: '' };

const clean = (s: string | null | undefined) => s?.replace(/\s+/g, ' ').trim() ?? '';

export function cityName(raw: string | null | undefined): string {
  const city = clean(raw);
  const fixed = Object.hasOwn(CITY_FIX, city.toUpperCase()) ? CITY_FIX[city.toUpperCase()] : city;
  return fixed || 'Oklahoma';
}

export function mapOkTrafficCamera(c: OkTrafficCamera | null | undefined, poleName?: string | null): CctvCamera | null {
  // The server returns non-public cameras unless filtered, so check again; Construction playlists 404.
  if (c?.type !== 'Web' || c.blockAtis !== '0' || c.status !== 'Free') return null;
  const id = c.id;
  if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) return null;

  const lat = Number(c.latitude);
  const lng = Number(c.longitude);
  const b = OKTRAFFIC_BOUNDS;
  if (!(lat > b.minLat && lat < b.maxLat && lng > b.minLng && lng < b.maxLng)) return null;

  let stream: URL;
  try {
    stream = new URL(c.streamDictionary?.streamSrc ?? '');
  } catch {
    return null;
  }
  if (stream.protocol !== 'https:' || stream.host !== STREAM_HOST) return null;

  return {
    id: `okdot-${id}`,
    lat,
    lng,
    name: clean(c.location) || clean(`${poleName ?? ''} ${c.direction ?? ''}`) || `ODOT Camera ${id}`,
    city: cityName(c.city),
    country: 'US',
    stream_url: stream.href,
    stream_type: 'hls',
    source: 'ODOT Oklahoma',
  };
}

export async function fetchOkTrafficCameras(): Promise<CctvCamera[]> {
  const res = await fetch(API, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`OKTraffic cameras HTTP ${res.status}`);

  // A Cloudflare challenge page would fail to parse here.
  const json = await res.json().catch(() => null);
  if (!Array.isArray(json)) throw new Error('OKTraffic cameras: unexpected response');

  const seen = new Map<string, CctvCamera>();
  let listed = 0;
  for (const pole of json as (OkTrafficPole | null)[]) {
    const rows = pole?.mapCameras;
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      listed++;
      const cam = mapOkTrafficCamera(row, pole?.name);
      if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
    }
  }
  if (!seen.size) throw new Error(`OKTraffic cameras: none usable of ${listed}`);
  console.log(`[TAKIP] Oklahoma cameras — ODOT: ${seen.size} of ${listed}`);
  return [...seen.values()];
}
