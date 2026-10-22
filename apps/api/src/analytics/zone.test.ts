import { describe, expect, it } from 'vitest';
import { DAY_MS } from '../access/usage';
import { rangeOf, localDayStarts } from './range';
import { isZone, localDay, localMidnight, zoneOffsetMs } from './zone';

const H = 3_600_000;
const dayOf = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d) / DAY_MS;

describe('time zones', () => {
  it('knows IANA names and nothing else', () => {
    expect(['UTC', 'Europe/Istanbul', 'America/New_York', 'Asia/Kolkata'].every(isZone)).toBe(true);
    expect(['', 'local', 'Mars/Olympus'].some(isZone)).toBe(false);
  });

  it('reads the offset at a moment, summer time included', () => {
    expect(zoneOffsetMs('Europe/Istanbul', Date.UTC(2026, 0, 15))).toBe(3 * H);
    expect(zoneOffsetMs('America/New_York', Date.UTC(2026, 6, 1))).toBe(-4 * H);
    expect(zoneOffsetMs('America/New_York', Date.UTC(2026, 11, 1))).toBe(-5 * H);
    expect(zoneOffsetMs('Asia/Kolkata', Date.UTC(2026, 6, 1))).toBe(5.5 * H);
  });

  it('finds the local date and when it begins, across a clock change', () => {
    // 22:00 in New York on 13 October is 02:00 UTC on the 14th.
    expect(localDay('America/New_York', Date.UTC(2026, 9, 14, 2))).toBe(dayOf(2026, 10, 13));
    expect(localMidnight('America/New_York', dayOf(2026, 10, 14))).toBe(Date.UTC(2026, 9, 14, 4));
    // Clocks go back at 2:00 on 1 November: that day is 25 hours long.
    expect(localMidnight('America/New_York', dayOf(2026, 11, 2)) - localMidnight('America/New_York', dayOf(2026, 11, 1))).toBe(25 * H);
    expect(localMidnight('Asia/Kolkata', dayOf(2026, 10, 14))).toBe(Date.UTC(2026, 9, 13, 18, 30));
  });

  it('starts a range of days at the viewer’s midnight and leaves the UTC days for the tables kept by day', () => {
    const now = Date.UTC(2026, 9, 14, 12);
    const tokyo = rangeOf({ days: 7, admins: 'include', tz: 'Asia/Tokyo' }, now);
    expect(tokyo).toMatchObject({ first: dayOf(2026, 10, 8), today: dayOf(2026, 10, 14), from: Date.UTC(2026, 9, 7, 15), zone: 'Asia/Tokyo' });
    expect(localDayStarts(tokyo)).toEqual(Array.from({ length: 8 }, (_, i) => Date.UTC(2026, 9, 7 + i, 15)));
    expect(rangeOf({ days: 7, admins: 'include' }, now).from).toBe(dayOf(2026, 10, 8) * DAY_MS);
    expect(rangeOf({ hours: 6, days: 30, admins: 'include', tz: 'Asia/Tokyo' }, now).from).toBe(now - 6 * H);
  });
});
