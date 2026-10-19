import { describe, expect, it } from 'vitest';
import { defaultMinMag } from './floor';

const YEAR = 365.25 * 86_400_000;
const span = (years: number) => [0, years * YEAR] as const;

describe('defaultMinMag', () => {
  it('keeps a place or a country at 2.5, even over a century', () => {
    expect(defaultMinMag([37.5, 37.8, 39.3, 39.4], ...span(100))).toBe(2.5);
    expect(defaultMinMag([-125, 24, -66, 50], ...span(10))).toBe(2.5);
  });

  it('starts the whole world higher the longer the window', () => {
    expect(defaultMinMag(undefined, ...span(30 / 365))).toBe(2.5);
    expect(defaultMinMag(undefined, ...span(1))).toBe(4.5);
    expect(defaultMinMag(undefined, ...span(10))).toBe(5.5);
    expect(defaultMinMag(undefined, ...span(100))).toBe(6);
  });

  it('measures an area across the antimeridian by its real width', () => {
    expect(defaultMinMag([172, 51, -129, 72], ...span(10))).toBe(2.5);
  });
});
