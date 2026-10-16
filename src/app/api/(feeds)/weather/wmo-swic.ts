/**
 * TAKIP — official CAP warnings from WMO members via the WMO Severe Weather
 * Information Centre (SWIC), no key. Terms: WMO and the issuing member's CAP
 * terms; redistribution not yet reviewed.
 *
 * `wmo_all.json` lists ~1.6k current alerts but carries no geometry; the area
 * is only in each alert's CAP file. Those files never change once issued, so
 * each is fetched once and its point kept while the alert stays listed.
 * Members that publish region codes instead of shapes (CMA, BoM, HNMS…) can't
 * be placed, so their alerts are folded into one country-level event at the
 * member's centroid rather than stacked as fake pins.
 *
 * Only Severe and Extreme (`s` ≥ 3) are kept: the ~1k Moderate/Minor rows are
 * mostly routine yellow notices. Only Extreme grades high: ~50 issuers send
 * ~200 Severe alerts a day, which would swamp the SEVERE count. US and
 * Canadian alerts come direct from NWS and ECCC instead.
 */

import { createPool } from '@/lib/core/net/fetch-pool';
import { httpJson, httpText } from '@/lib/core/net/http-json';
import { centreOfLargest, type LatLng, type Ring } from './geometry';

export const SWIC_ALL_URL = 'https://severeweather.wmo.int/json/wmo_all.json';
export const SWIC_MEMBERS_URL = 'https://severeweather.wmo.int/json/wmo_member.json';
export const SWIC_CAP_BASE = 'https://severeweather.wmo.int/v2/cap-alerts/';

export interface SwicItem {
  id: string;
  event?: string;
  headline?: string;
  sent?: string;
  effective?: string;
  expires?: string;
  areaDesc?: string;
  mid?: string;
  /** CAP severity: 4 Extreme, 3 Severe, 2 Moderate, 1 Minor, 0 Unknown. */
  s?: number;
  capURL?: string;
  url?: string;
}

export interface SwicMember {
  mid: string;
  name: string;
  lat: number;
  lng: number;
}

export interface SwicEvent {
  id: string;
  title: string;
  category: 'weatherAlerts';
  type: string;
  icon: 'weather';
  severity: 'high' | 'medium';
  lat: number;
  lng: number;
  date?: string;
  expires?: string;
  area?: string;
  source: string;
  provider: 'WMO SWIC';
}

const SKIPPED_ISSUERS = ['us-', 'ca-'];

/** `YYYY-MM-DD HH:MM:SS`, UTC. */
export function parseSwicTime(s: string | undefined): string | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec((s ?? '').trim());
  if (!m) return undefined;
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  return Number.isFinite(t) ? new Date(t).toISOString() : undefined;
}

export function capPath(item: SwicItem): string {
  return (item.capURL || item.url || '').trim();
}

export function selectSwicAlerts(json: unknown, now: number): SwicItem[] {
  const items = (json as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) throw new Error('WMO SWIC: unexpected wmo_all.json shape');
  return (items as SwicItem[]).filter(i => {
    const path = i && typeof i.id === 'string' ? capPath(i) : '';
    if (!path || (i.s ?? 0) < 3 || SKIPPED_ISSUERS.some(p => path.startsWith(p))) return false;
    const expires = parseSwicTime(i.expires);
    return !expires || Date.parse(expires) > now;
  });
}

export function parseSwicMembers(json: unknown): Map<string, SwicMember> {
  if (!Array.isArray(json)) throw new Error('WMO SWIC: unexpected wmo_member.json shape');
  const out = new Map<string, SwicMember>();
  for (const region of json as { members?: Partial<SwicMember>[] }[]) {
    for (const m of region?.members ?? []) {
      if (typeof m.mid === 'string' && typeof m.lat === 'number' && typeof m.lng === 'number') {
        out.set(m.mid, { mid: m.mid, name: m.name ?? m.mid, lat: m.lat, lng: m.lng });
      }
    }
  }
  return out;
}

/** CAP `polygon` is "lat,lon lat,lon …"; `circle` is "lat,lon radius". Namespace prefixes vary by issuer. */
export function capPoint(xml: string): LatLng | null {
  const rings: Ring[] = [];
  for (const m of xml.matchAll(/<(?:\w+:)?polygon>([\s\S]*?)<\/(?:\w+:)?polygon>/g)) {
    const ring: Ring = [];
    for (const pair of m[1].trim().split(/\s+/)) {
      const [lat, lng] = pair.split(',').map(Number);
      if (Number.isFinite(lat) && Number.isFinite(lng)) ring.push([lng, lat]);
    }
    rings.push(ring);
  }
  const fromPolygon = centreOfLargest(rings);
  if (fromPolygon) return fromPolygon;

  const circle = /<(?:\w+:)?circle>\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)/.exec(xml);
  if (circle) {
    const [lat, lng] = [Number(circle[1]), Number(circle[2])];
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
  }
  return null;
}

const swicSeverity = (s: number | undefined): SwicEvent['severity'] => ((s ?? 0) >= 4 ? 'high' : 'medium');

