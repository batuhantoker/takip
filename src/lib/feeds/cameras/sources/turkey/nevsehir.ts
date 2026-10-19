import https from 'node:https';
import tls from 'node:tls';
import type { CctvCamera } from '@/lib/feeds/cameras/types';
import type { Bounds } from '@/lib/feeds/cameras/sources/platforms/cars';
import { SECTIGO_DV_R36_INTERMEDIATE } from './nevsehir-cert';

/**
 * TAKIP — Nevşehir Belediyesi's city cameras: the cards on belsis.nevsehir.bel.tr/kameracanli/canli, which
 * canli.nevsehir.bel.tr frames. Each card carries a stream key; its player opens `/hls/live/<key>/index.m3u8` on a
 * Node-Media-Server (CORS `*`). A key with no publisher answers 404 and shows as off air, as all four did on 2026-10-19.
 * No coordinates upstream: cameras are placed by name below, and a name that isn't is left out, never guessed.
 */

const PAGE = 'https://belsis.nevsehir.bel.tr/kameracanli/canli';
const HLS = 'https://belsis.nevsehir.bel.tr/hls/live';
const SITE = 'https://canli.nevsehir.bel.tr/';
const UA = 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)';
const MAX_BYTES = 2 * 1024 * 1024;
export const NEVSEHIR_BOUNDS: Bounds = { minLat: 38.58, maxLat: 38.67, minLng: 34.66, maxLng: 34.76 };

// "Meydan" is unplaced: the city doesn't say which square it is.
const PLACES: { name: RegExp; lat: number; lng: number }[] = [
  // Kayaşehir underground city (OSM way 1558824637).
  { name: /^kayaşehir\b/i, lat: 38.62028, lng: 34.71445 },
];

const CARD = /data-key="([A-Za-z0-9]{8,64})"\s+data-name="([^"]*)"/g;

const decode = (s: string) => s
  .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ').trim();

export interface NevsehirCard { key: string; name: string }

export function parseNevsehirCards(html: string): NevsehirCard[] {
  const seen = new Set<string>();
  const cards: NevsehirCard[] = [];
  for (const [, key, name] of html.matchAll(CARD)) {
    if (seen.has(key)) continue;
    seen.add(key);
    cards.push({ key, name: decode(name) });
  }
  return cards;
}

const placeOf = (name: string) => PLACES.findIndex(p => p.name.test(name));

/** `nth` spreads cameras that share a place ~35 m apart, so they don't stack on one pin. */
export function mapNevsehirCard(card: NevsehirCard, nth = 0): CctvCamera | null {
  const at = PLACES[placeOf(card.name)];
  if (!at || !/^[A-Za-z0-9]{8,64}$/.test(card.key) || !Number.isInteger(nth) || nth < 0) return null;
  const lat = at.lat;
  const lng = at.lng + nth * 0.0004;
  const b = NEVSEHIR_BOUNDS;
  if (!(lat > b.minLat && lat < b.maxLat && lng > b.minLng && lng < b.maxLng)) return null;
  return {
    id: `tr-nevsehir-${card.key}`,
    lat,
    lng,
    name: card.name || `Nevşehir ${card.key}`,
    city: 'Nevşehir',
    country: 'Turkey',
    stream_url: `${HLS}/${card.key}/index.m3u8`,
    stream_type: 'hls',
    external_url: SITE,
    source: 'Nevşehir Belediyesi',
  };
}

/** Cards in page order, numbered within each place. */
export function mapNevsehirCards(cards: NevsehirCard[]): CctvCamera[] {
  const used = new Map<number, number>();
  return cards.flatMap(card => {
    const place = placeOf(card.name);
    const nth = used.get(place) ?? 0;
    used.set(place, nth + 1);
    return mapNevsehirCard(card, nth) ?? [];
  });
}

export type NevsehirGet = (url: string, method: 'GET' | 'HEAD') => Promise<{ status: number; body: string }>;

// The host omits its intermediate certificate, which browsers fetch for themselves and Node's fetch does not.
const agent = new https.Agent({ ca: [...tls.rootCertificates, SECTIGO_DV_R36_INTERMEDIATE] });

const httpsGet: NevsehirGet = (url, method) => new Promise((resolve, reject) => {
  const req = https.request(url, { method, agent, timeout: 10_000, headers: { 'User-Agent': UA, Accept: '*/*' } }, res => {
    const chunks: Buffer[] = [];
    let size = 0;
    res.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BYTES) req.destroy(new Error('Nevşehir response too large'));
      else chunks.push(chunk);
    });
    res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') }));
    res.on('error', reject);
  });
  req.on('error', reject);
  req.on('timeout', () => req.destroy(new Error('Timeout')));
  req.end();
});

export async function loadNevsehirCameras(get: NevsehirGet): Promise<CctvCamera[]> {
  const page = await get(PAGE, 'GET');
  if (page.status !== 200) throw new Error(`Nevşehir cameras HTTP ${page.status}`);
  const cards = parseNevsehirCards(page.body);
  if (!cards.length) throw new Error('Nevşehir cameras: no camera cards in the page');

  const cams = mapNevsehirCards(cards);
  console.log(`[TAKIP] Nevşehir cameras — ${cams.length} placed, ${cards.length - cams.length} unplaced`);
  if (!cams.length) throw new Error('Nevşehir cameras: none of the listed cameras is placed');

  // Only a definite 404 flags a camera; no answer leaves it as listed.
  return Promise.all(cams.map(async cam => {
    const status = await get(cam.stream_url!, 'HEAD').then(r => r.status, () => 0);
    return status === 404 ? { ...cam, offline: true } : cam;
  }));
}

export const fetchNevsehirCameras = () => loadNevsehirCameras(httpsGet);
