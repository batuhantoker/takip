import { describe, expect, it } from 'vitest';
import { AU_KM, norm } from '../astro';
import { parseMpcLine, positionFromElements, unpackEpoch } from './outer';

// Distant.txt, Minor Planet Center, 2026-10-12.
const HIDALGO = '00944   10.55  0.15 K2669 199.68322   56.62737   21.33337   42.52433  0.6620703  0.07188129   5.7287361  0 E2026-TK4  1967  31 1920-2024 0.78 M-v 3Ek Pan        0000    (944) Hidalgo            20240512';

describe('unpackEpoch', () => {
  it('reads the packed century, year, month and day', () => {
    expect(unpackEpoch('K2669')).toBe(2461200.5);
    expect(unpackEpoch('J981A')).toBe(Date.UTC(1998, 0, 10) / 86_400_000 + 2440587.5);
    expect(unpackEpoch('X0000')).toBeNull();
  });
});

describe('parseMpcLine', () => {
  it('takes the elements from their fixed columns', () => {
    const r = parseMpcLine(HIDALGO)!;
    expect(r.H).toBe(10.55);
    expect(r.el).toMatchObject({ a: 5.7287361, e: 0.6620703, i: 42.52433, node: 21.33337, peri: 56.62737, M: 199.68322 });
  });
});

describe('positionFromElements', () => {
  it('puts a circular orbit a quarter turn on after a quarter period', () => {
    const a = 39.5, period = 365.256898 * a ** 1.5;
    const p = positionFromElements({ a, e: 0, i: 0, node: 0, peri: 0, M: 0, epochJd: 2451545 }, 2451545 + period / 4)!;
    expect(p[0] / AU_KM).toBeCloseTo(0, 3);
    expect(p[1] / AU_KM).toBeCloseTo(a, 3);
  });

  it('keeps an eccentric orbit between perihelion and aphelion', () => {
    const { el } = parseMpcLine(HIDALGO)!;
    for (let d = 0; d < 5000; d += 250) {
      const r = norm(positionFromElements(el, el.epochJd + d)!) / AU_KM;
      expect(r).toBeGreaterThanOrEqual(el.a * (1 - el.e) - 1e-6);
      expect(r).toBeLessThanOrEqual(el.a * (1 + el.e) + 1e-6);
    }
  });

  it('refuses unbound orbits', () => {
    expect(positionFromElements({ a: 1, e: 1.2, i: 0, node: 0, peri: 0, M: 0, epochJd: 0 }, 0)).toBeNull();
  });
});
