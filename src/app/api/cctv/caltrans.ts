import type { CctvCamera } from './types';
import { stealthFetch } from '@/lib/stealthFetch';

/**
 * OSIRIS — Caltrans cameras (~2,900).
 * Source: Caltrans' public ArcGIS CCTV layer, no key.
 */

const LAYER = 'https://caltrans-gis.dot.ca.gov/arcgis/rest/services/CHhighway/CCTV/FeatureServer/0/query';
const FIELDS = 'OBJECTID,latitude,longitude,currentImageURL,locationName,nearbyPlace,county';
/** The layer's maxRecordCount; without paging the query stops at the first 2,000. */
const PAGE = 2000;
const MAX_PAGES = 5;

export interface CaltransFeature {
  attributes?: {
    OBJECTID?: number;
    latitude?: number;
    longitude?: number;
    currentImageURL?: string | null;
    locationName?: string | null;
    nearbyPlace?: string | null;
    county?: string | null;
  };
}

export function mapFeature(feature: CaltransFeature): CctvCamera | null {
  const p = feature?.attributes;
  if (!p || p.OBJECTID == null || !p.latitude || !p.longitude || !p.currentImageURL) return null;
  return {
    id: `cal-${p.OBJECTID}`,
    lat: p.latitude,
    lng: p.longitude,
    name: p.locationName || 'Caltrans',
    city: p.nearbyPlace || p.county || 'California',
    country: 'US',
    feed_url: p.currentImageURL,
    source: 'Caltrans',
  };
}

function pageUrl(offset: number): string {
  return `${LAYER}?where=1%3D1&outFields=${FIELDS}&orderByFields=OBJECTID&resultOffset=${offset}&resultRecordCount=${PAGE}&f=json`;
}

export async function fetchCaltransCameras(): Promise<CctvCamera[]> {
  const cams: CctvCamera[] = [];
  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await stealthFetch(pageUrl(page * PAGE), { signal: AbortSignal.timeout(12000) });
      if (!res.ok) {
        console.warn(`[OSIRIS] Caltrans page ${page} returned ${res.status}`);
        break;
      }
      const data = await res.json();
      const features: CaltransFeature[] = data?.features || [];
      for (const f of features) {
        const cam = mapFeature(f);
        if (cam) cams.push(cam);
      }
      if (features.length < PAGE) break;
    }
  } catch (e) {
    console.warn('[OSIRIS] Caltrans failed part-way:', e instanceof Error ? e.message : e);
  }
  console.log(`[OSIRIS] California cameras — Caltrans: ${cams.length}`);
  return cams;
}
