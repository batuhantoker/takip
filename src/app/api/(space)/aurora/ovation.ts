/**
 * TAKIP — NOAA SWPC OVATION aurora nowcast, no key; US public domain.
 * A 1° grid (360 × 181) of the probability (%) that aurora is visible overhead, about 30 minutes ahead.
 * It ignores cloud and daylight, and a quiet night peaks near 20%, so a 50% floor would show nothing:
 * cells below 5% are dropped.
 */

export const OVATION_URL = 'https://services.swpc.noaa.gov/json/ovation_aurora_latest.json';
export const AURORA_FLOOR_PCT = 5;

export interface AuroraGrid {
  observed_at: string | null;
  forecast_at: string | null;
  /** [lng −180…180, lat, probability %] for every cell at or above the floor. */
  cells: [number, number, number][];
  max_pct: number;
}

export function parseOvation(json: unknown, floor = AURORA_FLOOR_PCT): AuroraGrid {
  const d = json as { 'Observation Time'?: string; 'Forecast Time'?: string; coordinates?: unknown } | null;
  if (!Array.isArray(d?.coordinates) || d.coordinates.length < 60_000) throw new Error('OVATION: unexpected grid');
  const cells: [number, number, number][] = [];
  let max = 0;
  for (const c of d.coordinates) {
    if (!Array.isArray(c)) continue;
    const [lon, lat, p] = c as number[];
    if (![lon, lat, p].every(Number.isFinite)) continue;
    if (p > max) max = p;
    if (p < floor) continue;
    cells.push([lon > 180 ? lon - 360 : lon, lat, p]);
  }
  return { observed_at: d['Observation Time'] ?? null, forecast_at: d['Forecast Time'] ?? null, cells, max_pct: max };
}
