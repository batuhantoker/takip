import type { CctvCamera } from '@/lib/feeds/cameras/types';
import type { Bounds } from '@/lib/feeds/cameras/sources/platforms/cars';
import { markMissingMedia } from '@/lib/feeds/cameras/liveness';

/**
 * TAKIP — Uçhisar Belediyesi's live cameras: the Wowza channels its "Uçhisar Canlı Kamera" pages play in Clappr.
 * There is no list to read, so the channels are listed here; a channel that isn't running answers 404 and shows as
 * off air. CORS reflects the request's Origin on the playlist, chunklist and segments (checked 2026-10-19).
 * The "Vadi" page's channel (uchisar2) is left out: it was off air when added, so its view, and so its place, is unknown.
 */

const STREAMS = 'https://player.rade.com.tr/live';
const SITE = 'https://www.uchisar.bel.tr';
export const UCHISAR_BOUNDS: Bounds = { minLat: 38.6, maxLat: 38.66, minLng: 34.77, maxLng: 34.84 };

export interface UchisarChannel { stream: string; name: string; page: string; lat: number; lng: number }

export const UCHISAR_CHANNELS: UchisarChannel[] = [
  // The stream shows the town-centre roundabout (OSM way 1516994679).
  { stream: 'uchisar1', name: 'Uçhisar Merkez', page: 'uchisar-canli-kamera-merkez', lat: 38.62824, lng: 34.80361 },
];

export function mapUchisarChannel(ch: UchisarChannel): CctvCamera | null {
  const b = UCHISAR_BOUNDS;
  if (!/^[a-z0-9]+$/.test(ch.stream) || !/^[a-z0-9-]+$/.test(ch.page)) return null;
  if (!(ch.lat > b.minLat && ch.lat < b.maxLat && ch.lng > b.minLng && ch.lng < b.maxLng)) return null;
  return {
    id: `tr-uchisar-${ch.stream}`,
    lat: ch.lat,
    lng: ch.lng,
    name: ch.name,
    city: 'Uçhisar',
    country: 'Turkey',
    stream_url: `${STREAMS}/${ch.stream}.stream/playlist.m3u8`,
    stream_type: 'hls',
    external_url: `${SITE}/${ch.page}/`,
    source: 'Uçhisar Belediyesi',
  };
}

export function fetchUchisarCameras(): Promise<CctvCamera[]> {
  return markMissingMedia(UCHISAR_CHANNELS.flatMap(ch => mapUchisarChannel(ch) ?? []));
}
