import { describe, expect, it } from 'vitest';
import { dayMs, yearAsWritten } from './chronicle';
import { CHRONICLES } from './presets/chronicles';

describe('chronicle dates', () => {
  it('reads astronomical years, BCE included', () => {
    expect(new Date(dayMs('1941-12-07')).toISOString()).toBe('1941-12-07T12:00:00.000Z');
    expect(new Date(dayMs('-48-01-10')).getUTCFullYear()).toBe(-48);
    expect(new Date(dayMs('0117-08-08')).getUTCFullYear()).toBe(117);
  });
  it('writes the year as an article would', () => {
    expect(yearAsWritten('1453-05-29')).toBe('1453');
    expect(yearAsWritten('-48-01-10')).toBe('49 BC');
  });
  it('keeps every preset in date order with unique stop ids', () => {
    for (const [name, c] of Object.entries(CHRONICLES)) {
      const times = c.stops.map(s => dayMs(s.date));
      expect(times, name).toEqual([...times].sort((a, b) => a - b));
      expect(new Set(c.stops.map(s => s.id)).size, name).toBe(c.stops.length);
    }
  });
});
