import { describe, expect, it } from 'vitest';
import { nightPolygon } from './terminator';

describe('nightPolygon', () => {
  it('leaves the sub-solar meridian lit and darkens the antisolar one', () => {
    const ring = nightPolygon(0, 10);
    const at = (lng: number) => ring.find(p => p[0] === lng)![1];
    expect(at(0)).toBeCloseTo(-80, 6);
    expect(at(180)).toBeCloseTo(80, 6);
    expect(ring[ring.length - 1]).toEqual(ring[0]);
    expect(ring).toContainEqual([180, -90]);
  });

  it('closes around the north pole when the Sun is south', () => {
    expect(nightPolygon(40, -1.24)).toContainEqual([-180, 90]);
  });
});
