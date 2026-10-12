/**
 * TAKIP — IMF PortWatch chokepoint transits and disruption events, from its
 * public ArcGIS FeatureServer layers, no key. Terms not yet reviewed (IMF
 * PortWatch; the AIS behind it is partly UN Global Platform data).
 *
 * Gotchas:
 * - Daily rows are zero-filled, never null, and land weekly: the newest is often a week old.
 * - `date` is a DateOnly field that arrives as "YYYY-MM-DD" and filters with `DATE '…'`.
 *   Disruption dates are epoch ms; `todate` is null while an event is open.
 * - A page holds at most 1000 rows whatever `resultRecordCount` asks for;
 *   `exceededTransferLimit` says another page follows.
 * - ArcGIS reports a bad query as HTTP 200 with an `error` body.
 * - Disruptions name chokepoints in `affectedports` by the same `portid` ("chokepoint6").
 */

import { httpJson } from '@/lib/httpJson';
import { assessFlow, type DailyTransit, type FlowAssessment } from './flow';

export const PORTWATCH_BASE = 'https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services';
export const PORTWATCH_SITE = 'https://portwatch.imf.org/';
export const DAILY_LAYER = 'Daily_Chokepoints_Data';
export const CHOKEPOINTS_LAYER = 'PortWatch_chokepoints_database';
export const DISRUPTIONS_LAYER = 'portwatch_disruptions_database';

export const HISTORY_DAYS = 130;
export const SERIES_DAYS = 30;
export const ENDED_WITHIN_DAYS = 30;
export const PAGE_SIZE = 1000;
export const MAX_PAGES = 10;

const DAY_MS = 86_400_000;

type Attrs = Record<string, unknown>;

