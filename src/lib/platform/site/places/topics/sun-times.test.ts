import { describe, expect, it } from 'vitest';
import { dayLength, dayLengthOn, sunDay } from './sun-times';

const HOUR = 3_600_000;

/** sunDay for a date on a clock `offset` hours from UTC, and that clock's HH:MM of a crossing. */
function on(lat: number, lon: number, date: string, offset: number) {
  const day = sunDay(lat, lon, Date.parse(`${date}T12:00:00Z`) - offset * HOUR);
  const clock = (x: number | string) => (typeof x === 'number' ? new Date(x + offset * HOUR).toISOString().slice(11, 16) : x);
  return { day, clock };
}

/** Minutes between two HH:MM clock readings, across midnight. */
function apart(a: string, b: string): number {
  const m = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
  const d = Math.abs(m(a) - m(b));
  return Math.min(d, 1440 - d);
}

// Published sunrise and sunset (timeanddate.com, which follows the same refraction convention), in local time.
const KNOWN: [string, number, number, string, number, string, string][] = [
  ['London, June solstice', 51.5074, -0.1278, '2024-06-20', 1, '04:43', '21:21'],
  ['London, December solstice', 51.5074, -0.1278, '2024-12-21', 0, '08:04', '15:53'],
  ['Reykjavik, June solstice', 64.1466, -21.9426, '2024-06-21', 0, '02:55', '00:04'],
  ['Reykjavik, December solstice', 64.1466, -21.9426, '2024-12-21', 0, '11:22', '15:29'],
  ['Sydney, December solstice', -33.8688, 151.2093, '2024-12-21', 11, '05:41', '20:05'],
  ['Sydney, June solstice', -33.8688, 151.2093, '2024-06-21', 10, '07:00', '16:53'],
  ['New York, March equinox', 40.7128, -74.006, '2024-03-20', -4, '06:58', '19:08'],
];

describe('sunDay', () => {
  it.each(KNOWN)('puts sunrise and sunset within two minutes for %s', (_, lat, lon, date, offset, rise, set) => {
    const { day, clock } = on(lat, lon, date, offset);
    expect(apart(clock(day.rise), rise)).toBeLessThanOrEqual(2);
    expect(apart(clock(day.set), set)).toBeLessThanOrEqual(2);
  });

  it('gives Tromsø polar night in December and the midnight sun in June', () => {
    const winter = on(69.6492, 18.9553, '2024-12-21', 1).day;
    expect([winter.rise, winter.set, dayLength(winter)]).toEqual(['below', 'below', 0]);
    // Civil twilight still comes at midday.
    expect(typeof winter.civil[0]).toBe('number');
    const summer = on(69.6492, 18.9553, '2024-06-21', 2).day;
    expect([summer.rise, summer.set, dayLength(summer)]).toEqual(['above', 'above', 24 * HOUR]);
  });

  it('has no astronomical night in London in June', () => {
    expect(on(51.5074, -0.1278, '2024-06-20', 1).day.astronomical).toEqual(['above', 'above']);
  });

  it('keeps the equator’s day a little over 12 hours, from refraction', () => {
    const hours = dayLength(on(-0.2299, -78.525, '2024-01-01', -5).day) / HOUR;
    expect(hours).toBeGreaterThan(12.05);
    expect(hours).toBeLessThan(12.2);
  });

  it('finds the solar noon on the calendar day of a clock far from its longitude', () => {
    // Samoa keeps UTC+13 at 172° W: its noon falls on the local day asked for, not the one before.
    const { day, clock } = on(-13.8333, -171.75, '2024-06-21', 13);
    expect(clock(day.noon)).toMatch(/^12:/);
    expect(new Date(day.noon + 13 * HOUR).toISOString().slice(0, 10)).toBe('2024-06-21');
  });

  it('measures the solstices without a clock', () => {
    expect(dayLengthOn(51.5074, -0.1278, '2024-06-20') / HOUR).toBeCloseTo(16.64, 1);
    expect(dayLengthOn(51.5074, -0.1278, '2024-12-21') / HOUR).toBeCloseTo(7.83, 1);
  });
});
