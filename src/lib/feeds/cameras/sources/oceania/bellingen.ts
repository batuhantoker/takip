import type { CctvCamera } from '@/lib/feeds/cameras/types';
import type { Bounds } from '@/lib/feeds/cameras/sources/platforms/cars';

/**
 * TAKIP — Bellingen Shire (NSW) flood-watch cameras at its bridges (6): the council's public ArcGIS layer, no key.
 * No licence stated on the layer; stills are hosted by DisasterWatch IoT for the council. Permission not yet asked.
 */

const LAYER = 'https://services7.arcgis.com/kkiBaYsUIhK1wEpz/arcgis/rest/services/Flood_Camera_Network/FeatureServer/0/query'
  + '?where=1%3D1&outFields=Site,Road_Name,Locaility,Hyperlink&outSR=4326&f=json';
const UA = 'TAKIP/0.1 (+https://github.com/batuhantoker/takip)';
export const BELLINGEN_BOUNDS: Bounds = { minLat: -30.7, maxLat: -30.1, minLng: 152.5, maxLng: 153.2 };

export interface BellingenFeature {
  // "Locaility" is the layer's own spelling.
  attributes?: { Site?: string | null; Road_Name?: string | null; Locaility?: string | null; Hyperlink?: string | null } | null;
  geometry?: { x?: number | null; y?: number | null } | null;
}

/** The image folder number is the camera's id on the DisasterWatch host. */
const STILL = /^https:\/\/public\.disasterwatch-iotp\.com\.au\/prospectpublicimages\/(\d+)\/[^?#]+\.jpe?g$/i;

const titleCase = (s: string) => s.toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase());

export function mapBellingenCamera(feature: BellingenFeature | null | undefined): CctvCamera | null {
  const a = feature?.attributes;
  const still = a?.Hyperlink?.trim() ?? '';
  const num = still.match(STILL)?.[1];
  if (!num) return null;

  const lat = Number(feature?.geometry?.y);
  const lng = Number(feature?.geometry?.x);
  const b = BELLINGEN_BOUNDS;
  if (!(lat > b.minLat && lat < b.maxLat && lng > b.minLng && lng < b.maxLng)) return null;

  const site = a?.Site?.trim();
  const road = a?.Road_Name?.trim();
  return {
    id: `bellingen-${num}`,
    lat,
    lng,
    name: site ? `${site}${road ? `, ${road}` : ''}` : `Bellingen Flood Camera ${num}`,
    city: a?.Locaility?.trim() ? titleCase(a.Locaility.trim()) : 'Bellingen Shire',
    country: 'Australia',
    feed_url: still,
    stream_type: 'jpg',
    source: 'Bellingen Shire Council',
  };
}

export async function fetchBellingenCameras(): Promise<CctvCamera[]> {
  const res = await fetch(LAYER, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(12_000) });
  if (!res.ok) throw new Error(`Bellingen cameras HTTP ${res.status}`);
  const json = await res.json();
  // ArcGIS reports query errors as HTTP 200 with an error body.
  if (json?.error) throw new Error(`Bellingen cameras: ${json.error.message ?? 'query error'}`);
  if (!Array.isArray(json?.features)) throw new Error('Bellingen cameras: no features in response');

  const seen = new Map<string, CctvCamera>();
  for (const f of json.features) {
    const cam = mapBellingenCamera(f);
    if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
  }
  return [...seen.values()];
}
