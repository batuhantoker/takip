import { http2Request } from '@/lib/core/net/http2';
import type { CctvCamera } from '@/lib/feeds/cameras/types';
import type { Bounds } from '@/lib/feeds/cameras/sources/platforms/cars';

/**
 * TAKIP — Puerto Rico ITS cameras (~42) from the Autoridad de Carreteras y Transportación's its.act.pr.gov, no key.
 * No licence stated; permission not yet asked. Read over HTTP/2 because the host's HTTP/1.1 headers break undici.
 */

const BASE = 'https://its.act.pr.gov';
const UA = 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)';
export const ACT_PR_BOUNDS: Bounds = { minLat: 17.8, maxLat: 18.6, minLng: -67.4, maxLng: -65.2 };

export interface ActPrCamera {
  Id?: number | null;
  Name?: string | null;
  LocationEn?: string | null;
  LocationEs?: string | null;
  Latitude?: number | null;
  Longitude?: number | null;
  ImageUrl?: string | null;
}

const IMAGE = /^\/images\/cameras\/[\w.-]+\.jpe?g$/i;

export function mapActPrCamera(c: ActPrCamera | null | undefined): CctvCamera | null {
  if (c?.Id == null || !Number.isInteger(c.Id)) return null;
  const image = c.ImageUrl?.trim() ?? '';
  if (!IMAGE.test(image)) return null;
  const lat = Number(c.Latitude);
  const lng = Number(c.Longitude);
  const b = ACT_PR_BOUNDS;
  if (!(lat > b.minLat && lat < b.maxLat && lng > b.minLng && lng < b.maxLng)) return null;

  // Some rows repeat the device code as the location; prefer a real place name.
  const name = [c.LocationEs, c.LocationEn].map(s => s?.trim()).find(s => s && s !== c.Name?.trim());
  return {
    id: `actpr-${c.Id}`,
    lat,
    lng,
    name: name || c.Name?.trim() || `ACT Camera ${c.Id}`,
    city: 'Puerto Rico',
    country: 'Puerto Rico',
    feed_url: `${BASE}${image}`,
    stream_type: 'jpg',
    external_url: `${BASE}/es/`,
    source: 'ACT Puerto Rico',
  };
}

export async function fetchActPrCameras(): Promise<CctvCamera[]> {
  const res = await http2Request(`${BASE}/es/Default.aspx/GetCctv`, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8', 'user-agent': UA, accept: 'application/json' },
    body: '{}',
    timeoutMs: 12_000,
  });
  if (res.status !== 200) throw new Error(`ACT Puerto Rico cameras HTTP ${res.status}`);
  // ASP.NET page methods wrap the answer in `d`.
  const rows = (JSON.parse(res.body) as { d?: { Success?: boolean; Cctv?: unknown } })?.d;
  if (!rows?.Success || !Array.isArray(rows.Cctv)) throw new Error('ACT Puerto Rico cameras: unexpected response');

  const seen = new Map<string, CctvCamera>();
  for (const row of rows.Cctv) {
    const cam = mapActPrCamera(row as ActPrCamera);
    if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
  }
  return [...seen.values()];
}
