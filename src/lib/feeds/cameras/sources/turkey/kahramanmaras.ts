import type { CctvCamera } from '@/lib/feeds/cameras/types';
import type { Bounds } from '@/lib/feeds/cameras/sources/platforms/cars';
import { markMissingMedia } from '@/lib/feeds/cameras/liveness';

/**
 * Kahramanmaraş Metropolitan Municipality city cameras (~27 HLS), read from the card grid on kamera.kahramanmaras.bel.tr.
 * Terms: none published; the portal footer says only "Tüm Hakları Saklıdır" (all rights reserved), so terms are pending.
 * Some streams are HEVC (hvc1), which hls.js plays only where the browser decodes HEVC (Safari, most Chrome/Edge; not Firefox).
 */

const PORTAL = 'https://kamera.kahramanmaras.bel.tr/';
const STREAM_HOST = 'camstream.kahramanmaras.bel.tr';
const UA = 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)';
export const KAHRAMANMARAS_BOUNDS: Bounds = { minLat: 37.1, maxLat: 38.8, minLng: 36.0, maxLng: 37.8 };

// The portal gives no coordinates. These come from Nominatim (© OpenStreetMap contributors, ODbL), keyed by stream slug.
// District cameras ("İlçe Meydanı") sit at the district town's centre, not the exact square.
// Slugs left out (Teras, Çocuk Yuvası, Dulkadiroğlu, Boğaziçi, Tavşantepe, Dr. Mustafa, Malik Ejder, Necip Fazıl KM)
// aren't in OpenStreetMap or are too vague to place, so they fall back to the city centre.
type Place = [lat: number, lng: number, town?: string];
const CITY_CENTRE: Place = [37.58127, 36.92751];
export const KAHRAMANMARAS_PLACES: Record<string, Place> = {
  belediye: [37.57678, 36.92691],
  kale: [37.58718, 36.92539],
  kapalicarsi1: [37.58326, 36.92761],
  kapalicarsi2: [37.58326, 36.92761],
  mehmetakif: [37.58583, 36.92235],
  selale: [37.57677, 36.93081],
  ulucami: [37.58452, 36.92705],
  yedikuyular: [37.64655, 37.04058],
  afsin: [38.24385, 36.91529, 'Afşin'],
  andirin: [37.57502, 36.35525, 'Andırın'],
  'caglayan-cerit': [37.74997, 37.29278, 'Çağlayancerit'],
  ekinozu: [38.06067, 37.18941, 'Ekinözü'],
  'elbistan-meydan': [38.20223, 37.1903, 'Elbistan'],
  // Battalgazi Mahallesi isn't in OpenStreetMap; Elbistan's centre stands in.
  elbistanbattalgazi: [38.20223, 37.1903, 'Elbistan'],
  goksun: [38.02131, 36.49456, 'Göksun'],
  nurhak: [37.96615, 37.44219, 'Nurhak'],
  pazarcik: [37.48949, 37.29352, 'Pazarcık'],
  turkoglu: [37.38648, 36.84742, 'Türkoğlu'],
};

// Both terrace cameras are titled just "Teras" upstream.
const NAMES: Record<string, string> = { terasdogu: 'Teras Doğu', terasbati: 'Teras Batı' };

const CARD = /<div\b[^>]*\bdata-stream="[^"]*"[^>]*>/g;

function attr(tag: string, name: string): string {
  return tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] ?? '';
}

function decode(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function streamSlug(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.hostname !== STREAM_HOST) return null;
  return url.pathname.match(/^\/live\/([a-z0-9-]+)\.stream\/playlist\.m3u8$/i)?.[1].toLowerCase() ?? null;
}

export function parseKahramanmarasPortal(html: string): CctvCamera[] {
  const b = KAHRAMANMARAS_BOUNDS;
  const seen = new Map<string, CctvCamera>();
  for (const [tag] of html.matchAll(CARD)) {
    const stream = decode(attr(tag, 'data-stream'));
    const slug = streamSlug(stream);
    if (!slug || seen.has(slug)) continue;

    const [lat, lng, town] = KAHRAMANMARAS_PLACES[slug] ?? CITY_CENTRE;
    if (!(lat > b.minLat && lat < b.maxLat && lng > b.minLng && lng < b.maxLng)) continue;

    seen.set(slug, {
      id: `tr-kahramanmaras-${slug}`,
      lat,
      lng,
      name: NAMES[slug] ?? (decode(attr(tag, 'data-title')) || `Kahramanmaraş Camera ${slug}`),
      city: town ?? 'Kahramanmaraş',
      country: 'Turkey',
      stream_url: stream,
      stream_type: 'hls',
      external_url: PORTAL,
      source: 'Kahramanmaraş Büyükşehir Belediyesi',
    });
  }
  return [...seen.values()];
}

export async function fetchKahramanmarasCameras(): Promise<CctvCamera[]> {
  const res = await fetch(PORTAL, {
    headers: { 'User-Agent': UA, Accept: 'text/html' },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`Kahramanmaraş cameras HTTP ${res.status}`);
  const listed = parseKahramanmarasPortal(await res.text());
  if (!listed.length) throw new Error('Kahramanmaraş cameras: no cameras found in the portal');
  const cams = await markMissingMedia(listed);
  console.log(`[TAKIP] Kahramanmaraş cameras — Kahramanmaraş Büyükşehir Belediyesi: ${cams.length}`);
  return cams;
}
