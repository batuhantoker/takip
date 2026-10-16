import { describe, expect, it } from 'vitest';
import { absoluteMag, apparentMag, spectralClass, SUN_ABS_MAG, temperatureK } from './nearby-stars';

describe('star magnitudes', () => {
  it('gives Sirius its absolute magnitude', () => {
    expect(absoluteMag(-1.46, 8.6)).toBeCloseTo(1.43, 1);
  });

  it('dims the Sun to a faint naked-eye star from Alpha Centauri', () => {
    expect(apparentMag(SUN_ABS_MAG, 4.37)).toBeCloseTo(0.46, 1);
  });

  it('round-trips', () => {
    expect(apparentMag(absoluteMag(3.2, 120), 120)).toBeCloseTo(3.2, 10);
  });
});

describe('star colour', () => {
  it('reads the Sun as a G star near 5,800 K', () => {
    expect(spectralClass(0.65)).toMatch(/^G/);
    expect(temperatureK(0.65)).toBeGreaterThan(5600);
    expect(temperatureK(0.65)).toBeLessThan(6000);
  });
});
