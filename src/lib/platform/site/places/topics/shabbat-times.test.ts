import { describe, expect, it } from 'vitest';
import { jewishYear } from '../../jewish-holidays';
import { holyDay, shabbatEvents } from './shabbat-times';

const clock = (ms: number | null, tz: string) => (ms === null ? null : new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(ms));
const events = (lat: number, lon: number, tz: string, id: number, israel: boolean, from: string, to: string) =>
  shabbatEvents(lat, lon, tz, id, israel, from, to).map(e => `${e.date} ${e.kind} ${clock(e.at, tz)}`);

// hebcal.com/shabbat and /hebcal with M=on (havdalah at 8.5°), on these days.
const WEEK: [string, number, number, string, number, boolean, string, string][] = [
  ['Jerusalem (40 minutes)', 31.769, 35.2163, 'Asia/Jerusalem', 281184, true, '17:18', '18:34'],
  ['Tel Aviv (20 minutes in Israel)', 32.0809, 34.7806, 'Asia/Jerusalem', 293397, true, '17:39', '18:36'],
  ['New York', 40.7143, -74.006, 'America/New_York', 5128581, false, '17:45', '18:44'],
  ['London', 51.5085, -0.1257, 'Europe/London', 2643743, false, '17:32', '18:39'],
  ['Istanbul', 41.0138, 28.9497, 'Europe/Istanbul', 745044, false, '17:54', '18:52'],
];

describe('shabbatEvents', () => {
  it.each(WEEK)('matches Hebcal for the Shabbat of 24 October 2026 in %s', (_, lat, lon, tz, id, israel, candles, havdalah) => {
    expect(events(lat, lon, tz, id, israel, '2026-10-22', '2026-10-24')).toEqual([`2026-10-23 candles ${candles}`, `2026-10-24 havdalah ${havdalah}`]);
  });

  it('keeps Pesach 2027 for two days in New York, lighting the second night at nightfall', () => {
    expect(events(40.7143, -74.006, 'America/New_York', 5128581, false, '2027-04-20', '2027-04-30')).toEqual([
      '2027-04-21 candles 19:23', '2027-04-22 candles 20:26', '2027-04-23 candles 19:25', '2027-04-24 havdalah 20:28',
      '2027-04-27 candles 19:29', '2027-04-28 candles 20:33', '2027-04-29 havdalah 20:34', '2027-04-30 candles 19:33',
    ]);
  });

  it('keeps Pesach 2027 for one day in Jerusalem', () => {
    expect(events(31.769, 35.2163, 'Asia/Jerusalem', 281184, true, '2027-04-20', '2027-04-30')).toEqual([
      '2027-04-21 candles 18:31', '2027-04-22 havdalah 19:51', '2027-04-23 candles 18:33', '2027-04-24 havdalah 19:52',
      '2027-04-27 candles 18:36', '2027-04-28 havdalah 19:55', '2027-04-30 candles 18:38',
    ]);
  });
});

describe('holyDay', () => {
  it('finds Rosh Hashanah 5788 and the diaspora’s second day of Shavuot', () => {
    expect(holyDay('2027-10-02', true)).toEqual({ shabbat: true, holiday: 'rosh-hashanah' });
    expect(holyDay('2027-06-12', false)?.holiday).toBe('shavuot');
    expect(holyDay('2027-06-12', true)?.holiday ?? null).toBeNull();
  });
});

describe('white nights', () => {
  it('gives Saint Petersburg no havdalah in late June, as Hebcal gives none', () => {
    expect(events(59.9386, 30.3141, 'Europe/Moscow', 498817, false, '2027-06-25', '2027-06-26')).toEqual(['2027-06-25 candles 22:07', '2027-06-26 havdalah null']);
  });
});

describe('one source of holiday dates', () => {
  it('agrees with the Jewish holidays page from 2016 to 2036', () => {
    for (let year = 2016; year <= 2036; year++) {
      const { holidays: h } = jewishYear(year);
      const day = (date: string, israel: boolean) => holyDay(date, israel)?.holiday;
      expect([
        day(h.passover.first, false), day(h.passover.israel!, true), day(h.shavuot.first, false), day(h.roshHashanah.first, true),
        day(h.yomKippur.first, true), day(h.sukkot.first, false), day(h.simchatTorah.first, false), day(h.simchatTorah.israel!, true),
      ], String(year)).toEqual(['pesach', 'pesach-end', 'shavuot', 'rosh-hashanah', 'yom-kippur', 'sukkot', 'simchat-torah', 'shemini-atzeret']);
    }
  });
});
