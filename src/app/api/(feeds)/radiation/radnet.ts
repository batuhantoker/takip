/**
 * TAKIP — EPA RadNet fixed gamma monitors, no key. US public domain.
 *
 * One CSV per monitor per year, hourly approved readings in nSv/h, UTC
 * timestamps (`MM/DD/YYYY HH:MM:SS`). There is no station index or Range
 * support, so each refresh downloads the whole year file (~0.6 MB) per monitor;
 * the list below is a curated spread, not the full ~140-monitor network.
 * Some monitors stop reporting for months (NYC since 2026-07), so the latest
 * reading's age decides OFFLINE, never the HTTP status. Denver publishes gamma
 * counts with an empty dose column, so it is left out.
 */

import type { RadiationStation, RadiationStatus } from './types';

export interface RadnetMonitor {
  state: string;
  /** The location name exactly as the CSV path spells it. */
  site: string;
  city: string;
  /** City centre; RadNet publishes no monitor coordinates. */
  lat: number;
  lng: number;
}

export const RADNET_MONITORS: RadnetMonitor[] = [
  { state: 'AK', site: 'FAIRBANKS', city: 'Fairbanks', lat: 64.8378, lng: -147.7164 },
  { state: 'AZ', site: 'PHOENIX', city: 'Phoenix', lat: 33.4484, lng: -112.074 },
  { state: 'CA', site: 'LOS ANGELES', city: 'Los Angeles', lat: 34.0522, lng: -118.2437 },
  { state: 'CA', site: 'SAN FRANCISCO', city: 'San Francisco', lat: 37.7749, lng: -122.4194 },
  { state: 'CA', site: 'SAN DIEGO', city: 'San Diego', lat: 32.7157, lng: -117.1611 },
  { state: 'DC', site: 'WASHINGTON', city: 'Washington', lat: 38.9072, lng: -77.0369 },
  { state: 'FL', site: 'JACKSONVILLE', city: 'Jacksonville', lat: 30.3322, lng: -81.6557 },
  { state: 'FL', site: 'TAMPA', city: 'Tampa', lat: 27.9506, lng: -82.4572 },
  { state: 'GA', site: 'ATLANTA', city: 'Atlanta', lat: 33.749, lng: -84.388 },
  { state: 'HI', site: 'HONOLULU', city: 'Honolulu', lat: 21.3069, lng: -157.8583 },
  { state: 'ID', site: 'IDAHO FALLS', city: 'Idaho Falls', lat: 43.4917, lng: -112.0339 },
  { state: 'IL', site: 'CHICAGO', city: 'Chicago', lat: 41.8781, lng: -87.6298 },
  { state: 'LA', site: 'BATON ROUGE', city: 'Baton Rouge', lat: 30.4515, lng: -91.1871 },
  { state: 'MA', site: 'BOSTON', city: 'Boston', lat: 42.3601, lng: -71.0589 },
  { state: 'MI', site: 'DETROIT', city: 'Detroit', lat: 42.3314, lng: -83.0458 },
  { state: 'MN', site: 'ST. PAUL', city: 'St. Paul', lat: 44.9537, lng: -93.09 },
  { state: 'MO', site: 'JEFFERSON CITY', city: 'Jefferson City', lat: 38.5767, lng: -92.1735 },
  { state: 'MT', site: 'KALISPELL', city: 'Kalispell', lat: 48.1958, lng: -114.3129 },
  { state: 'NE', site: 'OMAHA', city: 'Omaha', lat: 41.2565, lng: -95.9345 },
  { state: 'NM', site: 'CARLSBAD', city: 'Carlsbad', lat: 32.4207, lng: -104.2288 },
  { state: 'NY', site: 'NYC (EML)', city: 'New York', lat: 40.7128, lng: -74.006 },
  { state: 'NY', site: 'SYRACUSE', city: 'Syracuse', lat: 43.0481, lng: -76.1474 },
  { state: 'OH', site: 'COLUMBUS', city: 'Columbus', lat: 39.9612, lng: -82.9988 },
  { state: 'OK', site: 'TULSA', city: 'Tulsa', lat: 36.154, lng: -95.9928 },
  { state: 'OR', site: 'CORVALLIS', city: 'Corvallis', lat: 44.5646, lng: -123.262 },
  { state: 'PR', site: 'SAN JUAN', city: 'San Juan', lat: 18.4655, lng: -66.1057 },
  { state: 'TN', site: 'MEMPHIS', city: 'Memphis', lat: 35.1495, lng: -90.049 },
  { state: 'TX', site: 'EL PASO', city: 'El Paso', lat: 31.7619, lng: -106.485 },
  { state: 'TX', site: 'HOUSTON', city: 'Houston', lat: 29.7604, lng: -95.3698 },
  { state: 'WA', site: 'RICHLAND', city: 'Richland', lat: 46.2856, lng: -119.2845 },
  { state: 'WY', site: 'CASPER', city: 'Casper', lat: 42.8666, lng: -106.3131 },
];

