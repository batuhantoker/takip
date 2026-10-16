import type { CctvCamera } from '@/lib/feeds/cameras/types';
import type { Bounds } from '@/lib/feeds/cameras/sources/platforms/cars';
import { markMissingMedia } from '@/lib/feeds/cameras/liveness';

/**
 * TAKIP — Çambaşı Kayak Merkezi (Kabadüz, Ordu) cameras: the grid of ORBEL A.Ş. (Ordu Büyükşehir) Restreamer channels
 * that the resort's own live page, cambasidoga.com/m/live-1, embeds. Each channel is a CORS-open HLS stream plus a still.
 * Terms: the licence set on each Restreamer channel — CC BY 4.0, except channel 1 which is CC BY-NC 4.0.
 * No coordinates upstream: every channel is pinned at the ski centre (OSM "Çambaşı Kayak Merkezi").
 */

const GRID = 'https://live.owwo.com.tr/';
const BROADCAST = 'https://broadcast.orbel.com.tr';
const LIVE_PAGE = 'https://cambasidoga.com/m/live-1';
const UA = 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)';
export const CAMBASI_BOUNDS: Bounds = { minLat: 40.58, maxLat: 40.68, minLng: 37.88, maxLng: 38.0 };
const RESORT = { lat: 40.6294087, lng: 37.9360227 };

const CHANNEL = /https:\/\/broadcast\.orbel\.com\.tr\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.html/gi;

/** Restreamer channel ids, in the grid's order. */
export function parseCambasiGrid(html: string): string[] {
  return [...new Set([...html.matchAll(CHANNEL)].map(m => m[1].toLowerCase()))];
}

export interface RestreamerOembed {
  title?: string | null;
  license?: string | null;
}

export function mapCambasiChannel(id: string, index: number, oembed?: RestreamerOembed | null): CctvCamera | null {
  if (!/^[0-9a-f-]{36}$/.test(id) || !Number.isInteger(index) || index < 0) return null;

  const lat = RESORT.lat;
  // Spread ~35 m apart so the channels don't stack on one pin.
  const lng = RESORT.lng + index * 0.0004;
  const b = CAMBASI_BOUNDS;
  if (!(lat > b.minLat && lat < b.maxLat && lng > b.minLng && lng < b.maxLng)) return null;

  return {
    id: `tr-cambasi-${id}`,
    lat,
    lng,
    name: oembed?.title?.replace(/\s+/g, ' ').trim() || `Çambaşı ${index + 1}`,
    city: 'Ordu',
    country: 'Turkey',
    feed_url: `${BROADCAST}/memfs/${id}.jpg`,
    // The variant playlist carries a per-viewer ?session= that hls.js follows; nothing is signed.
    stream_url: `${BROADCAST}/memfs/${id}.m3u8`,
    stream_type: 'hls',
    external_url: LIVE_PAGE,
    source: 'Çambaşı Doğa Tesisleri (ORBEL A.Ş.)',
  };
}

async function fetchOembed(id: string): Promise<RestreamerOembed | null> {
  const res = await fetch(`${BROADCAST}/channels/${id}/oembed.json`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(8_000),
  });
  return res.ok ? ((await res.json()) as RestreamerOembed) : null;
}

export async function fetchCambasiCameras(): Promise<CctvCamera[]> {
  const res = await fetch(GRID, {
    headers: { 'User-Agent': UA, Accept: 'text/html' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Çambaşı grid HTTP ${res.status}`);

  const ids = parseCambasiGrid(await res.text());
  if (!ids.length) throw new Error('Çambaşı grid: no Restreamer channels in the page');

  // Titles only; a channel whose oEmbed fails still plays under a numbered name.
  const meta = await Promise.all(ids.map(id => fetchOembed(id).catch(() => null)));
  // The grid keeps listing channels that aren't running.
  const cams = await markMissingMedia(ids.flatMap((id, i) => mapCambasiChannel(id, i, meta[i]) ?? []));
  console.log(`[TAKIP] Çambaşı cameras — ORBEL: ${cams.length}`);
  return cams;
}
