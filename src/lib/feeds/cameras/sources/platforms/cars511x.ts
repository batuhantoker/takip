import type { CctvCamera } from '@/lib/feeds/cameras/types';
import { snapshotUrl, type Bounds } from './cars';

/**
 * TAKIP — Castle Rock's 511x platform, the stack that replaced CARS GraphQL (./cars) on 511NY and COtrip.
 * A deployment's `configs/main.json` names its API (`https://api-511x-<client>.carsprogram.org`), and every
 * camera comes back from one unpaged GeoJSON call to `/cameras/map-features`.
 */

const UA = 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)';

export interface Cars511xSource {
  /** e.g. `https://api-511x-nysdot.carsprogram.org` */
  api: string;
  idPrefix: string;
  source: string;
  state: string;
  bounds: Bounds;
  /** `cameraOwner` values another source carries from the operator's own feed. */
  excludeOwners?: string[];
}

export interface Cars511xView {
  /** `WMP` is an HLS `url` with a `videoPreviewUrl` still; `STILL_IMAGE` is a still `url`. */
  type?: string | null;
  url?: string | null;
  videoPreviewUrl?: string | null;
  broken?: boolean | null;
}

export interface Cars511xFeature {
  geometry?: { coordinates?: number[] | null } | null;
  properties?: {
    id?: number | null;
    name?: string | null;
    public?: boolean | null;
    cameraOwner?: string | null;
    views?: Cars511xView[] | null;
  } | null;
}

function hlsUrl(raw: string | null | undefined): string | undefined {
  try {
    const url = new URL(raw ?? '');
    return url.protocol === 'https:' && /\.m3u8$/i.test(url.pathname) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function viewMedia(v: Cars511xView | null | undefined): { feed?: string; hls?: string } | null {
  if (!v || v.broken) return null;
  if (v.type === 'WMP') {
    const hls = hlsUrl(v.url);
    const feed = snapshotUrl(v.videoPreviewUrl) ?? undefined;
    return hls || feed ? { hls, feed } : null;
  }
  if (v.type === 'STILL_IMAGE') {
    const feed = snapshotUrl(v.url);
    return feed ? { feed } : null;
  }
  return null;
}

export function mapCars511xFeature(f: Cars511xFeature | null | undefined, cfg: Cars511xSource): CctvCamera | null {
  const p = f?.properties;
  if (!p || !Number.isInteger(p.id) || p.public === false) return null;
  if (p.cameraOwner && cfg.excludeOwners?.includes(p.cameraOwner)) return null;

  const lng = Number(f?.geometry?.coordinates?.[0]);
  const lat = Number(f?.geometry?.coordinates?.[1]);
  const b = cfg.bounds;
  if (!(lat > b.minLat && lat < b.maxLat && lng > b.minLng && lng < b.maxLng)) return null;

  let media: { feed?: string; hls?: string } | null = null;
  for (const v of p.views ?? []) if ((media = viewMedia(v))) break;
  if (!media) return null;

  return {
    id: `${cfg.idPrefix}-${p.id}`,
    lat,
    lng,
    name: p.name?.replace(/\s+/g, ' ').trim() || `${cfg.source} Camera ${p.id}`,
    city: cfg.state,
    country: 'US',
    ...(media.feed ? { feed_url: media.feed } : {}),
    ...(media.hls ? { stream_url: media.hls, stream_type: 'hls' as const } : { stream_type: 'jpg' as const }),
    source: cfg.source,
  };
}

export async function loadCars511xCameras(cfg: Cars511xSource): Promise<CctvCamera[]> {
  const res = await fetch(`${cfg.api}/cameras/map-features`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`${cfg.source} cameras HTTP ${res.status}`);

  const json = await res.json();
  if (!Array.isArray(json?.features)) throw new Error(`${cfg.source} cameras: no features in response`);

  const seen = new Map<string, CctvCamera>();
  for (const f of json.features) {
    const cam = mapCars511xFeature(f, cfg);
    if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
  }
  console.log(`[TAKIP] ${cfg.source} cameras: ${seen.size} of ${json.features.length}`);
  return [...seen.values()];
}
