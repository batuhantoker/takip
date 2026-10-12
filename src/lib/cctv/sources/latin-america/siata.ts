import type { CctvCamera } from '@/lib/cctv/types';
import { stealthFetch } from '@/lib/stealthFetch';

/**
 * TAKIP — SIATA early-warning cameras, Valle de Aburrá / Medellín (~84): the geoportal's camera layer, no key.
 * Terms: none published on siata.gov.co or the geoportal; permission not yet asked.
 *
 * Only the cameras in this layer carry coordinates; /ultimasFotosCamaras/ holds ~100 more stills without them.
 */

const API = 'https://geoportal.siata.gov.co/fastgeoapi/cameras/';
const STILL = /^https:\/\/siata\.gov\.co\/ultimasFotosCamaras\/[\w.-]+\.jpe?g$/i;

export const SIATA_BOUNDS = { minLat: 5.9, maxLat: 6.6, minLng: -75.8, maxLng: -75.2 };

export interface SiataFeature {
  geometry?: { coordinates?: (number | null)[] | null } | null;
  properties?: {
    url?: string | null;
    codigo?: string | null;
    tipo?: string | null;
    nombre?: string | null;
  } | null;
}

/** "MedellinOrienteCCTV" → "Medellin Oriente", "…Los Musicos CCTV_2" → "…Los Musicos 2". */
function cleanName(raw: string): string {
  return raw
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s*CCTV(?:_(\d+))?$/, (_, n) => (n ? ` ${n}` : ''))
    .replace(/\s+/g, ' ')
    .trim();
}

export function mapSiataCamera(f: SiataFeature | null | undefined): CctvCamera | null {
  const p = f?.properties;
  const code = p?.codigo?.trim();
  const still = p?.url?.trim();
  if (!code || !/^\d{1,10}$/.test(code) || !still || !STILL.test(still)) return null;

  const [lng, lat] = f?.geometry?.coordinates ?? [];
  if (typeof lat !== 'number' || typeof lng !== 'number' || (lat === 0 && lng === 0)) return null;
  const b = SIATA_BOUNDS;
  if (lat < b.minLat || lat > b.maxLat || lng < b.minLng || lng > b.maxLng) return null;

  return {
    id: `siata-${code}`,
    lat,
    lng,
    name: cleanName(p?.nombre ?? '') || `SIATA ${p?.tipo?.trim() || 'cámara'} ${code}`,
    city: 'Valle de Aburrá',
    country: 'Colombia',
    feed_url: still,
    external_url: 'https://geoportal.siata.gov.co/',
    source: 'SIATA',
  };
}

export async function fetchSiataCameras(): Promise<CctvCamera[]> {
  const res = await stealthFetch(API, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`SIATA cameras HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data?.features)) throw new Error('SIATA cameras: unexpected response');

  const seen = new Map<string, CctvCamera>();
  // A few stills are listed twice, under an old and a new codigo.
  const stills = new Set<string>();
  for (const f of data.features) {
    const cam = mapSiataCamera(f);
    if (!cam || seen.has(cam.id) || stills.has(cam.feed_url!)) continue;
    seen.set(cam.id, cam);
    stills.add(cam.feed_url!);
  }
  console.log(`[TAKIP] SIATA cameras — SIATA: ${seen.size}`);
  return [...seen.values()];
}
