import { describe, expect, it } from 'vitest';
import { labelStep, placeTemperatureLabels, temperatureLabels, type LabelPlace } from './temperature-labels';
import type { TemperatureField } from './weather-field';

// A 0.25° global field whose value is the latitude, so a reading is easy to check.
const rows = 721, cols = 1440;
const field: TemperatureField = {
  time: '2026-10-14T06:00:00.000Z', lat0: 90, dLat: -0.25, lng0: 0, dLng: 0.25, rows, cols,
  values: Float32Array.from({ length: rows * cols }, (_, i) => 90 - Math.floor(i / cols) * 0.25),
};
const coords = (fs: ReturnType<typeof temperatureLabels>) => fs.map(f => f.geometry.coordinates);
const place = (name: string, cls: string, rank: number, lng = -74, lat = 40.75): LabelPlace => ({ name, cls, rank, lng, lat });

describe('placeTemperatureLabels', () => {
  it('puts a reading on each place name, converted to the unit', () => {
    const [f] = placeTemperatureLabels(field, [place('New York', 'city', 1)], 'f', 'gfs');
    expect(f.geometry.coordinates).toEqual([-74, 40.75]);
    expect(f.properties).toMatchObject({ temp: 40.8, shownTemp: 105, place: 'New York', source: 'gfs', hour: '06:00 UTC' });
  });

  it('keeps the biggest places, drops repeats and non-places, and stops at 25', () => {
    const towns = Array.from({ length: 40 }, (_, i) => place(`Town ${i}`, 'town', 10, -74 + i * 0.3));
    const out = placeTemperatureLabels(field, [
      ...towns, place('Newark', 'city', 4, -74.17), place('New York', 'city', 1), place('New York', 'city', 1, -74.01), place('New Jersey', 'state', 1),
    ], 'c', 'gfs');
    expect(out).toHaveLength(25);
    expect(out.slice(0, 2).map(f => f.properties?.place)).toEqual(['New York', 'Newark']);
    expect(out.some(f => f.properties?.place === 'New Jersey')).toBe(false);
  });
});

describe('temperatureLabels', () => {
  it('spaces zoomed-out readings in round steps', () => {
    expect(labelStep(1.5)).toBe(30);
    expect(labelStep(3)).toBe(15);
  });

  it('anchors readings to the step, not the view, so turning the globe keeps them in place', () => {
    const a = coords(temperatureLabels(field, { west: -100, south: -40, east: 0, north: 60 }, 2.5, 'c', 'gfs'));
    const b = coords(temperatureLabels(field, { west: -93, south: -33, east: 7, north: 67 }, 2.5, 'c', 'gfs'));
    expect(a.filter(([x, y]) => b.some(([u, v]) => u === x && v === y)).length).toBeGreaterThan(a.length / 2);
  });

  it('wraps the globe’s bounds into ±180 without doubling the antimeridian', () => {
    const world = coords(temperatureLabels(field, { west: -200, south: -90, east: 200, north: 90 }, 1, 'c', 'gfs'));
    expect(world.every(([x, y]) => x >= -180 && x < 180 && Math.abs(y) <= 85)).toBe(true);
    expect(new Set(world.map(c => c.join())).size).toBe(world.length);
  });

  it('gives up on bounds it cannot read', () => {
    expect(temperatureLabels(field, { west: NaN, south: 0, east: 10, north: 10 }, 2, 'c', 'gfs')).toEqual([]);
  });
});
