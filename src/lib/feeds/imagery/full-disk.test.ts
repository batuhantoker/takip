import { describe, expect, it } from 'vitest';
import { diskPoint, drawDisk } from './full-disk';

describe('diskPoint', () => {
  it('sees the sub-satellite point at the centre', () => {
    const [lon, lat] = diskPoint(0, 0, -75.2)!;
    expect(lon).toBeCloseTo(-75.2, 6);
    expect(lat).toBeCloseTo(0, 6);
  });

  it('reaches about 81° from the sub-satellite point at the edge', () => {
    expect(diskPoint(0, 0.9999, 0)![1]).toBeGreaterThan(80);
    expect(diskPoint(0.9999, 0, 0)![0]).toBeGreaterThan(80);
    expect(diskPoint(-0.9999, 0, 0)![0]).toBeLessThan(-80);
  });

  it('is off the Earth outside the disc, and wraps longitudes', () => {
    expect(diskPoint(0.8, 0.8, 0)).toBeNull();
    expect(diskPoint(0.5, 0, 170)![0]).toBeLessThan(-150);
  });
});

describe('drawDisk', () => {
  it('samples the source inside the disc and leaves space black', () => {
    const src = { data: new Uint8Array(4 * 4 * 3).fill(200), width: 4, height: 4, channels: 3, west: -90, east: 90, south: -90, north: 90 };
    const out = drawDisk(src, 0, 8);
    const at = (row: number, col: number) => out[(row * 8 + col) * 3];
    expect(at(4, 4)).toBe(200);
    expect(at(0, 0)).toBe(0);
  });
});
