import { describe, expect, it } from 'vitest';
import { magneticLatitude, parseIgrf, type Igrf } from './sky-geomag';

const RAD = Math.PI / 180;

/** A field of degree 1 only: a tilted dipole, whose traced latitude has a closed form. */
const dipole = (g10: number, g11: number, h11: number): Igrf => ({
  degree: 1,
  g: [new Float64Array([0]), new Float64Array([g10, g11])],
  h: [new Float64Array([0]), new Float64Array([0, h11])],
});

/** The dipole latitude of a ground point, with its geocentric radius in IGRF radii. */
function dipoleLatitude(model: Igrf, lat: number, lng: number): number {
  const a = 6378.137, b = 6356.752;
  const psi = Math.atan((b / a) ** 2 * Math.tan(lat * RAD));
  const r = Math.hypot(a * Math.cos(psi), b * Math.sin(psi)) / 6371.2;
  const [g10, g11, h11] = [model.g[1][0], model.g[1][1], model.h[1][1]];
  const b0 = Math.hypot(g10, g11, h11);
  const up = Math.cos(psi) * Math.cos(lng * RAD) * (-g11 / b0) + Math.cos(psi) * Math.sin(lng * RAD) * (-h11 / b0) + Math.sin(psi) * (-g10 / b0);
  const lam = Math.asin(up);
  // A dipole line through radius r at latitude lam crosses the equator at r / cos²(lam).
  return (Math.sign(lam) * Math.acos(Math.sqrt(Math.cos(lam) ** 2 / r))) / RAD;
}

describe('magneticLatitude', () => {
  const tilted = dipole(-29350, -1410.3, 4545.5);

  it('traces a pure dipole to its own latitude', () => {
    for (const [lat, lng] of [[69.65, 18.96], [64.15, -21.94], [48.14, 11.58], [-42.88, 147.33], [-54.8, -68.3], [35, 100]]) {
      expect(magneticLatitude(tilted, lat, lng)).toBeCloseTo(dipoleLatitude(tilted, lat, lng), 1);
    }
  });

  it('is negative in the south and runs out to ±90 near the pole', () => {
    expect(magneticLatitude(tilted, -45, 170)).toBeLessThan(-40);
    expect(magneticLatitude(tilted, 80.8, -72.8)).toBe(90);
  });
});

describe('parseIgrf', () => {
  const text = [
    '# 14th Generation International Geomagnetic Reference Field',
    'c/s deg ord IGRF IGRF',
    'g/h n m 2020.0 2025.0 2025-30',
    'g  1  0 -29403.41 -29350.0 12.6',
    'g  1  1  -1451.37  -1410.3 10.0',
    'h  1  1   4653.35   4545.5 -21.5',
  ].join('\n');

  it('reads the newest model and carries it forward with the secular variation', () => {
    const m = parseIgrf(text, 2027);
    expect(m.degree).toBe(1);
    expect(m.g[1][0]).toBeCloseTo(-29350 + 2 * 12.6, 6);
    expect(m.h[1][1]).toBeCloseTo(4545.5 - 2 * 21.5, 6);
  });

  it('refuses a file it does not recognise', () => {
    expect(() => parseIgrf('nothing here', 2026)).toThrow();
  });
});
