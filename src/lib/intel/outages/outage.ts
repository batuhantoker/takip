import { centroidFor } from '@/lib/places/country-centroids';

/**
 * One outage pin, whichever source reported it. Pinned at the country's centroid: neither source here says
 * where in the country it was.
 */
export interface Outage {
  id: string;
  source: 'cloudflare' | 'ioda';
  /** annotation: Cloudflare confirmed and described it; anomaly: Cloudflare's detector saw a drop; signal: IODA's did. */
  kind: 'annotation' | 'anomaly' | 'signal';
  lat: number;
  lng: number;
  country: string;
  country_name: string;
  /** The networks hit ("AS3215 Orange S.A."), when it was a network's outage rather than the whole country's. */
  network: string | null;
  scope: string;
  cause: string;
  description: string;
  start: string;
  end: string | null;
  ongoing: boolean;
  url: string;
  /** Which measurements showed it: HTTP and NET for Cloudflare, BGP, active probing, telescope or Google traffic for IODA. */
  seen_in: string[];
}

export function placeOutage(code: string | undefined, fields: Omit<Outage, 'lat' | 'lng' | 'country'>): Outage | null {
  const c = centroidFor(code);
  return c ? { ...fields, country: code!.toUpperCase(), lng: c[0], lat: c[1] } : null;
}

const time = (iso: string | null) => (iso ? Date.parse(iso) : NaN);

/**
 * Both sources together, without a second pin where they saw the same thing: an IODA signal is left out when a
 * Cloudflare report for its country overlaps it in time.
 */
export function mergeOutages(cloudflare: Outage[], ioda: Outage[], now: number): Outage[] {
  const overlaps = (a: Outage, b: Outage) =>
    time(a.start) <= (time(b.end) || now) && time(b.start) <= (time(a.end) || now);
  return [...cloudflare, ...ioda.filter(s => !cloudflare.some(o => o.country === s.country && overlaps(o, s)))];
}
