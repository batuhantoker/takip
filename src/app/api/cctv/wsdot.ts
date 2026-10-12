import type { CctvCamera } from './types';
import { stealthFetch } from '@/lib/stealthFetch';

/**
 * OSIRIS — Washington State DOT cameras (~1,640).
 * Source: WSDOT's public ArcGIS layer, no key. The old
 * data.wsdot.wa.gov/log/public/cameras.json feed now 404s.
 */

const LAYER = 'https://data.wsdot.wa.gov/arcgis/rest/services/TravelInformation/TravelInfoCamerasWeather/FeatureServer/0/query'
  + '?where=1%3D1&outFields=OBJECTID,CameraTitle,ImageURL&outSR=4326&f=json';

/** oregon.ts carries the TripCheck cameras WSDOT lists along the Columbia. */
const COVERED_ELSEWHERE = ['tripcheck.com'];

export interface WsdotFeature {
  attributes?: { OBJECTID?: number; CameraTitle?: string | null; ImageURL?: string | null };
  geometry?: { x?: number; y?: number };
}

function coveredElsewhere(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return COVERED_ELSEWHERE.some(h => host === h || host.endsWith('.' + h));
  } catch {
    return true;
  }
}

export function mapFeature(feature: WsdotFeature): CctvCamera | null {
  const a = feature?.attributes;
  const url = a?.ImageURL?.trim();
  if (a?.OBJECTID == null || !url || coveredElsewhere(url)) return null;

  const lat = feature.geometry?.y;
  const lng = feature.geometry?.x;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return {
    id: `wsdot-${a.OBJECTID}`,
    lat: lat!,
    lng: lng!,
    name: a.CameraTitle?.trim() || 'WSDOT Camera',
    city: 'Washington',
    country: 'US',
    feed_url: url,
    source: 'WSDOT',
  };
}

export async function fetchWsdotCameras(): Promise<CctvCamera[]> {
  try {
    const res = await stealthFetch(LAYER, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) {
      console.warn(`[OSIRIS] WSDOT returned ${res.status} — absent from this refresh`);
      return [];
    }
    const data = await res.json();
    const cams = (data?.features || []).map(mapFeature).filter(Boolean) as CctvCamera[];
    console.log(`[OSIRIS] Washington cameras — WSDOT: ${cams.length}`);
    return cams;
  } catch (e) {
    console.warn('[OSIRIS] WSDOT failed — absent from this refresh:', e instanceof Error ? e.message : e);
    return [];
  }
}
