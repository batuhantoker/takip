/**
 * Finding aircraft in the flights feed (/api/flights) by what a person types: a callsign (THY1), a flight number
 * (TK1, TK 0001), a registration (TC-JJE), an ICAO 24-bit address (4bb1c2) or an airline's name (Turkish).
 */

import { haversine } from '@/lib/core/geodesic';
import { AIRLINES } from './airlines.generated';

/** Where the feed keeps each kind of aircraft. */
export const FLIGHT_BUCKETS = ['commercial_flights', 'private_flights', 'private_jets', 'military_flights'] as const;
export type FlightBucket = (typeof FLIGHT_BUCKETS)[number];

export type FlightMatch = 'callsign' | 'flight' | 'registration' | 'icao24' | 'airline';

export interface FlightHit {
  icao24: string;
  callsign: string | null;
  registration: string | null;
  model: string | null;
  /** The operator, read off the callsign's ICAO airline prefix. */
  airline: string | null;
  lat: number;
  lng: number;
  /** Metres. */
  alt: number | null;
  grounded: boolean;
  bucket: FlightBucket;
  match: FlightMatch;
  /** The whole callsign, flight number, registration or address, not just its start. */
  exact: boolean;
}

interface Row {
  icao24?: string;
  callsign?: string;
  registration?: string;
  model?: string;
  lat?: number;
  lng?: number;
  alt?: number;
  grounded?: boolean;
}

const squash = (s: string) => s.toUpperCase().replace(/[\s-]/g, '');
/** THY001 and THY1 are the same flight. */
const canon = (callsign: string) => callsign.replace(/^([A-Z]{3})0+(?=\d)/, '$1');
const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

let index: { byIata: Map<string, string[]>; name: Map<string, string>; words: [icao: string, name: string][] } | null = null;
function airlines() {
  if (index) return index;
  const byIata = new Map<string, string[]>();
  const name = new Map<string, string>();
  for (const [iata, icao, label] of AIRLINES) {
    byIata.set(iata, [...(byIata.get(iata) ?? []), icao]);
    if (!name.has(icao)) name.set(icao, label);
  }
  index = { byIata, name, words: [...name].map(([icao, label]) => [icao, ` ${fold(label)}`]) };
  return index;
}

/** The ICAO airline prefix of an airline-style callsign (THY1 → THY). */
const prefixOf = (callsign: string) => /^([A-Z]{3})\d/.exec(callsign)?.[1] ?? null;

export const airlineName = (callsign: string): string | null => {
  const icao = prefixOf(callsign);
  return icao ? airlines().name.get(icao) ?? null : null;
};

/** The callsigns a flight number could fly under: TK1 → THY1; PC1 → PGT1, FAJ1, … */
function flightCallsigns(q: string): string[] {
  const m = /^([A-Z0-9]{2})(\d{1,4}[A-Z]?)$/.exec(q);
  if (!m || !/[A-Z]/.test(m[1])) return [];
  return (airlines().byIata.get(m[1]) ?? []).map(icao => canon(icao + m[2]));
}

/** The ICAO prefixes of airlines whose name has a word starting with the query ("turkish", "aer ling"). */
function namedAirlines(raw: string): Set<string> {
  const q = fold(raw.trim()).replace(/\s+/g, ' ');
  if (q.length < 3 || !/\p{L}/u.test(q)) return new Set();
  return new Set(airlines().words.filter(([, name]) => name.includes(` ${q}`)).map(([icao]) => icao));
}

/**
 * The aircraft that match, best first: a whole callsign, flight number, registration or address, then ones that
 * start with what was typed, then an airline's fleet. Ties go to aircraft in the air, then to those nearest `near`.
 */
export function searchFlights(feed: Record<string, unknown>, query: string, { limit = 8, near }: { limit?: number; near?: { lat: number; lng: number } | null } = {}): { hits: FlightHit[]; total: number } {
  const q = squash(query);
  if (q.length < 2 || q.length > 40) return { hits: [], total: 0 };
  const callsign = canon(q);
  const flights = new Set(flightCallsigns(q));
  const hex = /^[0-9A-F]{6}$/.test(q) ? q.toLowerCase() : null;
  // Two characters are an airline's code (TK) or nothing worth listing.
  const byCode = q.length === 2 ? new Set(airlines().byIata.get(q) ?? []) : new Set<string>();
  const byName = namedAirlines(query);

  const scored: { hit: FlightHit; score: number; km: number }[] = [];
  const seen = new Set<string>();
  for (const bucket of FLIGHT_BUCKETS) {
    const rows = feed[bucket];
    if (!Array.isArray(rows)) continue;
    for (const row of rows as Row[]) {
      const id = row?.icao24?.toLowerCase();
      if (!id || seen.has(id) || typeof row.lat !== 'number' || typeof row.lng !== 'number') continue;
      // The feed falls back to the address, or UNKNOWN, when an aircraft sends no callsign; and to N/A for no registration.
      const cs = row.callsign && row.callsign !== 'UNKNOWN' && row.callsign.toLowerCase() !== id ? canon(squash(row.callsign)) : '';
      const reg = row.registration && row.registration !== 'N/A' ? squash(row.registration) : '';
      const prefix = cs ? prefixOf(cs) : null;

      let score = 0, match: FlightMatch = 'callsign';
      if (cs && cs === callsign) score = 100;
      else if (cs && flights.has(cs)) { score = 99; match = 'flight'; }
      else if (reg && reg === q) { score = 95; match = 'registration'; }
      else if (hex && id === hex) { score = 90; match = 'icao24'; }
      else if (cs && q.length >= 3 && cs.startsWith(callsign)) score = 60;
      else if (cs && [...flights].some(f => cs.startsWith(f))) { score = 55; match = 'flight'; }
      else if (reg && q.length >= 3 && reg.startsWith(q)) { score = 50; match = 'registration'; }
      else if (prefix && (byCode.has(prefix) || byName.has(prefix))) { score = 40; match = 'airline'; }
      if (!score) continue;

      seen.add(id);
      scored.push({
        score,
        km: near ? haversine([near.lng, near.lat], [row.lng, row.lat]) : 0,
        hit: {
          icao24: id,
          callsign: cs || null,
          registration: row.registration && row.registration !== 'N/A' ? row.registration : null,
          model: row.model && row.model !== 'Unknown' ? row.model : null,
          airline: prefix ? airlines().name.get(prefix) ?? null : null,
          lat: row.lat,
          lng: row.lng,
          alt: typeof row.alt === 'number' ? row.alt : null,
          grounded: !!row.grounded,
          bucket,
          match,
          exact: score >= 90,
        },
      });
    }
  }
  scored.sort((a, b) => b.score - a.score || Number(a.hit.grounded) - Number(b.hit.grounded) || a.km - b.km
    || (a.hit.callsign ?? '').localeCompare(b.hit.callsign ?? ''));
  return { hits: scored.slice(0, limit).map(s => s.hit), total: scored.length };
}
