import type { CctvCamera } from '@/lib/cctv/types';
import { stealthFetch } from '@/lib/stealthFetch';

/**
 * TAKIP — Busan ITS traffic cameras (~355): the keyless list behind its.busan.go.kr's traffic map,
 * each with a CORS-open HLS stream on its-stream{N}.busan.go.kr:8443.
 * Terms: pending — none published for this API; the site reserves all rights to the Busan
 * Transportation Information Center.
 */

const API = 'https://its.busan.go.kr/api-n/v1/bsits/user/cctvs';
const MAP_PAGE = 'https://its.busan.go.kr/traffic/cctv';
const STREAM_HOST = /^its-stream\d+\.busan\.go\.kr$/;

export const BUSAN_BOUNDS = { minLat: 34.85, maxLat: 35.45, minLng: 128.7, maxLng: 129.35 };

export interface BusanCamera {
  cctvId?: string | null;
  instlPos?: string | null;
  lat?: number | null;
  /** Longitude. */
  lot?: number | null;
  hlsAddr?: string | null;
}

export function mapBusanCamera(r: BusanCamera | null | undefined): CctvCamera | null {
  const id = r?.cctvId?.trim();
  if (!id || !/^[\w-]+$/.test(id)) return null;

  const lat = r?.lat;
  const lng = r?.lot;
  const b = BUSAN_BOUNDS;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!(lat > b.minLat && lat < b.maxLat && lng > b.minLng && lng < b.maxLng)) return null;

  let stream: URL;
  try {
    stream = new URL(r?.hlsAddr ?? '');
  } catch {
    return null;
  }
  if (stream.protocol !== 'https:' || !STREAM_HOST.test(stream.hostname) || !stream.pathname.endsWith('.m3u8')) return null;

  return {
    id: `kr-busan-${id}`,
    lat,
    lng,
    name: r?.instlPos?.replace(/\s+/g, ' ').trim() || `Busan Camera ${id}`,
    city: 'Busan',
    country: 'South Korea',
    stream_url: stream.href,
    stream_type: 'hls',
    external_url: MAP_PAGE,
    source: 'Busan ITS',
  };
}

export async function fetchBusanCameras(): Promise<CctvCamera[]> {
  const res = await stealthFetch(API, { signal: AbortSignal.timeout(12000), headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Busan ITS HTTP ${res.status}`);
  const rows = await res.json();
  if (!Array.isArray(rows)) throw new Error('Busan ITS: unexpected response');

  const seen = new Map<string, CctvCamera>();
  for (const r of rows as (BusanCamera | null)[]) {
    const cam = mapBusanCamera(r);
    if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
  }
  if (!seen.size) throw new Error('Busan ITS: no playable cameras in the response');
  console.log(`[TAKIP] Busan cameras — Busan ITS: ${seen.size}`);
  return [...seen.values()];
}
