import { describe, expect, it } from 'vitest';
import { fieldTileUrl, renderTemperatureTile, temperatureAt, temperatureColor, weatherLabel, type WeatherGrid } from './weather-field';

/** A 3×4 grid (lat −10/0/10, lng −180/−90/0/90) with temperature = f(row, col). */
function grid(temp: (row: number, col: number) => number | null): WeatherGrid {
  const lats = [-10, 0, 10], lngs = [-180, -90, 0, 90];
  return {
    time: '2026-10-11T17:00:00.000Z', lats, lngs,
    points: lats.flatMap((lat, r) => lngs.map((lng, c) => ({
      lat, lng, temp: temp(r, c), wind: null, windDir: null, gust: null, precip: null, cloud: null, code: null,
    }))),
  };
}

describe('temperatureAt', () => {
  it('returns the grid value on a grid point', () => {
    expect(temperatureAt(grid((r, c) => r * 10 + c), 0, -90)).toBe(11);
  });

  it('interpolates between rows and columns', () => {
    const g = grid((r, c) => r * 10 + c);
    expect(temperatureAt(g, 5, -90)).toBeCloseTo(16);
    expect(temperatureAt(g, 0, -45)).toBeCloseTo(11.5);
  });

  it('wraps across the antimeridian instead of stopping at the last column', () => {
    const g = grid((_, c) => (c === 3 ? 30 : c === 0 ? 10 : 0));
    // Halfway from 90° (30) east to 180°/−180° (10).
    expect(temperatureAt(g, 0, 135)).toBeCloseTo(20);
    expect(temperatureAt(g, 0, -225)).toBeCloseTo(20);
  });

  it('holds the outer row beyond the grid rather than extrapolating', () => {
    const g = grid(r => r * 10);
    expect(temperatureAt(g, 80, 0)).toBe(20);
    expect(temperatureAt(g, -80, 0)).toBe(0);
  });

  it('re-weights around a missing value instead of leaving a hole', () => {
    const g = grid((r, c) => (r === 1 && c === 1 ? null : 5));
    expect(temperatureAt(g, 1, -80)).toBeCloseTo(5);
  });
});

describe('temperatureColor', () => {
  it('clamps at both ends of the ramp and blends between stops', () => {
    expect(temperatureColor(-90)).toEqual(temperatureColor(-40));
    expect(temperatureColor(90)).toEqual(temperatureColor(50));
    const [r] = temperatureColor(25);
    expect(r).toBeGreaterThan(240);
  });
});

describe('renderTemperatureTile', () => {
  it('paints every pixel of a world tile opaque', () => {
    const px = renderTemperatureTile(grid(() => 15), 0, 0, 0, 8);
    expect(px.length).toBe(8 * 8 * 4);
    for (let i = 3; i < px.length; i += 4) expect(px[i]).toBe(255);
  });
});

describe('fieldTileUrl', () => {
  it('changes with the forecast hour so MapLibre refetches the tiles', () => {
    const a = fieldTileUrl(grid(() => 0));
    const b = fieldTileUrl({ ...grid(() => 0), time: '2026-10-11T18:00:00.000Z' });
    expect(a).toContain('{z}/{x}/{y}');
    expect(a).not.toBe(b);
  });
});

describe('weatherLabel', () => {
  it('reads WMO codes', () => {
    expect(weatherLabel(0)).toBe('Clear sky');
    expect(weatherLabel(63)).toBe('Rain');
    expect(weatherLabel(96)).toBe('Thunderstorm');
    expect(weatherLabel(null)).toBe('Unknown');
  });
});
