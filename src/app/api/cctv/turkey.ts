import type { CctvCamera } from './types';

/**
 * Kayseri Metropolitan Municipality cameras (izle.kayseri.bel.tr), read from the inline list on its /harita map page.
 * Live video is not replayed: the embed 404s without the site's own Referer and its HLS token lasts five minutes, the
 * player's own watch limit. So the still is the site's thumbnail (replaced roughly hourly) and the viewer links out.
 */

const SITE = 'https://izle.kayseri.bel.tr';
const UA = 'OSIRIS/5.0 (+https://osirisai.live)';
const KAYSERI_BOUNDS = { minLat: 37.7, maxLat: 39.8, minLng: 34.8, maxLng: 37.0 };

// One entry of `const cameras = [...]`: { id: 36, title: "Tekir Pist", slug: "tekir-pist", lat: 38.54, lng: 35.52, ... }
const ENTRY = /\{\s*id:\s*(\d+),\s*title:\s*"((?:[^"\\]|\\.)*)",\s*slug:\s*"([a-z0-9-]+)",\s*lat:\s*(-?\d+(?:\.\d+)?),\s*lng:\s*(-?\d+(?:\.\d+)?)/g;

function unescapeTitle(s: string): string {
  return s
    .replace(/\\u([0-9a-f]{4})/gi, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\(.)/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseKayseriMap(html: string): CctvCamera[] {
  const cams: CctvCamera[] = [];
  const seen = new Set<string>();
  for (const [, id, title, slug, latRaw, lngRaw] of html.matchAll(ENTRY)) {
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (lat < KAYSERI_BOUNDS.minLat || lat > KAYSERI_BOUNDS.maxLat) continue;
    if (lng < KAYSERI_BOUNDS.minLng || lng > KAYSERI_BOUNDS.maxLng) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    cams.push({
      id: `tr-kayseri-${id}`,
      lat,
      lng,
      name: unescapeTitle(title) || `Kayseri Camera ${id}`,
      city: 'Kayseri',
      country: 'Turkey',
      // Redirects to the current thumbnail, whose filename is only exposed by the Referer-gated embed.
      feed_url: `${SITE}/kameraGorsel/${id}`,
      stream_type: 'jpg',
      external_url: `${SITE}/kamera/${slug}`,
      source: 'Kayseri Büyükşehir Belediyesi',
    });
  }
  return cams;
}

export async function fetchTurkeyCameras(): Promise<CctvCamera[]> {
  const res = await fetch(`${SITE}/harita`, {
    headers: { 'User-Agent': UA, Accept: 'text/html' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`kayseri /harita HTTP ${res.status}`);
  const cams = parseKayseriMap(await res.text());
  if (!cams.length) throw new Error('kayseri /harita: no cameras found in the page');
  return cams;
}
