import { describe, expect, it } from 'vitest';
import { createRotations, matrix, poleQuat, toLonLat, toVec, type Vec } from './plates';

const turn = (q: ReturnType<typeof poleQuat>, lon: number, lat: number) => {
  const m = matrix(q);
  const [x, y, z] = toVec(lon, lat);
  return toLonLat([m[0] * x + m[1] * y + m[2] * z, m[3] * x + m[4] * y + m[5] * z, m[6] * x + m[7] * y + m[8] * z] as Vec);
};

describe('rotations', () => {
  // Plate 2 turns 10° a million years about the north pole against plate 1, which turns 20° about 0°N 0°E.
  const rot = createRotations({
    1: [[0, 0, 0, 0, 0, 10, 0, 0, 20]],
    2: [[1, 0, 90, 0, 0, 10, 90, 0, 100], [0, 10, 90, 0, 100, 20, 90, 0, 100]],
  });

  it('is no turn today and the listed pole at a listed age', () => {
    expect(turn(rot.at(1, 0)!, 30, 10)).toEqual([expect.closeTo(30), expect.closeTo(10)]);
    expect(turn(rot.at(1, 10)!, 90, 0)).toEqual([expect.closeTo(90), expect.closeTo(20)]);
  });

  it('turns part way between two ages', () => {
    const [lon, lat] = turn(rot.at(1, 5)!, 90, 0);
    expect(lon).toBeCloseTo(90);
    expect(lat).toBeCloseTo(10);
  });

  it('chains a plate through the plate it hangs from', () => {
    // 50° about the pole, then 10° about 0°N 0°E: 40°E on the equator ends at 90°E, 10°N.
    const [lon, lat] = turn(rot.at(2, 5)!, 40, 0);
    expect(lon).toBeCloseTo(90);
    expect(lat).toBeCloseTo(10);
  });

  it('follows a crossover to the new fixed plate', () => {
    expect(turn(rot.at(2, 15)!, 0, 0)).toEqual([expect.closeTo(100), expect.closeTo(0)]);
  });

  it('has nothing for an age outside every run or an unknown plate', () => {
    expect(rot.at(1, 11)).toBeNull();
    expect(rot.at(2, 21)).toBeNull();
    expect(rot.at(9, 0)).toBeNull();
  });
});
