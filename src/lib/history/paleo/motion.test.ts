import { describe, expect, it } from 'vitest';
import { motionAt, trailTo } from './motion';
import { createPlateModel } from './reconstruct';

// Plate 5 turns a degree each million years about the north pole, so the equator at 0°E sat at `ma`°E.
const model = createPlateModel({
  model: { name: 't', attribution: 't', doi: 't', maxMa: 10 },
  rotations: { 5: [[0, 0, 90, 0, 0, 10, 90, 0, 10]] },
  coast: [[5, 10, 0, [-5, -5, 5, -5, 5, 5, -5, 5]]],
  crust: [],
});
const pin = model.pin(0, 0)!;

describe('motion', () => {
  it('reads heading and speed over the million years before', () => {
    const m = motionAt(model, pin, 5)!;
    expect(m.at[0]).toBeCloseTo(5);
    expect(m.bearing).toBeCloseTo(270);
    expect(m.cmPerYear).toBeCloseTo(11.12, 1);
  });

  it('reads the million years after where the ground is younger', () => {
    expect(motionAt(model, pin, 10)!.cmPerYear).toBeCloseTo(11.12, 1);
  });

  it('traces the path oldest first', () => {
    expect(trailTo(model, pin, 5, 3, 1).map(p => Math.round(p[0]))).toEqual([8, 7, 6, 5]);
  });
});
