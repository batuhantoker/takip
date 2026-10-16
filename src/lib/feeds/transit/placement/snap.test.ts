import { describe, expect, it } from 'vitest';
import { alongShape, bearingOf, metres, pathLength, pointAlong, project, type LngLat } from './snap';

// An L-shaped route: east along a street, then north up another (~0.001° ≈ 80–110 m).
const shape: LngLat[] = [[-84.52, 39.1], [-84.519, 39.1], [-84.518, 39.1], [-84.518, 39.101], [-84.518, 39.102]];

describe('project', () => {
  it('drops a fix onto the nearest segment', () => {
    const p = project(shape, [-84.5185, 39.10002])!;
    expect(p.seg).toBe(1);
    expect(p.t).toBeCloseTo(0.5, 2);
    expect(p.at[1]).toBeCloseTo(39.1, 6);
    expect(p.off).toBeLessThan(3);
  });
});

describe('alongShape', () => {
  it('follows the corner instead of cutting across it', () => {
    const a: LngLat = [-84.5195, 39.10001], b: LngLat = [-84.51801, 39.1015];
    const r = alongShape(shape, a, b)!;
    expect(r.path).toContainEqual([-84.518, 39.1]);
    expect(pathLength(r.path)).toBeGreaterThan(metres(a, b) * 1.2);
    expect(r.end.seg).toBe(3);
  });

  it('refuses fixes off the route', () => {
    expect(alongShape(shape, [-84.5195, 39.1], [-84.515, 39.105])).toBeNull();
  });

  it('holds still when a fix jitters backwards', () => {
    const first = alongShape(shape, [-84.5195, 39.1], [-84.5185, 39.1])!;
    const back = alongShape(shape, [-84.5185, 39.1], [-84.5186, 39.1], first.end)!;
    expect(back.path[0]).toEqual(back.path[1]);
  });

  it('keeps to the second pass of a loop once past the first', () => {
    // Out east, back west on the same street.
    const loop: LngLat[] = [[0, 0], [0.002, 0], [0.002, 0.00001], [0, 0.00001]];
    const first = alongShape(loop, [0.0005, 0], [0.0019, 0])!;
    const turned = alongShape(loop, [0.0019, 0], [0.002, 0.00001], first.end)!;
    const back = alongShape(loop, [0.002, 0.00001], [0.001, 0.00001], turned.end)!;
    expect(back.end.seg).toBe(2);
  });
});

describe('pointAlong', () => {
  it('walks a path by distance and gives the heading there', () => {
    const path: LngLat[] = [[0, 0], [0, 0.001], [0.001, 0.001]];
    const mid = pointAlong(path, 0.25);
    expect(mid.at[0]).toBeCloseTo(0, 6);
    expect(mid.at[1]).toBeCloseTo(0.0005, 5);
    expect(mid.bearing).toBeCloseTo(0, 0);
    expect(pointAlong(path, 0.75).bearing).toBeCloseTo(90, 0);
    expect(pointAlong(path, 1).at).toEqual([0.001, 0.001]);
  });

  it('measures bearings clockwise from north', () => {
    expect(bearingOf([0, 0], [0, -1])).toBeCloseTo(180, 5);
    expect(bearingOf([0, 0], [-1, 0])).toBeCloseTo(270, 5);
  });
});
