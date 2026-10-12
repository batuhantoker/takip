import { describe, expect, it } from 'vitest';
import { matrix, poleQuat, toVec } from './plates';
import { createPlateModel, placeRing } from './reconstruct';

const xyz = (ring: [number, number][]) => Float64Array.from(ring.flatMap(([lon, lat]) => toVec(lon, lat)));
const IDENTITY = matrix([1, 0, 0, 0]);

describe('placeRing', () => {
  it('runs longitudes on across the antimeridian', () => {
    const ring = placeRing(xyz([[170, 0], [-170, 0], [-170, 10], [170, 10]]), IDENTITY);
    expect(ring.map(p => Math.round(p[0]))).toEqual([170, 190, 190, 170, 170]);
  });

  it('closes a ring round a pole over that pole', () => {
    const cap: [number, number][] = [0, 90, 180, 270].map(lon => [lon, -70]);
    const ring = placeRing(xyz(cap), IDENTITY);
    expect(ring.slice(-3).map(p => p[1])).toEqual([-90, -90, -70]);
  });

  it('turns a point on a pole into a stretch along it', () => {
    const ring = placeRing(xyz([[0, -60], [0, -90], [90, -60]]), IDENTITY);
    expect(ring.filter(p => p[1] === -90).map(p => Math.round(p[0]))).toEqual([0, 90]);
  });

  it('moves the ring with its plate', () => {
    const ring = placeRing(xyz([[0, 0], [10, 0], [10, 10]]), matrix(poleQuat(90, 0, 30)));
    expect(ring[1][0]).toBeCloseTo(40);
  });
});

describe('plate model', () => {
  const model = createPlateModel({
    model: { name: 't', attribution: 't', doi: 't', maxMa: 100 },
    rotations: { 5: [[0, 0, 90, 0, 0, 100, 90, 0, 50]] },
    coast: [[5, 100, 0, [0, 0, 10, 0, 10, 10, 0, 10]], [5, 40, 20, [20, 0, 30, 0, 30, 10]]],
    crust: [],
  });

  it('draws only the shapes that existed then', () => {
    expect(model.at(10).features).toHaveLength(1);
    expect(model.at(30).features).toHaveLength(2);
  });

  it('pins a place to the plate under it and carries it back', () => {
    const pin = model.pin(5, 5)!;
    expect(pin.plate).toBe(5);
    expect(model.where(pin, 50)).toEqual([expect.closeTo(30), expect.closeTo(5)]);
    expect(model.pin(50, 50)).toBeNull();
  });
});
