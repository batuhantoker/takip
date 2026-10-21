import { placeOutage, type Outage } from './outage';

/**
 * IODA, Georgia Tech's Internet Outage Detection and Analysis: /v2/outages/events per country, no key.
 * Data © Georgia Tech Research Corporation, all rights reserved; permission for the public site is pending.
 * Network (ASN) events are left out: they are mostly hosting, ad and cloud networks, not the ones people connect through.
 */

export interface RawIodaEvent {
  location?: string;
  location_name?: string;
  start?: number;
  duration?: number;
  datasource?: string;
  score?: number;
}

export const IODA_API = 'https://api.ioda.inetintel.cc.gatech.edu/v2';
export const IODA_WINDOW_S = 48 * 3600;
// IODA reports an event that is still running as ending where the window asked for ends.
const RUNNING_SLACK_S = 600;

const iso = (s: number) => new Date(s * 1000).toISOString();

/**
 * One pin per country with a drop that began inside the window, spanning all of that country's events. Older
 * events still open are left out: weeks-long ones are mostly a shifted baseline, and Cloudflare annotates real ones.
 */
export function mapIodaEvents(events: RawIodaEvent[], from: number, until: number): Outage[] {
  const byCountry = new Map<string, { name: string; start: number; end: number; seen: Set<string> }>();
  for (const e of events) {
    const code = e.location?.startsWith('country/') ? e.location.slice(8) : null;
    if (!code || typeof e.start !== 'number' || e.start < from) continue;
    const end = e.start + (e.duration ?? 0);
    const c = byCountry.get(code) ?? { name: e.location_name || code, start: e.start, end, seen: new Set<string>() };
    c.start = Math.min(c.start, e.start);
    c.end = Math.max(c.end, end);
    if (e.datasource) c.seen.add(e.datasource);
    byCountry.set(code, c);
  }
  return [...byCountry].flatMap(([code, c]) => {
    const ongoing = c.end >= until - RUNNING_SLACK_S;
    const pin = placeOutage(code, {
      id: `ioda-${code}-${c.start}`,
      source: 'ioda',
      kind: 'signal',
      country_name: c.name,
      network: null,
      scope: '',
      cause: '',
      description: '',
      start: iso(c.start),
      end: ongoing ? null : iso(c.end),
      ongoing,
      url: `https://ioda.inetintel.cc.gatech.edu/country/${code}`,
      seen_in: [...c.seen],
    });
    return pin ? [pin] : [];
  });
}
