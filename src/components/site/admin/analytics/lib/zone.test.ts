import { describe, expect, it } from 'vitest';
import { localClock, localIsoDay, localWeekHours, offsetMinutes, zoneName } from './zone';

const SUMMER = Date.UTC(2026, 6, 1, 2, 30);

describe('admin times in the viewer’s zone', () => {
  it('names the date, the clock and the zone', () => {
    expect(localIsoDay(SUMMER, 'America/New_York')).toBe('2026-06-30');
    expect(localClock(SUMMER, 'America/New_York')).toBe('22:30');
    expect(localClock(SUMMER, 'Europe/Istanbul')).toBe('05:30');
    expect(zoneName(SUMMER, 'America/New_York')).toBe('EDT');
    expect(zoneName(SUMMER, 'UTC')).toBe('UTC');
    expect(offsetMinutes(SUMMER, 'Asia/Kolkata')).toBe(330);
  });

  it('moves UTC weekday and hour cells to the zone, round the week', () => {
    // Sunday 02:00 UTC is Saturday 22:00 in New York; Saturday 23:00 UTC is Sunday 02:00 in Istanbul.
    const cells = [{ dow: 0, hour: 2, minutes: 5 }, { dow: 6, hour: 23, minutes: 1 }];
    expect(localWeekHours(cells, 'America/New_York', SUMMER)).toEqual({
      zone: 'EDT', cells: [{ dow: 6, hour: 22, minutes: 5 }, { dow: 6, hour: 19, minutes: 1 }],
    });
    expect(localWeekHours(cells, 'Europe/Istanbul', SUMMER).cells).toEqual([{ dow: 0, hour: 5, minutes: 5 }, { dow: 0, hour: 2, minutes: 1 }]);
    expect(localWeekHours(cells, 'Asia/Kolkata', SUMMER)).toEqual({ zone: 'UTC', cells });
  });
});
