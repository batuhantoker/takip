import { describe, expect, it } from 'vitest';
import type { Place } from '../place';
import { inBox, quakesNow, type RangeQuake } from './hazards-now';

const q = (lng: number, lat: number, magnitude: number, time: number): RangeQuake => ({ lng, lat, magnitude, time, place: `${lng},${lat}`, url: '' });
const place = (kind: Place['kind'], at: [number, number]): Place => ({ id: 1, kind, slug: 'x', name: 'X', cc: 'TR', at, pop: 1 });
const QUAKES = [q(37, 37.2, 5.1, 3), q(36.2, 36.2, 4.6, 5), q(10, 50, 6, 4), q(179.5, -17, 4.9, 1)];

describe('quakesNow', () => {
  it('keeps a country’s quakes inside its box, across the antimeridian too', () => {
    expect(inBox([177, -19, -178, -16], 179.5, -17)).toBe(true);
    expect(inBox([177, -19, -178, -16], 170, -17)).toBe(false);
    const now = quakesNow(QUAKES, place('country', [35, 39]), [25.7, 35.8, 44.8, 42.1], 100);
    expect(now).toMatchObject({ n: 2, latest: { m: 4.6, time: 5 }, strongest: { m: 5.1, time: 3 } });
    expect(now.km).toBeUndefined();
  });

  it('keeps a city’s within its reach, and says how far', () => {
    expect(quakesNow(QUAKES, place('city', [36.16, 36.2]), [0, 0, 0, 0], 100)).toMatchObject({ n: 1, km: 100, latest: { m: 4.6 } });
  });
});
