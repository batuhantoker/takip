import type { CctvCamera } from '@/lib/cctv/types';
import type { Bounds } from '@/lib/cctv/sources/platforms/cars';

/**
 * TAKIP — BIHAMK (Bosnia and Herzegovina auto club) road and border cameras (~15) from bihamk.ba/spi/kamere, no key.
 * No licence stated; permission not yet asked. The portal has no coordinates, so cameras are placed from the
 * gazetteer below; unplaced ones (Prisika, RICO Tuzla) are left out rather than guessed.
 */

const PAGE = 'https://bihamk.ba/spi/kamere';
const IMAGES = 'https://video-nadzor.bihamk.ba/videosurveillence/';
const UA = 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)';
export const BIHAMK_BOUNDS: Bounds = { minLat: 42.5, maxLat: 45.3, minLng: 15.7, maxLng: 19.7 };

/**
 * Keyed by the portal's image name ("videosurveillence" is its spelling). Border crossings are OSM
 * barrier=border_control nodes; the rest are OSM place/pass points within a few hundred metres (2026-10-12).
 */
export const BIHAMK_PLACES: Record<string, { lat: number; lng: number; city: string }> = {
  BIJACA: { lat: 43.12323, lng: 17.57493, city: 'Ljubuški' },
  BROD1: { lat: 45.14622, lng: 18.00591, city: 'Brod' },
  BROD2: { lat: 45.14622, lng: 18.00591, city: 'Brod' },
  CRVENIGRM: { lat: 43.16154, lng: 17.47845, city: 'Ljubuški' },
  DOLJANI: { lat: 43.05274, lng: 17.67546, city: 'Čapljina' },
  IZACIC: { lat: 44.87515, lng: 15.76401, city: 'Bihać' },
  KAMENSKO: { lat: 43.61122, lng: 16.97605, city: 'Livno' },
  ORASJE: { lat: 45.03128, lng: 18.70221, city: 'Orašje' },
  SEPAK: { lat: 44.54285, lng: 19.18081, city: 'Zvornik' },
  MAKLJEN: { lat: 43.84496, lng: 17.59376, city: 'Prozor-Rama' },
  SKENDERIJA: { lat: 43.85516, lng: 18.41392, city: 'Sarajevo' },
  STUP: { lat: 43.84283, lng: 18.3243, city: 'Sarajevo' },
  BRIJESCE: { lat: 43.8614, lng: 18.3299, city: 'Sarajevo' },
};

export interface BihamkListing { key: string; name: string }

/** Each card: `<img alt="GP Bijača" src="https://video-nadzor.bihamk.ba/videosurveillence/BIJACA.jpg?…">`. */
export function parseBihamkPage(html: string): BihamkListing[] {
  const out = new Map<string, BihamkListing>();
  for (const m of html.matchAll(/<img alt="([^"]*)" src="https:\/\/video-nadzor\.bihamk\.ba\/videosurveillence\/([A-Z0-9_]+)\.jpg[^"]*"/g)) {
    if (!out.has(m[2])) out.set(m[2], { key: m[2], name: m[1].replace(/&amp;/g, '&').trim() });
  }
  return [...out.values()];
}

export function mapBihamkCamera(l: BihamkListing): CctvCamera | null {
  const place = BIHAMK_PLACES[l.key];
  if (!place) return null;
  return {
    id: `bihamk-${l.key.toLowerCase()}`,
    lat: place.lat,
    lng: place.lng,
    // "GP" is granični prijelaz, a border crossing.
    name: l.name.replace(/^GP\s+/, 'Border crossing ') || l.key,
    city: place.city,
    country: 'Bosnia and Herzegovina',
    feed_url: `${IMAGES}${l.key}.jpg`,
    stream_type: 'jpg',
    external_url: PAGE,
    source: 'BIHAMK',
  };
}

export async function fetchBihamkCameras(): Promise<CctvCamera[]> {
  const res = await fetch(PAGE, { headers: { 'User-Agent': UA, Accept: 'text/html' }, signal: AbortSignal.timeout(12_000) });
  if (!res.ok) throw new Error(`BIHAMK cameras HTTP ${res.status}`);
  const listings = parseBihamkPage(await res.text());
  if (listings.length < 8) throw new Error(`BIHAMK cameras: only ${listings.length} on the page`);
  return listings.map(mapBihamkCamera).filter((c): c is CctvCamera => c !== null);
}
