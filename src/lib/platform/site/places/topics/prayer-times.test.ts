import { describe, expect, it } from 'vitest';
import { ramadanNear } from './prayer-hijri';
import { nextPrayer, prayerDays, PRAYERS, qiblaOf, type PrayerKey } from './prayer-times';

const clock = (ms: number, tz: string) => new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(ms);
const minutes = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));

// Fajr, sunrise, Dhuhr, Asr (the country's main school), Maghrib and Isha on 2026-10-21, local time.
const KNOWN: [string, number, number, string, string, string[]][] = [
  // api.aladhan.com, method 13; diyanet.gov.tr publishes 05:50 07:15 12:54 15:53 18:23 19:42.
  ['Istanbul (Diyanet)', 41.01384, 28.94966, 'TR', 'Europe/Istanbul', ['05:50', '07:15', '12:54', '15:53', '18:22', '19:41']],
  // api.aladhan.com, method 5.
  ['Cairo (Egyptian)', 30.06263, 31.24967, 'EG', 'Africa/Cairo', ['05:34', '07:01', '12:40', '15:53', '18:18', '19:36']],
  // api.aladhan.com, method 1, Hanafi Asr.
  ['Karachi (Karachi, Hanafi)', 24.8608, 67.0104, 'PK', 'Asia/Karachi', ['05:16', '06:33', '12:17', '16:23', '18:00', '19:16']],
  // api.aladhan.com, method 15, plus the 5 min after zawal and 3 min after sunset moonsighting.com adds (its FAQ §1.1, §5.1).
  ['London (Moonsighting Committee)', 51.50853, -0.12574, 'GB', 'Europe/London', ['05:59', '07:35', '12:50', '15:24', '17:58', '19:19']],
  // api.aladhan.com, method 2.
  ['New York (ISNA)', 40.71427, -74.00597, 'US', 'America/New_York', ['05:58', '07:14', '12:41', '15:40', '18:07', '19:22']],
  // api.aladhan.com, method 4.
  ['Riyadh (Umm al-Qura)', 24.68773, 46.72185, 'SA', 'Asia/Riyadh', ['04:35', '05:54', '11:38', '14:55', '17:21', '18:51']],
  // e-solat.gov.my, zone WLY01.
  ['Kuala Lumpur (JAKIM)', 3.1412, 101.68653, 'MY', 'Asia/Kuala_Lumpur', ['05:49', '06:56', '13:01', '16:18', '19:00', '20:10']],
];

describe('prayerDays', () => {
  it.each(KNOWN)('puts every time within two minutes of the published ones for %s', (_, lat, lon, cc, tz, want) => {
    const [day] = prayerDays(lat, lon, cc, tz, '2026-10-21', 1).days;
    PRAYERS.forEach((k: PrayerKey, i) => expect(Math.abs(minutes(clock(day.times[k], tz)) - minutes(want[i])), k).toBeLessThanOrEqual(2));
  });

  it('gives the other school’s Asr as well, the Hanafi one later', () => {
    const [istanbul] = prayerDays(41.01384, 28.94966, 'TR', 'Europe/Istanbul', '2026-10-21', 1).days;
    expect(istanbul.asrOther).toBeGreaterThan(istanbul.times.asr + 30 * 60_000);
    const [karachi] = prayerDays(24.8608, 67.0104, 'PK', 'Asia/Karachi', '2026-10-21', 1).days;
    expect(karachi.asrOther).toBeLessThan(karachi.times.asr);
  });

  it('keeps Tromsø’s times through polar night and the midnight sun', () => {
    for (const date of ['2026-12-21', '2027-06-21']) {
      const [day] = prayerDays(69.6489, 18.95508, 'NO', 'Europe/Oslo', date, 1).days;
      expect(day.polar).toBe(true);
      for (const k of PRAYERS) expect(Number.isFinite(day.times[k])).toBe(true);
    }
  });

  it('holds Tromsø’s Fajr and Isha to a seventh of the night in October', () => {
    const report = prayerDays(69.6489, 18.95508, 'NO', 'Europe/Oslo', '2026-10-21', 1);
    expect(report.rule).toBe('seventh');
    expect(report.days[0].held).toEqual({ fajr: true, isha: true });
    expect(prayerDays(52.52437, 13.41053, 'DE', 'Europe/Berlin', '2026-10-21', 1).days[0].held).toEqual({ fajr: false, isha: false });
  });

  it('uses the high-latitude rule in the south too', () => {
    expect(prayerDays(-53.16282, -70.90922, 'CL', 'America/Punta_Arenas', '2026-06-21', 1).rule).toBe('seventh');
  });

  it('puts Umm al-Qura’s Isha two hours after Maghrib in Ramadan', () => {
    const [day] = prayerDays(24.68773, 46.72185, 'SA', 'Asia/Riyadh', '2027-02-20', 1).days;
    expect((day.times.isha - day.times.maghrib) / 60_000).toBe(120);
  });

  it('works out Samoa’s day, a calendar day ahead of its longitude', () => {
    const [day] = prayerDays(-13.83333, -171.76666, 'WS', 'Pacific/Apia', '2026-10-21', 1).days;
    expect(new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Apia' }).format(day.times.dhuhr)).toBe('2026-10-21');
    expect(clock(day.times.dhuhr, 'Pacific/Apia')).toMatch(/^12:/);
  });

  it('finds the next prayer, tomorrow’s Fajr after Isha', () => {
    const { days } = prayerDays(41.01384, 28.94966, 'TR', 'Europe/Istanbul', '2026-10-21', 2);
    expect(nextPrayer(days, Date.parse('2026-10-21T13:00:00Z'))?.prayer).toBe('maghrib');
    const late = nextPrayer(days, Date.parse('2026-10-21T20:00:00Z'))!;
    expect([late.prayer, late.at]).toEqual(['fajr', days[1].times.fajr]);
  });
});

describe('qiblaOf', () => {
  it('points Istanbul south-south-east and New York north-east, along the great circle', () => {
    const istanbul = qiblaOf(41.01384, 28.94966);
    expect(istanbul.bearing).toBeCloseTo(151.6, 0);
    expect(istanbul.km).toBeGreaterThan(2350);
    expect(istanbul.km).toBeLessThan(2420);
    expect(qiblaOf(40.71427, -74.00597).bearing).toBeCloseTo(58.5, 0);
  });
});

describe('ramadanNear', () => {
  it('names Ramadan 1448’s first day in the Umm al-Qura calendar, and the day within it', () => {
    expect(ramadanNear('2027-01-01')).toEqual({ kind: 'soon', starts: '2027-02-08', year: 1448 });
    expect(ramadanNear('2027-02-20')).toEqual({ kind: 'during', day: 13, year: 1448, ends: '2027-03-08' });
    expect(ramadanNear('2026-10-21')).toBeNull();
  });
});
