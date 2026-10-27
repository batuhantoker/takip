import { describe, expect, it } from 'vitest';
import { EQUATORIAL_TO_GALACTIC, mul, transpose } from '../frames';
import { fillZoneOfAvoidance, RECORD_FLOATS, zoneOfAvoidance } from './cosmos';

const toEq = transpose(EQUATORIAL_TO_GALACTIC);
const record = (l: number, b: number, mly: number, value: number) => {
  const r = Math.PI / 180;
  return [...mul(toEq, [mly * Math.cos(b * r) * Math.cos(l * r), mly * Math.cos(b * r) * Math.sin(l * r), mly * Math.sin(b * r)]), value];
};
const latLon = (rec: Float32Array, i: number) => {
  const [x, y, z] = mul(EQUATORIAL_TO_GALACTIC, [rec[i], rec[i + 1], rec[i + 2]]);
  const r = Math.hypot(x, y, z);
  return { l: (Math.atan2(y, x) * 180 / Math.PI + 360) % 360, b: Math.asin(z / r) * 180 / Math.PI, r };
};

describe('zone of avoidance', () => {
  it('is wider toward the galactic centre', () => {
    expect(zoneOfAvoidance(10)).toBe(8);
    expect(zoneOfAvoidance(340)).toBe(8);
    expect(zoneOfAvoidance(180)).toBe(5);
  });

  it('mirrors the strip beside the zone into it, keeping longitude, distance and value', () => {
    const recs = new Float32Array([...record(120, 7, 100, -22), ...record(120, -9.5, 50, -20), ...record(120, 30, 80, -21), ...record(10, 3, 80, -21)]);
    const out = fillZoneOfAvoidance(recs);
    expect(out.length).toBe(2 * RECORD_FLOATS);
    const a = latLon(out, 0), b = latLon(out, RECORD_FLOATS);
    expect(a.b).toBeCloseTo(3, 3);
    expect(a.l).toBeCloseTo(120, 3);
    expect(a.r).toBeCloseTo(100, 2);
    expect(out[3]).toBe(-22);
    expect(b.b).toBeCloseTo(-0.5, 3);
  });
});
