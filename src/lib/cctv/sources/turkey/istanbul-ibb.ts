import type { CctvCamera } from '@/lib/cctv/types';
import type { Bounds } from '@/lib/cctv/sources/platforms/cars';

/**
 * TAKIP — İstanbul Metropolitan Municipality (İBB) traffic cameras (~650): the keyless list behind UYM's public
 * traffic map (uym.ibb.gov.tr/yharita6), each with a CORS-open HLS stream on hls.ibb.gov.tr.
 * Terms: pending — none published for this API; the UYM site reserves all rights to İBB Trafik Müdürlüğü.
 * Every CameraImage.ashx still in the list answers the same "no camera" placeholder, so only the stream is used.
 */

const API = 'https://tkmservices.ibb.gov.tr/web/api/IntensityMap/v1/Camera';
const MAP_PAGE = 'https://uym.ibb.gov.tr/yharita6/';
const UA = 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)';
export const ISTANBUL_IBB_BOUNDS: Bounds = { minLat: 40.7, maxLat: 41.4, minLng: 27.9, maxLng: 29.6 };

export interface IbbCamera {
  ID?: number | null;
  Name?: string | null;
  /** Longitude, as a string. */
  XCoord?: string | null;
  /** Latitude, as a string. */
  YCoord?: string | null;
  /** Empty for picture-only cameras. */
  VideoURL_SSL?: string | null;
  /** Further directions at the same junction, each its own camera. */
  Group?: IbbCamera[] | null;
}

export function mapIbbCamera(r: IbbCamera | null | undefined): CctvCamera | null {
  const id = r?.ID;
  if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) return null;

  const lat = Number(r?.YCoord);
  const lng = Number(r?.XCoord);
  const b = ISTANBUL_IBB_BOUNDS;
  if (!(lat > b.minLat && lat < b.maxLat && lng > b.minLng && lng < b.maxLng)) return null;

  let stream: URL;
  try {
    // A few rows end in a stray ';'; the URL without it plays.
    stream = new URL((r?.VideoURL_SSL ?? '').trim().replace(/;+$/, ''));
  } catch {
    return null;
  }
  if (stream.protocol !== 'https:' || !stream.pathname.endsWith('.m3u8')) return null;

  return {
    id: `tr-ibb-${id}`,
    lat,
    lng,
    // Names are upper-case Turkish; case-folding the dotted İ garbles them.
    name: r?.Name?.replace(/\s+/g, ' ').trim() || `İBB Camera ${id}`,
    city: 'Istanbul',
    country: 'Turkey',
    stream_url: stream.href,
    stream_type: 'hls',
    external_url: MAP_PAGE,
    source: 'İBB',
  };
}

export function parseIbbCameras(rows: unknown): CctvCamera[] {
  if (!Array.isArray(rows)) throw new Error('İBB cameras: unexpected response');
  const seen = new Map<string, CctvCamera>();
  for (const row of rows as (IbbCamera | null)[]) {
    const group = Array.isArray(row?.Group) ? row.Group : [];
    for (const r of [row, ...group]) {
      const cam = mapIbbCamera(r);
      if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
    }
  }
  return [...seen.values()];
}

export async function fetchIstanbulIbbCameras(): Promise<CctvCamera[]> {
  const res = await fetch(API, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`İBB cameras HTTP ${res.status}`);

  const cams = parseIbbCameras(await res.json());
  if (!cams.length) throw new Error('İBB cameras: no playable cameras in the response');
  console.log(`[TAKIP] Istanbul cameras — İBB: ${cams.length}`);
  return cams;
}
