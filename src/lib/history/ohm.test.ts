import { describe, expect, it } from 'vitest';
import { aliveAt, decimalYear } from './ohm';
import { yearStart } from './world-borders';

describe('decimalYear', () => {
  it('counts the fraction of the year gone', () => {
    expect(decimalYear(Date.UTC(1700, 0, 1))).toBe(1700);
    expect(decimalYear(Date.UTC(1900, 6, 2, 12))).toBeCloseTo(1900.5, 2);
  });

  it('reads BCE as OHM does: year 0 is 1 BCE', () => {
    expect(decimalYear(yearStart(0))).toBe(0);
    expect(decimalYear(yearStart(-499))).toBe(-499);
  });
});

describe('aliveAt', () => {
  it('needs a start, and an end not yet passed', () => {
    const [, hasStart, started, notEnded] = aliveAt(1852.5);
    expect(hasStart).toEqual(['has', 'start_decdate']);
    expect(started).toEqual(['<=', ['get', 'start_decdate'], 1852.5]);
    expect(notEnded).toEqual(['any', ['!', ['has', 'end_decdate']], ['>=', ['get', 'end_decdate'], 1852.5]]);
  });
});
