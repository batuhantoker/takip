import { describe, expect, it } from 'vitest';
import { decodeWind, encodeWind, windAt, type WindField } from './wind-field';

const FIELD: WindField = {
  time: '2026-10-16T06:00:00.000Z', lat0: 90, dLat: -90, lng0: 0, dLng: 180, rows: 3, cols: 2,
  u: Float32Array.from([1, 2, 3.4, -4, NaN, 6]),
  v: Float32Array.from([0, -1, 0.5, 2, 3, -6]),
};

describe('encodeWind / decodeWind', () => {
  it('round-trips both components to a tenth, gaps included', () => {
    const back = decodeWind(encodeWind(FIELD).slice().buffer);
    expect(back.time).toBe(FIELD.time);
    expect([...back.u].map(x => (Number.isNaN(x) ? 'gap' : Math.round(x * 10) / 10))).toEqual([1, 2, 3.4, -4, 'gap', 6]);
    expect([...back.v]).toEqual([0, -1, 0.5, 2, 3, -6]);
  });

  it('refuses a body of the wrong size', () => {
    const bytes = encodeWind(FIELD);
    expect(() => decodeWind(bytes.slice(0, bytes.length - 2).buffer)).toThrow(/holds/);
  });
});

describe('windAt', () => {
  const out: [number, number] = [0, 0];
  it('interpolates between cells and wraps longitude', () => {
    expect(windAt(FIELD, 0, 0, out)).toBe(true);
    expect(out[0]).toBeCloseTo(3.4);
    expect(windAt(FIELD, 45, 90, out)).toBe(true);
    expect(out[0]).toBeCloseTo((1 + 2 + 3.4 - 4) / 4);
    expect(windAt(FIELD, 45, 450, out)).toBe(true);
    expect(out[0]).toBeCloseTo((1 + 2 + 3.4 - 4) / 4);
  });

  it('leaves gap cells out, and gives up among nothing but gaps', () => {
    expect(windAt(FIELD, -45, 90, out)).toBe(true);
    expect(out[0]).toBeCloseTo((3.4 - 4 + 6) / 3);
    const gaps = { ...FIELD, u: new Float32Array(6).fill(NaN) };
    expect(windAt(gaps, 0, 0, out)).toBe(false);
  });
});
