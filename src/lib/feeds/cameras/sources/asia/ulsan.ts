import type { CctvCamera } from '@/lib/feeds/cameras/types';
import { stealthFetch } from '@/lib/core/net/stealth-fetch';

/**
 * TAKIP — Ulsan ITS traffic cameras (~232): the keyless list behind its.ulsan.kr's CCTV map,
 * each with a CORS-open HLS stream on webcctv.its.ulsan.kr:7083.
 * Terms: pending — none published for this API; the site reserves all rights to Ulsan Metropolitan City.
 */

const API = 'https://its.ulsan.kr/mpng/getList.json';
/** The body the site's own map posts; `paging: false` returns every camera in one response. */
const QUERY = { postData: { serviceName: 'cctvService', methodName: 'getGridList', paging: false } };
const MAP_PAGE = 'https://its.ulsan.kr/traffic/cctv.do';
const STREAM_HOST = 'webcctv.its.ulsan.kr';

export const ULSAN_BOUNDS = { minLat: 35.3, maxLat: 35.75, minLng: 128.95, maxLng: 129.5 };

export interface UlsanCamera {
  cdId?: number | null;
  cdNm?: string | null;
  /** Longitude. */
  xCrdn?: number | null;
  /** Latitude. */
  yCrdn?: number | null;
  addr?: string | null;
}

export function mapUlsanCamera(r: UlsanCamera | null | undefined): CctvCamera | null {
  const id = r?.cdId;
  if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) return null;

  const lat = r?.yCrdn;
  const lng = r?.xCrdn;
  const b = ULSAN_BOUNDS;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!(lat > b.minLat && lat < b.maxLat && lng > b.minLng && lng < b.maxLng)) return null;

  let stream: URL;
  try {
    stream = new URL(r?.addr ?? '');
  } catch {
    return null;
  }
  if (stream.protocol !== 'https:' || stream.hostname !== STREAM_HOST || !stream.pathname.endsWith('.m3u8')) return null;

  return {
    id: `kr-ulsan-${id}`,
    lat,
    lng,
    name: r?.cdNm?.replace(/\s+/g, ' ').trim() || `Ulsan Camera ${id}`,
    city: 'Ulsan',
    country: 'South Korea',
    stream_url: stream.href,
    stream_type: 'hls',
    external_url: MAP_PAGE,
    source: 'Ulsan ITS',
  };
}

export async function fetchUlsanCameras(): Promise<CctvCamera[]> {
  const res = await stealthFetch(API, {
    method: 'POST',
    body: JSON.stringify(QUERY),
    signal: AbortSignal.timeout(12000),
    headers: { 'Content-Type': 'application/json; charset=UTF-8', Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Ulsan ITS HTTP ${res.status}`);
  const json = await res.json();
  const rows = json?.rows;
  if (json?.resultCode !== '200' || !Array.isArray(rows)) throw new Error('Ulsan ITS: unexpected response');
  if (typeof json.totalCnt === 'number' && rows.length < json.totalCnt) {
    throw new Error(`Ulsan ITS: short read (${rows.length} of ${json.totalCnt})`);
  }

  const seen = new Map<string, CctvCamera>();
  for (const r of rows as (UlsanCamera | null)[]) {
    const cam = mapUlsanCamera(r);
    if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
  }
  if (!seen.size) throw new Error('Ulsan ITS: no playable cameras in the response');
  console.log(`[TAKIP] Ulsan cameras — Ulsan ITS: ${seen.size}`);
  return [...seen.values()];
}
