import { describe, expect, it } from 'vitest';
import { localClock, nightOf, zoneOffset } from './sky-time';

describe('localClock', () => {
  it('reads the wall clock in the zone, across a change of summer time', () => {
    expect(localClock(Date.parse('2026-10-19T16:30:00Z'), 'Europe/Berlin')).toEqual({ date: '2026-10-19', time: '18:30', hour: 18, weekday: 1 });
    expect(localClock(Date.parse('2026-10-26T16:30:00Z'), 'Europe/Berlin').time).toBe('17:30');
    expect(localClock(Date.parse('2026-10-19T21:30:00Z'), 'Europe/Istanbul')).toEqual({ date: '2026-10-20', time: '00:30', hour: 0, weekday: 2 });
  });

  it('gives the offset from UTC', () => {
    expect(zoneOffset(Date.parse('2026-10-19T12:00:00Z'), 'Europe/Berlin')).toBe(2 * 3_600_000);
    expect(zoneOffset(Date.parse('2026-10-26T12:00:00Z'), 'Europe/Berlin')).toBe(3_600_000);
    expect(zoneOffset(Date.parse('2026-10-26T12:00:00Z'), 'America/St_Johns')).toBe(-2.5 * 3_600_000);
  });
});

describe('nightOf', () => {
  const tz = 'Europe/Berlin';
  const at = (local: string) => Date.parse(`${local}+02:00`);

  it('counts a pass before dawn with the evening before it', () => {
    const afternoon = at('2026-10-19T15:00:00');
    expect(nightOf(at('2026-10-19T21:00:00'), afternoon, tz)).toBe(0);
    expect(nightOf(at('2026-10-20T05:40:00'), afternoon, tz)).toBe(0);
    expect(nightOf(at('2026-10-20T19:00:00'), afternoon, tz)).toBe(1);
    expect(nightOf(at('2026-10-22T05:40:00'), afternoon, tz)).toBe(2);
  });

  it('is still the same night in the small hours', () => {
    expect(nightOf(at('2026-10-20T05:40:00'), at('2026-10-20T02:00:00'), tz)).toBe(0);
  });
});