export function mapSwicAlert(item: SwicItem, at: LatLng, member?: SwicMember): SwicEvent {
  const area = [item.areaDesc?.trim(), member?.name].filter(Boolean).join(' — ');
  return {
    id: `swic-${item.id}`,
    title: item.headline?.trim() || item.event?.trim() || 'Severe weather warning',
    category: 'weatherAlerts',
    type: item.event?.trim() || 'Weather Warning',
    icon: 'weather',
    severity: swicSeverity(item.s),
    lat: at.lat,
    lng: at.lng,
    date: parseSwicTime(item.effective) ?? parseSwicTime(item.sent),
    expires: parseSwicTime(item.expires),
    area: area || undefined,
    source: SWIC_CAP_BASE + capPath(item),
    provider: 'WMO SWIC',
  };
}

const MAX_AREA_CHARS = 240;

/** One event per member for alerts that have no shape, pinned to the member's centroid. */
export function countryLevelEvents(items: SwicItem[], members: Map<string, SwicMember>): SwicEvent[] {
  const byMember = new Map<string, SwicItem[]>();
  for (const i of items) {
    if (!i.mid || !members.has(i.mid)) continue;
    byMember.set(i.mid, [...(byMember.get(i.mid) ?? []), i]);
  }
  return [...byMember].map(([mid, group]) => {
    const m = members.get(mid)!;
    const kinds = [...new Set(group.map(i => i.event?.trim()).filter(Boolean))];
    const sent = group.map(i => parseSwicTime(i.effective) ?? parseSwicTime(i.sent)).filter(Boolean).sort();
    const expires = group.map(i => parseSwicTime(i.expires)).filter(Boolean).sort();
    const areas = [...new Set(group.map(i => i.areaDesc?.trim()).filter(Boolean))].join('; ');
    return {
      id: `swic-${mid}-country`,
      title: `${m.name}: ${group.length} severe weather warning${group.length === 1 ? '' : 's'} — ${kinds.slice(0, 4).join(', ')}`,
      category: 'weatherAlerts',
      type: group.length === 1 && kinds[0] ? kinds[0] : 'Severe weather warnings',
      icon: 'weather',
      severity: swicSeverity(Math.max(...group.map(i => i.s ?? 0))),
      lat: m.lat,
      lng: m.lng,
      date: sent.at(-1),
      expires: expires.at(-1),
      area: `Country-level, areas not mapped: ${areas.length > MAX_AREA_CHARS ? `${areas.slice(0, MAX_AREA_CHARS)}…` : areas}`,
      source: 'https://severeweather.wmo.int/',
      provider: 'WMO SWIC',
    };
  });
}

// ── Fetching ─────────────────────────────────────────────────────────────

const pool = createPool(4);
/** CAP path → its point, or null when the file has region codes only. Pruned to the current list each refresh. */
const capPoints = new Map<string, LatLng | null>();
const pending = new Map<string, Promise<void>>();
let members: { at: number; map: Map<string, SwicMember> } | null = null;

const MEMBERS_TTL_MS = 24 * 3_600_000;
const ANY = { headers: { Accept: '*/*' } };

function resolveCap(path: string): Promise<void> {
  if (capPoints.has(path)) return Promise.resolve();
  const inflight = pending.get(path);
  if (inflight) return inflight;
  const task = pool
    .run(() => httpText(SWIC_CAP_BASE + path, { timeoutMs: 15_000, ...ANY }))
    .then(xml => { capPoints.set(path, capPoint(xml)); }, () => { /* left unresolved, so the next refresh retries it */ })
    .finally(() => pending.delete(path));
  pending.set(path, task);
  return task;
}

async function loadMembers(now: number): Promise<Map<string, SwicMember>> {
  if (members && now - members.at < MEMBERS_TTL_MS) return members.map;
  try {
    members = { at: now, map: parseSwicMembers(await httpJson(SWIC_MEMBERS_URL, { timeoutMs: 20_000 })) };
  } catch (e) {
    if (!members) throw e;
  }
  return members.map;
}

/**
 * Current Severe/Extreme alerts. CAP files still downloading when `budgetMs`
 * runs out keep going in the background; until they land, their alerts count
 * towards the country-level event.
 */
export async function loadSwicEvents(budgetMs = 8_000): Promise<SwicEvent[]> {
  const now = Date.now();
  const [alerts, memberMap] = await Promise.all([
    httpJson<unknown>(SWIC_ALL_URL, { timeoutMs: 20_000 }).then(json => selectSwicAlerts(json, now)),
    loadMembers(now),
  ]);

  const live = new Set(alerts.map(capPath));
  for (const path of capPoints.keys()) if (!live.has(path)) capPoints.delete(path);

  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    Promise.allSettled(alerts.map(a => resolveCap(capPath(a)))),
    new Promise(resolve => { timer = setTimeout(resolve, budgetMs); }),
  ]);
  clearTimeout(timer);

  const placed: SwicEvent[] = [];
  const unplaced: SwicItem[] = [];
  for (const a of alerts) {
    const at = capPoints.get(capPath(a));
    if (at) placed.push(mapSwicAlert(a, at, a.mid ? memberMap.get(a.mid) : undefined));
    else unplaced.push(a);
  }
  return [...placed, ...countryLevelEvents(unplaced, memberMap)];
}
