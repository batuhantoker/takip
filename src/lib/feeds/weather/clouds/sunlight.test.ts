import { describe, it, expect } from 'vitest';
import { sunElevation, tileDaylight } from './sunlight';

const TIME = '2026-09-22T12:00:00Z'; // equinox noon: the sun is over 0°, 0°
const NOON = Date.parse(TIME);

describe('sunlight', () => {
  const deg = Math.PI / 180;

  it('puts the sun overhead at 0°, 0° at equinox noon', () => {
    expect(sunElevation(NOON)(0, 0)).toBeGreaterThan(0.99);
  });

  it('has it below the horizon on the far side of the world', () => {
    expect(sunElevation(NOON)(0, 180 * deg)).toBeLessThan(-0.99);
  });

  it('finds a tile under the sun all lit, and the opposite one all dark', () => {
    // At zoom 3, tile 4/3 sits just east of 0°, 0°; tile 0/3 is on the date line.
    expect(tileDaylight(3, 4, 3, NOON)).toBe(1);
    expect(tileDaylight(3, 0, 3, NOON)).toBe(0);
  });
});
