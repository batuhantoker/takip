import type { CctvCamera } from '@/lib/cctv/types';
import { stealthFetch } from '@/lib/stealthFetch';

/**
 * TAKIP — Foto-Webcam.eu Alpine cameras (~300 in Austria, Bavaria, South Tyrol), from the network's own metadata
 * list, no key.
 * Terms: images may not be distributed, modified or copied without the operators' prior written consent; links are
 * welcome (foto-webcam.eu Impressum, "Urheberrechte").
 *
 * Partner rows (other operators' servers, some on home routers) are left out, as the site's own overview does.
 */

const API = 'https://www.foto-webcam.eu/webcam/include/metadata.php';
const SOURCE = 'Foto-Webcam.eu';
/** Only the network's own stills; partner rows point elsewhere. */
const OWN_IMAGE = /^https:\/\/www\.foto-webcam\.eu\/webcam\/[\w-]+\/current\/\d+\.jpg$/;
const MAX_AGE_S = 2 * 86_400;
const COUNTRIES: Record<string, string> = {
  at: 'Austria', de: 'Germany', it: 'Italy', ch: 'Switzerland', li: 'Liechtenstein', si: 'Slovenia',
};

export const FOTO_WEBCAM_BOUNDS = { minLat: 44, maxLat: 56, minLng: 5, maxLng: 18 };

export interface FotoWebcam {
  id?: string | null;
  name?: string | null;
  title?: string | null;
  offline?: boolean | null;
  /** Unlisted by the operator. */
  hidden?: boolean | null;
  partner?: boolean | null;
  imgurl?: string | null;
  link?: string | null;
  /** Unix seconds of the newest image. */
  modtime?: number | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export function mapFotoWebcam(cam: FotoWebcam, nowS: number = Date.now() / 1000): CctvCamera | null {
  const id = cam?.id?.trim();
  if (!id || !/^[\w-]+$/.test(id) || cam.offline !== false || cam.hidden === true || cam.partner !== false) return null;

  const feed = cam.imgurl?.trim();
  if (!feed || !OWN_IMAGE.test(feed)) return null;
  if (typeof cam.modtime !== 'number' || nowS - cam.modtime > MAX_AGE_S) return null;

  const { latitude: lat, longitude: lng } = cam;
  if (typeof lat !== 'number' || typeof lng !== 'number' || (lat === 0 && lng === 0)) return null;
  const b = FOTO_WEBCAM_BOUNDS;
  if (lat < b.minLat || lat > b.maxLat || lng < b.minLng || lng > b.maxLng) return null;

  return {
    id: `fotowebcam-${id}`,
    lat,
    lng,
    name: cam.title?.trim() || cam.name?.trim() || id,
    city: cam.name?.trim() || '',
    country: COUNTRIES[cam.country?.toLowerCase() ?? ''] ?? '',
    feed_url: feed,
    external_url: `https://www.foto-webcam.eu/webcam/${id}/`,
    source: SOURCE,
  };
}

export async function fetchFotoWebcamCameras(): Promise<CctvCamera[]> {
  const res = await stealthFetch(API, { signal: AbortSignal.timeout(12000), headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Foto-Webcam.eu HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data?.cams)) throw new Error('Foto-Webcam.eu: no cams in response');

  const nowS = Date.now() / 1000;
  const seen = new Map<string, CctvCamera>();
  for (const cam of data.cams) {
    const mapped = mapFotoWebcam(cam, nowS);
    if (mapped && !seen.has(mapped.id)) seen.set(mapped.id, mapped);
  }
  console.log(`[TAKIP] Alpine cameras — ${SOURCE}: ${seen.size}`);
  return [...seen.values()];
}