export interface ChokepointRef {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface SeriesPoint {
  date: string;
  total: number;
  tanker: number;
  cargo: number;
}

export interface Chokepoint extends FlowAssessment {
  id: string;
  name: string;
  lat: number;
  lng: number;
  series: SeriesPoint[];
  /** Disruptions in this response whose `affectedPorts` name this chokepoint. */
  disruptionIds: string[];
}

export interface Disruption {
  id: string;
  eventId: number;
  type: string;
  typeLabel: string;
  name: string;
  alertLevel: string | null;
  country: string | null;
  fromDate: string | null;
  toDate: string | null;
  active: boolean;
  severity: string | null;
  lat: number;
  lng: number;
  affectedPorts: string[];
  source: string;
}

// GDACS hazard codes, which PortWatch reuses.
const EVENT_TYPES: Record<string, string> = {
  EQ: 'Earthquake',
  TC: 'Tropical cyclone',
  FL: 'Flood',
  VO: 'Volcano',
  DR: 'Drought',
  WF: 'Wildfire',
  TS: 'Tsunami',
  OT: 'Other',
};

function num(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function validPosition(lat: number | null, lng: number | null): lat is number {
  return lat != null && lng != null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

function isoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** DateOnly arrives as "YYYY-MM-DD"; older ArcGIS hosts send epoch ms instead. */
function dayOf(value: unknown): string | null {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const ms = num(value);
  return ms == null ? null : isoDay(ms);
}

export function queryUrl(layer: string, params: Record<string, string | number>): string {
  const qs = new URLSearchParams({ f: 'json', returnGeometry: 'false' });
  for (const [k, v] of Object.entries(params)) qs.set(k, String(v));
  return `${PORTWATCH_BASE}/${layer}/FeatureServer/0/query?${qs}`;
}

export function parseArcgisPage(json: unknown): { rows: Attrs[]; more: boolean } {
  const j = json as { error?: { code?: number; message?: string }; features?: { attributes?: Attrs }[]; exceededTransferLimit?: boolean } | null;
  if (j?.error) throw new Error(`PortWatch: ${j.error.message ?? 'query failed'} (${j.error.code ?? '?'})`);
  if (!Array.isArray(j?.features)) throw new Error('PortWatch: unexpected query response');
  return {
    rows: j.features.flatMap(f => (f?.attributes ? [f.attributes] : [])),
    more: j.exceededTransferLimit === true,
  };
}

export function toChokepointRef(a: Attrs): ChokepointRef | null {
  const id = str(a.portid);
  const lat = num(a.lat);
  const lng = num(a.lon);
  if (!id || !validPosition(lat, lng)) return null;
  return { id, name: str(a.portname) ?? str(a.fullname) ?? id, lat, lng: lng! };
}

export function toDailyRow(a: Attrs): { portId: string; transit: DailyTransit } | null {
  const portId = str(a.portid);
  const date = dayOf(a.date);
  const total = num(a.n_total);
  if (!portId || !date || total == null) return null;
  return {
    portId,
    transit: {
      date,
      total,
      tanker: num(a.n_tanker) ?? 0,
      cargo: num(a.n_cargo) ?? 0,
      tankerCapacity: num(a.capacity_tanker) ?? 0,
    },
  };
}

export function groupDaily(rows: Attrs[]): Map<string, DailyTransit[]> {
  const byPort = new Map<string, DailyTransit[]>();
  for (const row of rows) {
    const r = toDailyRow(row);
    if (!r) continue;
    const list = byPort.get(r.portId) ?? [];
    list.push(r.transit);
    byPort.set(r.portId, list);
  }
  for (const list of byPort.values()) list.sort((a, b) => a.date.localeCompare(b.date));
  return byPort;
}

export function toDisruption(a: Attrs, now: number): Disruption | null {
  const eventId = num(a.eventid);
  const lat = num(a.lat);
  const lng = num(a.long);
  if (eventId == null || !validPosition(lat, lng)) return null;
  const from = num(a.fromdate);
  const to = num(a.todate);
  const type = str(a.eventtype)?.toUpperCase() ?? 'OT';
  return {
    id: `portwatch-${eventId}`,
    eventId,
    type,
    typeLabel: EVENT_TYPES[type] ?? type,
    name: str(a.eventname) ?? `Event ${eventId}`,
    alertLevel: str(a.alertlevel)?.toUpperCase() ?? null,
    country: str(a.country),
    fromDate: from == null ? null : new Date(from).toISOString(),
    toDate: to == null ? null : new Date(to).toISOString(),
    active: to == null || to > now,
    severity: str(a.severitytext),
    lat,
    lng: lng!,
    affectedPorts: (str(a.affectedports) ?? '').split(';').map(s => s.trim()).filter(Boolean),
    source: PORTWATCH_SITE,
  };
}

/** Open events, plus those that ended within the last 30 days. */
export function isCurrentDisruption(d: Disruption, now: number): boolean {
  return d.active || (d.toDate != null && now - Date.parse(d.toDate) <= ENDED_WITHIN_DAYS * DAY_MS);
}

export function parseDisruptions(rows: Attrs[], now: number): Disruption[] {
  return rows
    .map(r => toDisruption(r, now))
    .filter((d): d is Disruption => d !== null && isCurrentDisruption(d, now))
    .sort((a, b) => Number(b.active) - Number(a.active) || (b.fromDate ?? '').localeCompare(a.fromDate ?? ''));
}

export function buildChokepoints(
  refs: ChokepointRef[],
  daily: Map<string, DailyTransit[]>,
  disruptions: Disruption[],
): Chokepoint[] {
  return refs
    .map(ref => {
      const transits = daily.get(ref.id) ?? [];
      const flow = assessFlow(transits);
      const cutoff = flow.latestDate ? isoDay(Date.parse(`${flow.latestDate}T00:00:00Z`) - (SERIES_DAYS - 1) * DAY_MS) : '';
      return {
        id: ref.id,
        name: ref.name,
        lat: ref.lat,
        lng: ref.lng,
        ...flow,
        series: transits
          .filter(t => t.date >= cutoff)
          .map(({ date, total, tanker, cargo }) => ({ date, total, tanker, cargo })),
        disruptionIds: disruptions.filter(d => d.affectedPorts.includes(ref.id)).map(d => d.id),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function dailyQuery(now: number): Record<string, string> {
  return {
    where: `date >= DATE '${isoDay(now - HISTORY_DAYS * DAY_MS)}'`,
    outFields: 'date,portid,portname,n_tanker,n_cargo,n_total,capacity_tanker',
    // Newest first, so a page cap would cost baseline days rather than the latest week.
    orderByFields: 'date DESC,portid',
  };
}

export function disruptionsQuery(now: number): Record<string, string> {
  const since = new Date(now - ENDED_WITHIN_DAYS * DAY_MS).toISOString().slice(0, 19).replace('T', ' ');
  return {
    where: `todate IS NULL OR todate >= TIMESTAMP '${since}'`,
    outFields: 'eventid,eventtype,eventname,alertlevel,country,fromdate,todate,severitytext,lat,long,affectedports',
    orderByFields: 'fromdate DESC',
  };
}

export const CHOKEPOINTS_QUERY = { where: '1=1', outFields: 'portid,portname,fullname,lat,lon', orderByFields: 'portid' };

export type FetchJson = (url: string) => Promise<unknown>;

const getJson: FetchJson = url => httpJson<unknown>(url, { timeoutMs: 30_000 });

/** Every row of a query, one page at a time. */
export async function fetchAllRows(layer: string, params: Record<string, string>, fetchJson: FetchJson = getJson): Promise<Attrs[]> {
  const rows: Attrs[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const { rows: got, more } = parseArcgisPage(
      await fetchJson(queryUrl(layer, { ...params, resultOffset: rows.length, resultRecordCount: PAGE_SIZE })),
    );
    rows.push(...got);
    if (!more || !got.length) return rows;
  }
  console.warn(`[TAKIP] PortWatch ${layer}: stopped after ${MAX_PAGES} pages`);
  return rows;
}
