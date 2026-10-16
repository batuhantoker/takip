import type { CctvCamera } from '@/lib/feeds/cameras/types';
import { stealthFetch } from '@/lib/core/net/stealth-fetch';

/**
 * TAKIP — Madrid city traffic cameras (~357) from the Ayuntamiento's Informo KML, no key.
 * Terms: CC BY 4.0 (datos.madrid.es dataset 202088-0-trafico-camaras).
 *
 * DGT's spain.ts cameras near the city are national-road cameras with their own views, not these.
 */

const KML = 'https://informo.madrid.es/informo/tmadrid/CCTV.kml';
const IMAGE_BASE = 'https://informo.madrid.es/cameras';

export const MADRID_BOUNDS = { minLat: 40.3, maxLat: 40.65, minLng: -3.9, maxLng: -3.5 };

export interface MadridPlacemark {
  numero: string;
  nombre: string;
  lat: number;
  lng: number;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decode(s: string): string {
  return s.replace(/&(amp|lt|gt|quot|apos);/g, (_, e: string) => ENTITIES[e]);
}

function dataValue(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<Data name="${name}">\\s*<Value>([\\s\\S]*?)</Value>`));
  return m ? decode(m[1]).trim() : null;
}

/** No XML parser in the server bundle; the KML is flat enough for this. */
export function parsePlacemarks(kml: string): MadridPlacemark[] {
  const out: MadridPlacemark[] = [];
  for (const [, block] of kml.matchAll(/<Placemark>([\s\S]*?)<\/Placemark>/g)) {
    const coords = block.match(/<coordinates>\s*([^<]*?)\s*<\/coordinates>/)?.[1].split(',');
    out.push({
      numero: dataValue(block, 'Numero') || '',
      nombre: dataValue(block, 'Nombre') || '',
      lng: Number(coords?.[0]),
      lat: Number(coords?.[1]),
    });
  }
  return out;
}

export function mapPlacemark(p: MadridPlacemark): CctvCamera | null {
  if (!/^\d+$/.test(p?.numero || '')) return null;
  if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return null;
  const b = MADRID_BOUNDS;
  if (p.lat < b.minLat || p.lat > b.maxLat || p.lng < b.minLng || p.lng > b.maxLng) return null;

  return {
    id: `madrid-${p.numero}`,
    lat: p.lat,
    lng: p.lng,
    name: p.nombre || `Madrid Camera ${p.numero}`,
    city: 'Madrid',
    country: 'Spain',
    feed_url: `${IMAGE_BASE}/Camara${p.numero}.jpg`,
    source: 'Ayuntamiento de Madrid',
  };
}

export async function fetchMadridCameras(): Promise<CctvCamera[]> {
  const res = await stealthFetch(KML, { signal: AbortSignal.timeout(12000), headers: { Accept: '*/*' } });
  if (!res.ok) throw new Error(`Madrid Informo HTTP ${res.status}`);

  const seen = new Map<string, CctvCamera>();
  for (const p of parsePlacemarks(await res.text())) {
    const cam = mapPlacemark(p);
    if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
  }
  console.log(`[TAKIP] Madrid cameras — Ayuntamiento de Madrid: ${seen.size}`);
  return [...seen.values()];
}
