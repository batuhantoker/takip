/**
 * TAKIP — US airport ground stops, ground delays, arrival/departure delays and
 * closures from the FAA NAS Status feed (XML, ~2 kB), no key. US public domain.
 *
 * Gotchas:
 * - A quiet day is a root element with no Delay_type blocks: an empty list, not an outage.
 * - Delays are prose ("1 hour and 44 minutes"). Arrival/departure blocks give Min/Max only,
 *   so they are graded on the midpoint and carry no average.
 * - ARPT is an FAA code (the IATA code for airline airports); the feed has no coordinates.
 * - Most "closures" are months-long NOTAM restrictions ("AD AP CLSD TO NON SKED TRANSIENT
 *   GA ACFT"); only a closure not limited to a class of aircraft is graded severe.
 * - Times carry no year ("5:00 pm EDT", "May 27 at 18:26 UTC."). Exact dates come only
 *   from a closure NOTAM's YYMMDDHHMM-YYMMDDHHMM tail.
 */

import { httpText } from '@/lib/httpJson';
import { AIRPORTS_BY_IATA, AIRPORTS_BY_ICAO, type Airport } from '@/lib/flights/airports';

export const NAS_STATUS_URL = 'https://nasstatus.faa.gov/api/airport-status-information';
export const NAS_STATUS_SITE = 'https://nasstatus.faa.gov/';

export type DelayType = 'ground_stop' | 'ground_delay' | 'arrival_delay' | 'departure_delay' | 'closure';
export type DelaySeverity = 'minor' | 'moderate' | 'major' | 'severe';

export interface NasDelay {
  id: string;
  code: string;
  type: DelayType;
  severity: DelaySeverity;
  reason: string;
  avgDelayMin?: number;
  minDelayMin?: number;
  maxDelayMin?: number;
  trend?: string;
  /** FAA's own wording: a local clock time for ground stops, the reopening for closures. */
  endTime?: string;
  /** ISO, closures only, from the NOTAM's effective window. */
  startsAt?: string;
  endsAt?: string;
  /** A closure to some aircraft only (GA, oversize), not to airline traffic. */
  partial?: boolean;
  source: string;
}

export interface AirportDelay extends NasDelay {
  name?: string;
  lat: number;
  lng: number;
}

export interface NasStatus {
  updated: string | null;
  delays: NasDelay[];
  /** Delay_type blocks this parser does not know, for a log line. */
  unknownBlocks: string[];
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&(?:(amp|lt|gt|quot|apos)|#(\d+)|#x([0-9a-f]+));/gi, (_, name, dec, hex) =>
      name ? ENTITIES[name.toLowerCase()] : String.fromCodePoint(dec ? Number(dec) : parseInt(hex, 16)))
    .trim();
}

function elements(xml: string, tag: string): { attrs: string; body: string }[] {
  const re = new RegExp(`<${tag}(\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'g');
  return [...xml.matchAll(re)].map(m => ({ attrs: m[1] ?? '', body: m[2] }));
}

function text(xml: string, tag: string): string | null {
  const el = elements(xml, tag)[0];
  const value = el ? decode(el.body) : '';
  return value || null;
}

function attr(attrs: string, name: string): string | null {
  const m = attrs.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`));
  return m ? decode(m[1]) : null;
}

/** "56 minutes", "1 hour and 44 minutes", "2 hours" → minutes. */
export function parseMinutes(s: string | null | undefined): number | null {
  if (!s) return null;
  const h = s.match(/(\d+)\s*h(?:ou)?rs?\b/i);
  const m = s.match(/(\d+)\s*min/i);
  if (!h && !m) return null;
  return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
}

/** 15–24 min minor, 25–44 moderate, 45–59 major, 60+ severe; anything shorter the FAA lists is still minor. */
export function delaySeverity(minutes: number): DelaySeverity {
  if (minutes >= 60) return 'severe';
  if (minutes >= 45) return 'major';
  if (minutes >= 25) return 'moderate';
  return 'minor';
}

export function isPartialClosure(notam: string): boolean {
  return /\bCLSD\s+TO\s+(?!ALL\b)/i.test(notam);
}

function notamStamp(s: string): string | undefined {
  const [, yy, mo, dd, hh, mi] = s.match(/^(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)$/) ?? [];
  if (!yy) return undefined;
  const iso = `20${yy}-${mo}-${dd}T${hh}:${mi}:00.000Z`;
  return Number.isNaN(Date.parse(iso)) ? undefined : iso;
}

/** The effective window a NOTAM ends with: `2605271826-2705281600`, `…-PERM`, `…EST`. */
export function notamWindow(notam: string): { startsAt?: string; endsAt?: string } {
  const m = notam.match(/\b(\d{10})-(\d{10}|PERM)(?:EST)?\s*$/);
  if (!m) return {};
  return { startsAt: notamStamp(m[1]), endsAt: m[2] === 'PERM' ? undefined : notamStamp(m[2]) };
}

function clean(s: string | null): string | undefined {
  return s?.replace(/\.$/, '').trim() || undefined;
}

type Row = Omit<NasDelay, 'id' | 'source'>;

