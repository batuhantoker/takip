import type { CctvCamera } from '@/lib/cctv/types';
import { stealthFetch } from '@/lib/stealthFetch';

/**
 * TAKIP — Daegu traffic cameras (~186): the keyless list behind car.daegu.go.kr's map,
 * each with a CORS-open HLS stream on carcctv.daegu.go.kr.
 * Terms: pending — the feed carries no KOGL mark, and Daegu's copyright policy asks for prior
 * consultation before reusing unmarked works.
 */

const API = 'https://car.daegu.go.kr/map/ajax/getCCTVList/';
/** `04` is the map's CCTV layer; it also returns a few `05` rows, which are cameras too. */
const QUERY = 'fac_typ_cd=04';
const MAP_PAGE = 'https://car.daegu.go.kr/';

export const DAEGU_BOUNDS = { minLat: 35.55, maxLat: 36.35, minLng: 128.3, maxLng: 128.95 };

export interface DaeguCamera {
  facTypCd?: string | null;
  facSn?: number | null;
  facNm?: string | null;
  /** `01` is in service. */
  facStatCd?: string | null;
  useYn?: string | null;
  /** Longitude. */
  coordX?: number | null;
  /** Latitude. */
  coordY?: number | null;
  /** Stream channel number. */
  cctv?: number | null;
}

/** The site's player picks the server by channel range; for 301–375 its live6 line overrides live5. */
export function streamUrl(channel: number): string | null {
  if (!Number.isInteger(channel) || channel <= 0) return null;
  const server = channel <= 75 ? 'live1' : channel <= 150 ? 'live2' : channel <= 255 ? 'live3'
    : channel <= 300 ? 'live4' : channel <= 375 ? 'live6' : null;
  return server ? `https://carcctv.daegu.go.kr/${server}/_definst_/ch${channel}.stream/playlist.m3u8` : null;
}

export function mapDaeguCamera(r: DaeguCamera | null | undefined): CctvCamera | null {
  const type = r?.facTypCd;
  const sn = r?.facSn;
  if (!type || !/^\d{2}$/.test(type) || typeof sn !== 'number' || !Number.isInteger(sn) || sn <= 0) return null;
  if (r?.facStatCd !== '01' || r?.useYn !== 'Y') return null;

  const lat = r?.coordY;
  const lng = r?.coordX;
  const b = DAEGU_BOUNDS;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!(lat > b.minLat && lat < b.maxLat && lng > b.minLng && lng < b.maxLng)) return null;

  const stream = streamUrl(r?.cctv ?? NaN);
  if (!stream) return null;

  // facSn repeats across facTypCd, so both make the id, as in the site's /map/cctvViewer/<type>-<sn>.
  const id = `${type}-${sn}`;
  return {
    id: `kr-daegu-${id}`,
    lat,
    lng,
    name: r?.facNm?.replace(/\s+/g, ' ').trim() || `Daegu Camera ${id}`,
    city: 'Daegu',
    country: 'South Korea',
    stream_url: stream,
    stream_type: 'hls',
    external_url: MAP_PAGE,
    source: 'Daegu Traffic Info',
  };
}

export async function fetchDaeguCameras(): Promise<CctvCamera[]> {
  const res = await stealthFetch(API, {
    method: 'POST',
    body: QUERY,
    signal: AbortSignal.timeout(12000),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Daegu cameras HTTP ${res.status}`);
  const rows = (await res.json())?.result;
  if (!Array.isArray(rows)) throw new Error('Daegu cameras: unexpected response');

  const seen = new Map<string, CctvCamera>();
  for (const r of rows as (DaeguCamera | null)[]) {
    const cam = mapDaeguCamera(r);
    if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
  }
  if (!seen.size) throw new Error('Daegu cameras: no playable cameras in the response');
  console.log(`[TAKIP] Daegu cameras — Daegu Traffic Info: ${seen.size}`);
  return [...seen.values()];
}
