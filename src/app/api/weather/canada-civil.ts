/**
 * TAKIP — Canadian civil emergency alerts that ECCC's weather feed doesn't
 * carry, all keyless:
 *  - B.C. evacuation orders and alerts (EMCR on ArcGIS), OGL-BC. Orders stay
 *    listed for as long as they stand, some for years (landslide areas), so
 *    the date shown is the last modification, not the start.
 *  - SaskAlert public feed; Environment Canada's entries are skipped as ECCC
 *    duplicates. Government of Saskatchewan terms; reuse not yet reviewed.
 *  - Alberta Emergency Alert Atom feed; alberta.ca terms, not yet reviewed.
 *    Empty when this was written, so its parser follows GeoRSS/CAP rather than
 *    a live sample.
 */

import { httpJson, httpText } from '@/lib/httpJson';
import { centreOfLargest, type LatLng, type Ring } from './geometry';

export const BC_EVAC_URL = 'https://services6.arcgis.com/ubm4tcTYICKBpist/arcgis/rest/services/Evacuation_Orders_and_Alerts/FeatureServer/0/query'
  + '?where=1%3D1&outFields=EVENT_NAME,EVENT_TYPE,ORDER_ALERT_NAME,ORDER_ALERT_STATUS,ISSUING_AGENCY,MULTI_SOURCED_POPULATION,MULTI_SOURCED_HOMES,DATE_MODIFIED,OBJECTID'
  + '&outSR=4326&geometryPrecision=4&f=json';
export const SASKALERT_URL = 'https://emergencyalert.saskatchewan.ca/sapublic/feed.json';
export const AEA_URL = 'https://www.alberta.ca/data/aea/rss/feed-full.atom';

export interface CivilEvent {
  id: string;
  title: string;
  category: 'civilEmergency';
  type: string;
  icon: 'alert';
  severity: 'low' | 'medium' | 'high';
  lat: number;
  lng: number;
  date?: string;
  expires?: string;
  area?: string;
  source: string;
  provider: 'B.C. EMCR' | 'SaskAlert' | 'Alberta Emergency Alert';
}

const iso = (ms: unknown) => (typeof ms === 'number' && Number.isFinite(ms) ? new Date(ms).toISOString() : undefined);

export function parseBcEvacuations(json: unknown): CivilEvent[] {
  const features = (json as { features?: unknown } | null)?.features;
  if (!Array.isArray(features)) throw new Error('B.C. evacuations: unexpected ArcGIS shape');
  return features.flatMap((f: { attributes?: Record<string, unknown>; geometry?: { rings?: Ring[] } }) => {
    const a = f.attributes ?? {};
    const at = centreOfLargest(f.geometry?.rings ?? []);
    const status = String(a.ORDER_ALERT_STATUS ?? '');
    if (!at || (status !== 'Order' && status !== 'Alert')) return [];
    const people = Number(a.MULTI_SOURCED_POPULATION);
    const homes = Number(a.MULTI_SOURCED_HOMES);
    const reach = [people > 0 ? `${people} people` : '', homes > 0 ? `${homes} homes` : ''].filter(Boolean).join(', ');
    const event = String(a.EVENT_NAME ?? '').trim();
    return [{
      id: `bc-evac-${a.OBJECTID}`,
      title: `Evacuation ${status.toLowerCase()} — ${event || String(a.ORDER_ALERT_NAME ?? '')}${reach ? ` (${reach})` : ''}`,
      category: 'civilEmergency',
      type: `Evacuation ${status}`,
      icon: 'alert',
      severity: status === 'Order' ? 'high' : 'medium',
      lat: at.lat,
      lng: at.lng,
      date: iso(a.DATE_MODIFIED),
      area: [String(a.ORDER_ALERT_NAME ?? '').trim(), String(a.ISSUING_AGENCY ?? '').trim()].filter(Boolean).join(' — ') || undefined,
      source: 'https://www.emergencyinfobc.gov.bc.ca/',
      provider: 'B.C. EMCR',
    }];
  });
}

function levelSeverity(level: string): CivilEvent['severity'] {
  const l = level.toLowerCase();
  return l === 'critical' || l === 'warning' || l === 'emergency' ? 'high' : l === 'advisory' ? 'medium' : 'low';
}

/** "lat lon" or "lat,lon". */
function point(s: unknown): LatLng | null {
  const [lat, lng] = String(s ?? '').trim().split(/[\s,]+/).map(Number);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && (lat !== 0 || lng !== 0) ? { lat, lng } : null;
}

