import { describe, expect, it } from 'vitest';
import {
  decodeField, encodeField, fieldFromGrid, fieldTileUrl, renderTemperatureTile, temperatureAt, temperatureColor, weatherLabel,
  type TemperatureField, type WeatherGrid,
} from './weather-field';

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

const field = (temp: (row: number, col: number) => number | null) => fieldFromGrid(grid(temp));

describe('temperatureAt', () => {
  it('returns the grid value on a grid point', () => {
    expect(temperatureAt(field((r, c) => r * 10 + c), 0, -90)).toBe(11);
  });

  it('interpolates between rows and columns', () => {
    const g = field((r, c) => r * 10 + c);
    expect(temperatureAt(g, 5, -90)).toBeCloseTo(16);
    expect(temperatureAt(g, 0, -45)).toBeCloseTo(11.5);
  });

  it('wraps across the antimeridian instead of stopping at the last column', () => {
    const g = field((_, c) => (c === 3 ? 30 : c === 0 ? 10 : 0));
    // Halfway from 90° (30) east to 180°/−180° (10).
    expect(temperatureAt(g, 0, 135)).toBeCloseTo(20);
    expect(temperatureAt(g, 0, -225)).toBeCloseTo(20);
  });

  it('holds the outer row beyond the grid rather than extrapolating', () => {
    const g = field(r => r * 10);
    expect(temperatureAt(g, 80, 0)).toBe(20);
    expect(temperatureAt(g, -80, 0)).toBe(0);
  });

  it('re-weights around a missing value instead of leaving a hole', () => {
    const g = field((r, c) => (r === 1 && c === 1 ? null : 5));
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
    const px = renderTemperatureTile(field(() => 15), 0, 0, 0, 8);
    expect(px.length).toBe(8 * 8 * 4);
    for (let i = 3; i < px.length; i += 4) expect(px[i]).toBe(255);
  });
});

describe('fieldTileUrl', () => {
  it('changes with the forecast hour so MapLibre refetches the tiles', () => {
    const a = fieldTileUrl(field(() => 0));
    const b = fieldTileUrl({ ...field(() => 0), time: '2026-10-11T18:00:00.000Z' });
    expect(a).toContain('{z}/{x}/{y}');
    expect(a).not.toBe(b);
  });
});

describe('north-to-south fields', () => {
  it('samples rows that run from the pole down, as GFS does', () => {
    const f: TemperatureField = {
      time: 't', lat0: 90, dLat: -0.25, lng0: 0, dLng: 0.25, rows: 721, cols: 1440,
      values: Float32Array.from({ length: 721 * 1440 }, (_, i) => 90 - 0.25 * Math.floor(i / 1440)),
    };
    expect(temperatureAt(f, 41.1, 29)).toBeCloseTo(41.1, 4);
    expect(temperatureAt(f, -60, -0.1)).toBeCloseTo(-60, 4);
  });
});

describe('encodeField / decodeField', () => {
  it('round-trips to a tenth of a degree, gaps included', () => {
    const f: TemperatureField = {
      time: '2026-10-12T15:00:00.000Z', lat0: 90, dLat: -45, lng0: 0, dLng: 90, rows: 5, cols: 4,
      values: Float32Array.from([-89.96, 57.04, NaN, 12.3, 0, NaN, NaN, -0.04, 30, -30, 25.55, 1, 2, 3, 4, 5, 6, 7, 8, 9]),
    };
    const bytes = encodeField(f);
    const back = decodeField(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
    expect({ ...back, values: undefined }).toEqual({ ...f, values: undefined });
    f.values.forEach((v, i) => {
      if (Number.isNaN(v)) expect(back.values[i]).toBeNaN();
      else expect(back.values[i]).toBeCloseTo(Math.round(v * 10) / 10, 5);
    });
  });

  it('refuses a body that does not hold the grid it declares', () => {
    const bytes = encodeField({ time: 't', lat0: 0, dLat: 1, lng0: 0, dLng: 1, rows: 2, cols: 2, values: new Float32Array(4) });
    expect(() => decodeField(bytes.buffer.slice(0, bytes.length - 2) as ArrayBuffer)).toThrow(/3 of 4/);
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
