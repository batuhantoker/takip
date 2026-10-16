import type { CctvCamera } from '@/lib/feeds/cameras/types';
import { stealthFetch } from '@/lib/core/net/stealth-fetch';

/**
 * TAKIP — Seoul TOPIS traffic cameras (~497 HLS streams), no key.
 * Terms: none published for the feed; topis.seoul.go.kr reserves its content to the Seoul Metropolitan Government.
 *
 * The list carries no stream: each camera's playlist comes from a per-camera lookup, so the stream is our
 * own `topis/stream` route, which looks it up when a camera is played and redirects there.
 */

const KML = 'https://topis.seoul.go.kr/map/cctvKml.do';
const INFO = 'https://topis.seoul.go.kr/map/selectCctvInfo.do';
const STREAM_HOSTS = ['eseoul.go.kr', 'spatic.go.kr'];

export const SEOUL_TOPIS_BOUNDS = { minLat: 37.4, maxLat: 37.75, minLng: 126.7, maxLng: 127.25 };

export interface TopisPlacemark {
  code: string;
  name: string;
  lat: number;
  lng: number;
}

export function parseTopisKml(kml: string): TopisPlacemark[] {
  const out: TopisPlacemark[] = [];
  for (const [, body] of kml.matchAll(/<Placemark>([\s\S]*?)<\/Placemark>/g)) {
    if (!/name="layerGubn"><value>CCTV</.test(body)) continue;
    const code = /name="code"><value>([^<]*)</.exec(body)?.[1]?.trim() ?? '';
    const name = /<name>([^<]*)<\/name>/.exec(body)?.[1]?.trim() ?? '';
    const [lng, lat] = (/<coordinates>([^<]*)<\/coordinates>/.exec(body)?.[1] ?? '').split(',').map(Number);
    out.push({ code, name, lat, lng });
  }
  return out;
}

export function mapTopisCamera(p: TopisPlacemark): CctvCamera | null {
  if (!/^\d{1,6}$/.test(p.code) || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return null;
  const b = SEOUL_TOPIS_BOUNDS;
  if (p.lat < b.minLat || p.lat > b.maxLat || p.lng < b.minLng || p.lng > b.maxLng) return null;
  return {
    id: `kr-topis-${p.code}`,
    lat: p.lat,
    lng: p.lng,
    name: p.name || `Seoul camera ${p.code}`,
    city: 'Seoul',
    country: 'South Korea',
    stream_url: `/api/cctv/topis/stream?id=${p.code}`,
    stream_type: 'hls',
    external_url: 'https://topis.seoul.go.kr/',
    source: 'Seoul TOPIS',
  };
}

export async function fetchSeoulTopisCameras(): Promise<CctvCamera[]> {
  const res = await stealthFetch(KML, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`Seoul TOPIS HTTP ${res.status}`);
  const seen = new Map<string, CctvCamera>();
  for (const p of parseTopisKml(await res.text())) {
    const cam = mapTopisCamera(p);
    if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
  }
  console.log(`[TAKIP] Seoul cameras — Seoul TOPIS: ${seen.size}`);
  return [...seen.values()];
}

/** The camera's https playlist from a selectCctvInfo answer, on one of TOPIS's own stream hosts. */
export function parseTopisStream(json: unknown, id: string): string | null {
  const row = (json as { rows?: Record<string, unknown>[] } | null)?.rows?.[0];
  if (!row || String(row.cctvId) !== id) return null;
  for (const candidate of [row.hlsUrl, row.hlsUrlOri]) {
    if (typeof candidate !== 'string') continue;
    try {
      const url = new URL(candidate);
      const host = url.hostname.toLowerCase();
      if (url.protocol === 'https:' && STREAM_HOSTS.some(h => host === h || host.endsWith('.' + h))) return url.href;
    } catch { /* try the next one */ }
  }
  return null;
}

export async function fetchTopisStreamUrl(id: string): Promise<string | null> {
  const res = await stealthFetch(INFO, {
    method: 'POST',
    signal: AbortSignal.timeout(8000),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ camId: id, cctvSourceCd: 'HP' }).toString(),
  });
  if (!res.ok) throw new Error(`Seoul TOPIS stream HTTP ${res.status}`);
  return parseTopisStream(await res.json(), id);
}