export function parseSaskAlert(json: unknown): CivilEvent[] {
  const entries = (json as { entries?: unknown } | null)?.entries;
  if (!Array.isArray(entries)) throw new Error('SaskAlert: unexpected feed shape');
  return entries.flatMap((e: Record<string, unknown>) => {
    const at = point(e.point);
    if (!at || e.author_en === 'Environment Canada' || /cancel|ended|all clear/i.test(String(e.type_en ?? ''))) return [];
    const event = String(e.event_en ?? '').trim();
    const name = event ? event.charAt(0).toUpperCase() + event.slice(1) : 'Emergency alert';
    const areas = Array.isArray(e.area) ? e.area.map((a: { name_en?: string }) => a?.name_en?.trim()).filter(Boolean).join(', ') : '';
    const where = String(e.coverage_en ?? '').trim() || areas;
    return [{
      id: `saskalert-${e.id}`,
      title: `${name} ${String(e.level ?? 'alert')}${where ? ` — ${where}` : ''}`,
      category: 'civilEmergency',
      type: name,
      icon: 'alert',
      severity: levelSeverity(String(e.level ?? '')),
      lat: at.lat,
      lng: at.lng,
      date: iso(Date.parse(String(e.updated ?? ''))),
      area: [where, String(e.author_en ?? '').trim()].filter(Boolean).join(' — ') || undefined,
      source: typeof e.html_link === 'string' ? e.html_link : 'https://emergencyalert.saskatchewan.ca/',
      provider: 'SaskAlert',
    }];
  });
}

function tag(xml: string, name: string): string {
  const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i').exec(xml);
  return (m?.[1] ?? '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
}

export function parseAeaAtom(xml: string): CivilEvent[] {
  if (!/<feed[\s>]/.test(xml)) throw new Error('Alberta Emergency Alert: not an Atom feed');
  return [...xml.matchAll(/<entry[\s>][\s\S]*?<\/entry>/g)].flatMap(([entry]) => {
    const polygon = tag(entry, 'georss:polygon');
    let at: LatLng | null = null;
    if (polygon) {
      const nums = polygon.split(/\s+/).map(Number);
      const ring: Ring = [];
      for (let i = 0; i + 1 < nums.length; i += 2) ring.push([nums[i + 1], nums[i]]);
      at = centreOfLargest([ring]);
    }
    at ??= point(tag(entry, 'georss:point'));
    const title = tag(entry, 'title');
    if (!at || !title || /cancel|ended|all clear/i.test(`${tag(entry, 'cap:msgType')} ${title}`)) return [];
    const link = /<link[^>]*href="([^"]+)"/.exec(entry)?.[1];
    const severity = tag(entry, 'cap:severity');
    return [{
      id: `aea-${tag(entry, 'id') || title}`,
      title,
      category: 'civilEmergency',
      type: tag(entry, 'cap:event') || 'Emergency alert',
      icon: 'alert',
      severity: severity === 'Extreme' || severity === 'Severe' ? 'high' : severity === 'Moderate' ? 'medium' : 'low',
      lat: at.lat,
      lng: at.lng,
      date: tag(entry, 'updated') || undefined,
      expires: tag(entry, 'cap:expires') || undefined,
      area: tag(entry, 'cap:areaDesc') || undefined,
      source: link || 'https://www.alberta.ca/alberta-emergency-alert',
      provider: 'Alberta Emergency Alert',
    }];
  });
}

/** All three; throws only when none answered, so one dead feed never empties the others. */
export async function loadCanadaCivilEvents(): Promise<CivilEvent[]> {
  const opts = { timeoutMs: 20_000 };
  const results = await Promise.allSettled([
    httpJson(BC_EVAC_URL, opts).then(parseBcEvacuations),
    httpJson(SASKALERT_URL, opts).then(parseSaskAlert),
    httpText(AEA_URL, { ...opts, headers: { Accept: '*/*' } }).then(parseAeaAtom),
  ]);
  const ok = results.filter((r): r is PromiseFulfilledResult<CivilEvent[]> => r.status === 'fulfilled');
  for (const r of results) if (r.status === 'rejected') console.warn('[TAKIP] Canadian civil alerts:', r.reason instanceof Error ? r.reason.message : r.reason);
  if (!ok.length) throw new Error('no Canadian civil alert feed answered');
  return ok.flatMap(r => r.value);
}
