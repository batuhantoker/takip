import { describe, expect, it } from 'vitest';
import { weekEnding } from './owid-covid';

describe('owid-covid helpers', () => {
  it('dates a day to the Sunday ending its week', () => {
    const day = (d: string) => Date.parse(`${d}T00:00:00Z`);
    expect(weekEnding(day('2020-04-01'))).toBe(day('2020-04-05'));
    expect(weekEnding(day('2020-04-05'))).toBe(day('2020-04-05'));
    expect(weekEnding(day('2020-04-06'))).toBe(day('2020-04-12'));
  });
});
