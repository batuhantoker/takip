import { describe, expect, it } from 'vitest';
import { OVATION_URL, parseOvation } from './ovation';

// The shape of ovation_aurora_latest.json, 2026-10-12: a full 360 × 181 grid of [lon 0–359, lat, %].
function grid(set: Record<string, number> = {}) {
  const coordinates: number[][] = [];
  for (let lon = 0; lon < 360; lon++) for (let lat = -90; lat <= 90; lat++) coordinates.push([lon, lat, set[`${lon},${lat}`] ?? 0]);
  return { 'Observation Time': '2026-10-12T20:22:00Z', 'Forecast Time': '2026-10-12T21:24:00Z', 'Data Format': '[Longitude, Latitude, Aurora]', coordinates, type: 'MultiPoint' };
}

describe('parseOvation', () => {
  it('keeps cells at or above the floor, with longitudes in −180…180', () => {
    const g = parseOvation(grid({ '10,65': 12, '350,70': 5, '20,66': 4 }));
    expect(g).toEqual({
      observed_at: '2026-10-12T20:22:00Z',
      forecast_at: '2026-10-12T21:24:00Z',
      cells: [[10, 65, 12], [-10, 70, 5]],
      max_pct: 12,
    });
  });

  it('throws on a partial grid', () => {
    expect(() => parseOvation({ coordinates: [[0, 0, 1]] })).toThrow();
    expect(() => parseOvation(null)).toThrow();
  });
});

const liveIt = process.env.RUN_LIVE_TESTS === '1' ? it : it.skip;
liveIt('reads the live nowcast', async () => {
  const res = await fetch(OVATION_URL, { signal: AbortSignal.timeout(20_000) });
  const g = parseOvation(await res.json());
  expect(g.max_pct).toBeGreaterThan(0);
  expect(g.observed_at).toMatch(/^\d{4}-/);
}, 30_000);
