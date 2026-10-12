/**
 * TAKIP — Environment and Climate Change Canada weather alerts via the MSC
 * GeoMet OGC API, no key. ECCC Data Server End-use Licence (open, attribution).
 *
 * One feature per alert per forecast area, with the area polygon. Querying
 * `status_en=active` returns nothing, so `issued` and `continued` are paged
 * separately. Risk colour exists only on the newer colour-coded warnings;
 * statements and advisories carry none.
 */

import { httpJson } from '@/lib/httpJson';
import { centreOfLargest, type Ring } from './geometry';

export const ECCC_ALERTS_URL = 'https://api.weather.gc.ca/collections/weather-alerts/items';

const STATUSES = ['issued', 'continued'] as const;
const PAGE = 250;
const MAX_PAGES = 8;

export interface EcccFeature {
  id?: string | number;
  geometry?: { type?: string; coordinates?: unknown } | null;
  properties?: {
    alert_code?: string;
    alert_type?: string;
    alert_name_en?: string;
    publication_datetime?: string;
    expiration_datetime?: string;
    risk_colour_en?: string | null;
    impact_en?: string | null;
    confidence_en?: string | null;
    feature_name_en?: string;
    province?: string;
    status_en?: string;
  };
}

export interface EcccEvent {
  id: string;
  title: string;
  category: 'weatherAlerts';
  type: string;
  icon: 'weather';
  severity: 'low' | 'medium' | 'high';
  lat: number;
  lng: number;
  date?: string;
  expires?: string;
  area?: string;
  source: string;
  provider: 'ECCC';
}

export function ecccPageUrl(status: string, offset: number): string {
  return `${ECCC_ALERTS_URL}?f=json&status_en=${status}&limit=${PAGE}&offset=${offset}&sortby=feature_id`;
}

export function ecccSeverity(p: NonNullable<EcccFeature['properties']>): EcccEvent['severity'] {
  const colour = (p.risk_colour_en ?? '').toLowerCase();
  if (colour === 'red' || colour === 'orange') return 'high';
  if (colour === 'yellow' || p.alert_type === 'warning' || p.alert_type === 'watch') return 'medium';
  return 'low';
}

function rings(geometry: EcccFeature['geometry']): Ring[] {
  if (geometry?.type === 'Polygon') return [(geometry.coordinates as Ring[])[0]].filter(Boolean);
  if (geometry?.type === 'MultiPolygon') return (geometry.coordinates as Ring[][]).map(p => p[0]).filter(Boolean);
  return [];
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function mapEcccFeature(f: EcccFeature): EcccEvent | null {
  const p = f.properties;
  if (!p || f.id == null) return null;
  const at = centreOfLargest(rings(f.geometry));
  if (!at) return null;
  const name = capitalise((p.alert_name_en ?? '').trim() || 'weather alert');
  const where = (p.feature_name_en ?? '').trim();
  const province = (p.province ?? '').trim();
  return {
    id: `eccc-${f.id}`,
    title: where ? `${name} — ${where}` : name,
    category: 'weatherAlerts',
    type: name,
    icon: 'weather',
    severity: ecccSeverity(p),
    lat: at.lat,
    lng: at.lng,
    date: p.publication_datetime,
    expires: p.expiration_datetime,
    area: [where, province].filter(Boolean).join(', ') || undefined,
    source: province ? `https://weather.gc.ca/warnings/index_e.html?prov=${province.toLowerCase()}` : 'https://weather.gc.ca/warnings/index_e.html',
    provider: 'ECCC',
  };
}

export function parseEcccPage(json: unknown): EcccFeature[] {
  const features = (json as { features?: unknown } | null)?.features;
  if (!Array.isArray(features)) throw new Error('ECCC: unexpected weather-alerts shape');
  return features as EcccFeature[];
}

export async function loadEcccEvents(): Promise<EcccEvent[]> {
  const features: EcccFeature[] = [];
  for (const status of STATUSES) {
    for (let page = 0; page < MAX_PAGES; page++) {
      const batch = parseEcccPage(await httpJson(ecccPageUrl(status, page * PAGE), { timeoutMs: 20_000 }));
      features.push(...batch);
      if (batch.length < PAGE) break;
    }
  }
  const seen = new Set<string>();
  return features.flatMap(f => {
    const e = mapEcccFeature(f);
    if (!e || seen.has(e.id)) return [];
    seen.add(e.id);
    return [e];
  });
}