export function radnetUrl(m: Pick<RadnetMonitor, 'state' | 'site'>, year: number): string {
  return `https://radnet.epa.gov/cdx-radnet-rest/api/rest/csv/${year}/fixed/${m.state}/${encodeURIComponent(m.site)}`;
}

export interface RadnetReading {
  t: number;
  nsvh: number;
}

/** `MM/DD/YYYY HH:MM:SS` in UTC → epoch ms. */
export function parseRadnetTime(s: string): number | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const t = Date.UTC(+m[3], +m[1] - 1, +m[2], +m[4], +m[5], +m[6]);
  return Number.isFinite(t) ? t : null;
}

/** Approved dose-rate rows, oldest first. Throws when the header isn't RadNet's. */
export function parseRadnetCsv(csv: string): RadnetReading[] {
  const lines = csv.split(/\r?\n/);
  const header = (lines[0] ?? '').split(',');
  const tCol = header.indexOf('SAMPLE COLLECTION TIME');
  const vCol = header.findIndex(h => h.startsWith('DOSE EQUIVALENT RATE'));
  const sCol = header.indexOf('STATUS');
  if (tCol < 0 || vCol < 0) throw new Error('RadNet: unexpected CSV header');

  const out: RadnetReading[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',');
    if (cells.length <= vCol) continue;
    if (sCol >= 0 && cells[sCol]?.trim() !== 'APPROVED') continue;
    const t = parseRadnetTime(cells[tCol]);
    const nsvh = Number(cells[vCol]);
    if (t == null || !cells[vCol]?.trim() || !Number.isFinite(nsvh) || nsvh < 0) continue;
    out.push({ t, nsvh });
  }
  return out.sort((a, b) => a.t - b.t);
}

export const BASELINE_WINDOW = 168;
export const MIN_BASELINE = 48;
/** Readings are whole nSv/h, so a flat week gives σ≈0 and a 1 nSv/h tick would read as z≥3. */
const MIN_SIGMA = 1;
export const OFFLINE_AFTER_MS = 6 * 3_600_000;

export interface Baseline {
  mean: number;
  sigma: number;
  samples: number;
}

/** Mean and σ of up to the 168 readings before the latest; null below 48. */
export function baselineOf(readings: RadnetReading[]): Baseline | null {
  const prior = readings.slice(-1 - BASELINE_WINDOW, -1);
  if (prior.length < MIN_BASELINE) return null;
  const mean = prior.reduce((s, r) => s + r.nsvh, 0) / prior.length;
  const variance = prior.reduce((s, r) => s + (r.nsvh - mean) ** 2, 0) / (prior.length - 1);
  return { mean, sigma: Math.sqrt(variance), samples: prior.length };
}

/** World Monitor's bands: spike at +15 nSv/h or z≥3, elevated at +8 or z≥2. */
export function classify(reading: number, base: Baseline | null): { status: RadiationStatus; delta?: number; z?: number } {
  if (!base) return { status: 'UNRATED' };
  const delta = reading - base.mean;
  const z = delta / Math.max(base.sigma, MIN_SIGMA);
  const round = (n: number) => Math.round(n * 10) / 10;
  const status: RadiationStatus = delta >= 15 || z >= 3 ? 'SPIKE' : delta >= 8 || z >= 2 ? 'ELEVATED' : 'NORMAL';
  return { status, delta: round(delta), z: round(z) };
}

export function toStation(m: RadnetMonitor, readings: RadnetReading[], now: number): RadiationStation | null {
  const latest = readings.at(-1);
  if (!latest) return null;
  const base = baselineOf(readings);
  const offline = now - latest.t > OFFLINE_AFTER_MS;
  const rated = classify(latest.nsvh, base);
  return {
    id: `radnet-${m.state}-${m.site}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, ''),
    name: `RadNet ${m.city}`,
    city: `${m.city}, ${m.state}`,
    country: 'USA',
    lat: m.lat,
    lng: m.lng,
    reading: Math.round(latest.nsvh),
    time: new Date(latest.t).toISOString(),
    status: offline ? 'OFFLINE' : rated.status,
    baseline: base ? Math.round(base.mean * 10) / 10 : undefined,
    delta: offline ? undefined : rated.delta,
    z: offline ? undefined : rated.z,
    network: 'EPA RadNet',
    source: 'https://www.epa.gov/radnet',
  };
}