function groundStops(list: string): Row[] {
  return elements(list, 'Program').flatMap(({ body }) => {
    const code = text(body, 'ARPT');
    if (!code) return [];
    return [{ code, type: 'ground_stop' as const, severity: 'severe' as const, reason: text(body, 'Reason') ?? '', endTime: clean(text(body, 'End_Time')) }];
  });
}

function groundDelays(list: string): Row[] {
  return elements(list, 'Ground_Delay').flatMap(({ body }) => {
    const code = text(body, 'ARPT');
    if (!code) return [];
    const avg = parseMinutes(text(body, 'Avg'));
    const max = parseMinutes(text(body, 'Max'));
    return [{
      code,
      type: 'ground_delay' as const,
      severity: delaySeverity(avg ?? max ?? 0),
      reason: text(body, 'Reason') ?? '',
      avgDelayMin: avg ?? undefined,
      maxDelayMin: max ?? undefined,
    }];
  });
}

function arrivalDepartureDelays(list: string): Row[] {
  return elements(list, 'Delay').flatMap(({ body }) => {
    const code = text(body, 'ARPT');
    if (!code) return [];
    const reason = text(body, 'Reason') ?? '';
    return elements(body, 'Arrival_Departure').map(({ attrs, body: ad }): Row => {
      const min = parseMinutes(text(ad, 'Min'));
      const max = parseMinutes(text(ad, 'Max'));
      const mid = min != null && max != null ? (min + max) / 2 : min ?? max ?? 0;
      return {
        code,
        type: /^arr/i.test(attr(attrs, 'Type') ?? '') ? 'arrival_delay' : 'departure_delay',
        severity: delaySeverity(mid),
        reason,
        minDelayMin: min ?? undefined,
        maxDelayMin: max ?? undefined,
        trend: text(ad, 'Trend')?.toLowerCase(),
      };
    });
  });
}

function closures(list: string): Row[] {
  return elements(list, 'Airport').flatMap(({ body }) => {
    const code = text(body, 'ARPT');
    if (!code) return [];
    const reason = text(body, 'Reason') ?? '';
    const partial = isPartialClosure(reason);
    return [{
      code,
      type: 'closure' as const,
      severity: partial ? 'minor' as const : 'severe' as const,
      reason,
      endTime: clean(text(body, 'Reopen')),
      ...notamWindow(reason),
      partial,
    }];
  });
}

const LISTS: Record<string, ((list: string) => Row[]) | null> = {
  Ground_Stop_List: groundStops,
  Ground_Delay_List: groundDelays,
  Arrival_Departure_Delay_List: arrivalDepartureDelays,
  Airport_Closure_List: closures,
  // Airspace flow programmes regulate en-route airspace, not an airport.
  Airspace_Flow_List: null,
};

export function parseNasStatus(xml: string): NasStatus {
  const root = elements(xml, 'AIRPORT_STATUS_INFORMATION')[0];
  if (!root) throw new Error('FAA NAS: unexpected airport-status response');

  const updatedText = text(root.body, 'Update_Time');
  const updatedMs = updatedText ? Date.parse(updatedText) : NaN;
  const rows: Row[] = [];
  const unknownBlocks: string[] = [];

  for (const { body } of elements(root.body, 'Delay_type')) {
    const listTag = body.match(/<(\w+_List)\b/)?.[1];
    const handler = listTag ? LISTS[listTag] : undefined;
    if (handler) rows.push(...handler(body));
    else if (handler === undefined) unknownBlocks.push(text(body, 'Name') ?? listTag ?? 'unnamed');
  }

  const seen = new Map<string, number>();
  const delays = rows.map(row => {
    const code = row.code.toUpperCase();
    const base = `faa-${row.type}-${code}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return { id: n > 1 ? `${base}-${n}` : base, ...row, code, source: NAS_STATUS_SITE };
  });

  return { updated: Number.isNaN(updatedMs) ? null : new Date(updatedMs).toISOString(), delays, unknownBlocks };
}

const US_COUNTRIES = new Set(['US', 'PR', 'GU', 'VI', 'AS', 'MP']);

/** The local table only; an FAA code that is a foreign IATA code must not land abroad. */
export function placeAirport(code: string): Airport | null {
  const byIcao = AIRPORTS_BY_ICAO[`K${code}`];
  if (byIcao) return byIcao;
  const byIata = AIRPORTS_BY_IATA[code];
  return byIata && US_COUNTRIES.has(byIata.country) ? byIata : null;
}

const RANK: Record<DelaySeverity, number> = { severe: 3, major: 2, moderate: 1, minor: 0 };

export function placeDelays(
  delays: NasDelay[],
  place: (code: string) => Pick<Airport, 'name' | 'lat' | 'lng'> | null = placeAirport,
): { airports: AirportDelay[]; unplaced: NasDelay[] } {
  const airports: AirportDelay[] = [];
  const unplaced: NasDelay[] = [];
  for (const d of delays) {
    const ap = place(d.code);
    if (ap) airports.push({ ...d, name: ap.name, lat: ap.lat, lng: ap.lng });
    else unplaced.push(d);
  }
  airports.sort((a, b) => RANK[b.severity] - RANK[a.severity] || a.code.localeCompare(b.code));
  return { airports, unplaced };
}

export async function fetchNasStatus(): Promise<NasStatus> {
  return parseNasStatus(await httpText(NAS_STATUS_URL, { timeoutMs: 15_000, headers: { Accept: '*/*' } }));
}
