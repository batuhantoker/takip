import type { CctvCamera } from '@/lib/feeds/cameras/types';
import type { Bounds } from '@/lib/feeds/cameras/sources/platforms/cars';
import { stealthFetch } from '@/lib/core/net/stealth-fetch';

/**
 * TAKIP — Hawaii DOT / Honolulu DTS cameras (~336, mostly Oahu): the list goakamai.org's own map loads, no key.
 * Terms: goakamai.org forbids publishing or displaying its content without written permission from HDOT and Honolulu DTS: not yet asked.
 */

const API = 'https://a.cameraservice.goakamai.org/cameras/?format=mapPage';
export const GOAKAMAI_BOUNDS: Bounds = { minLat: 18.8, maxLat: 22.4, minLng: -160.6, maxLng: -154.7 };
/** Its stills are published as http, but the same host serves them over TLS. */
const STILL_HOST = 'cctv.cdn.goakamai.org';

export interface GoAkamaiCamera {
  id?: string | null;
  description?: string | null;
  cameraImageURL?: string | null;
  /** Empty when the camera has no stream. */
  streamingURL?: string | null;
  lat?: number | null;
  lon?: number | null;
}

function stillUrl(raw: string | null | undefined): string | undefined {
  try {
    const url = new URL(raw ?? '');
    if (url.protocol === 'http:' && url.hostname === STILL_HOST) url.protocol = 'https:';
    return url.protocol === 'https:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function hlsUrl(raw: string | null | undefined): string | undefined {
  try {
    const url = new URL(raw ?? '');
    return url.protocol === 'https:' && /\.m3u8$/i.test(url.pathname) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function mapGoAkamaiCamera(r: GoAkamaiCamera | null | undefined): CctvCamera | null {
  const id = r?.id?.trim();
  if (!id || !/^[\w-]+$/.test(id)) return null;

  const lat = Number(r?.lat);
  const lng = Number(r?.lon);
  const b = GOAKAMAI_BOUNDS;
  if (!(lat > b.minLat && lat < b.maxLat && lng > b.minLng && lng < b.maxLng)) return null;

  const feed = stillUrl(r?.cameraImageURL);
  const hls = hlsUrl(r?.streamingURL);
  if (!feed && !hls) return null;

  return {
    id: `hdot-${id}`,
    lat,
    lng,
    name: r?.description?.replace(/\s+/g, ' ').trim() || `HDOT Camera ${id}`,
    city: 'Hawaii',
    country: 'US',
    ...(feed ? { feed_url: feed } : {}),
    ...(hls ? { stream_url: hls, stream_type: 'hls' as const } : { stream_type: 'jpg' as const }),
    source: 'GoAkamai',
  };
}

export async function fetchGoAkamaiCameras(): Promise<CctvCamera[]> {
  const res = await stealthFetch(API, {
    // The service answers 403 without the vendor tag the site's own scripts send, and 500 without its Origin.
    headers: {
      Accept: 'application/json',
      Origin: 'https://goakamai.org',
      'x-icx-copyright': 'ICxTransportationGroup',
      'x-icx-ts': String(Date.now()),
    },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`GoAkamai cameras HTTP ${res.status}`);

  const rows = await res.json();
  if (!Array.isArray(rows)) throw new Error('GoAkamai cameras: unexpected response');

  const seen = new Map<string, CctvCamera>();
  for (const row of rows) {
    const cam = mapGoAkamaiCamera(row);
    if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
  }
  console.log(`[TAKIP] Hawaii cameras — GoAkamai: ${seen.size}`);
  return [...seen.values()];
}
