import type { CctvCamera } from '@/lib/cctv/types';
import { stealthFetch } from '@/lib/stealthFetch';

/**
 * TAKIP — USGS volcano webcams (AshCam: AVO, CVO, HVO, YVO; ~460 listed, ~100 kept), no key.
 * Terms: USGS-produced data are US public domain; credit "U.S. Geological Survey". About 18 kept
 * cameras are third-party views USGS re-hosts (NPS, ski areas, WSDOT); `externalUrl` names the owner.
 *
 * The 229 `faaInd: 'Y'` rows are FAA WeatherCams relayed by USGS; faa-weathercams.ts owns those.
 */

const API = 'https://volcview.wr.usgs.gov/ashcam-api/webcamApi/webcams';
const MAX_AGE_S = 7 * 86_400;

// Four western-Aleutian cameras sit across the antimeridian (lng 178–180), outside this box.
export const ASHCAM_BOUNDS = { minLat: 18, maxLat: 66, minLng: -180, maxLng: -104 };

export interface AshcamWebcam {
  webcamCode?: string | null;
  webcamName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  faaInd?: string | null;
  hasImages?: string | null;
  /** Unix seconds; 0 when the camera has never reported. */
  lastImageTimestamp?: number | null;
  currentImageUrl?: string | null;
}

export function mapAshcam(cam: AshcamWebcam | null | undefined, nowS: number = Date.now() / 1000): CctvCamera | null {
  const code = cam?.webcamCode?.trim();
  if (!code || !/^[\w.-]+$/.test(code) || cam!.faaInd !== 'N' || cam!.hasImages !== 'Y') return null;

  const last = cam!.lastImageTimestamp;
  if (typeof last !== 'number' || !(last > 0) || nowS - last > MAX_AGE_S) return null;

  // A few cameras serve current.jpeg, so take the index's URL rather than build one.
  const image = cam!.currentImageUrl ?? '';
  const base = `https://volcview.wr.usgs.gov/ashcam-api/images/webcams/${code}/`;
  if (image !== `${base}current.jpg` && image !== `${base}current.jpeg`) return null;

  const lat = cam!.latitude;
  const lng = cam!.longitude;
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat === 0 && lng === 0) return null;
  const b = ASHCAM_BOUNDS;
  if (lat < b.minLat || lat > b.maxLat || lng < b.minLng || lng > b.maxLng) return null;

  return {
    id: `ashcam-${code}`,
    lat,
    lng,
    name: cam!.webcamName?.trim() || code,
    city: '',
    country: 'US',
    feed_url: image,
    stream_type: 'jpg',
    external_url: `https://volcview.wr.usgs.gov/ashcam-gui/webcam.html?webcam=${encodeURIComponent(code)}`,
    source: 'USGS Volcano Hazards Program',
  };
}

export async function fetchAshcamCameras(): Promise<CctvCamera[]> {
  const res = await stealthFetch(API, { signal: AbortSignal.timeout(12000), headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`USGS AshCam HTTP ${res.status}`);
  // Served as text/html; the body is JSON.
  const data = JSON.parse(await res.text());
  if (!Array.isArray(data?.webcams)) throw new Error('USGS AshCam: no webcams in response');

  const nowS = Date.now() / 1000;
  const seen = new Map<string, CctvCamera>();
  for (const row of data.webcams as AshcamWebcam[]) {
    const cam = mapAshcam(row, nowS);
    if (cam && !seen.has(cam.id)) seen.set(cam.id, cam);
  }
  console.log(`[TAKIP] AshCam cameras — USGS Volcano Hazards Program: ${seen.size}`);
  return [...seen.values()];
}
