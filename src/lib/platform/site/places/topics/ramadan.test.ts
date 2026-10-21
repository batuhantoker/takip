import { describe, expect, it } from 'vitest';
import { placeBySlug } from '../gazetteer';
import { fastOf, imsakOf, ramadanReport } from './ramadan';
import { eidAlAdhaOf, ramadanOf, ramadansBeginning, ramadanYears } from './ramadan-calendar';

const clock = (ms: number, tz: string) => new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(ms);
const minutes = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));

describe('ramadanOf', () => {
  it('finds Ramadan 1448 and 1449 in the Umm al-Qura calendar', () => {
    expect(ramadanOf(1448)).toEqual({ hijriYear: 1448, start: '2027-02-08', end: '2027-03-08', eid: '2027-03-09', days: 29 });
    expect(ramadanOf(1449).start).toBe('2028-01-28');
  });
});

describe('ramadanYears', () => {
  const view = (today: string) => ramadanYears(today).filter(y => y.indexed || y.nearest).map(y => `${y.slug}${y.ended ? ' ended' : ''}${y.nearest ? ' nearest' : ''}`);

  it('has a page for every Ramadan from 2014 to about nine years ahead', () => {
    const all = ramadanYears('2026-10-21');
    expect(all[0]).toMatchObject({ slug: 'ramadan-2014', ended: true, indexed: false });
    expect(all.at(-1)!.slug).toBe('ramadan-2035');
  });

  it('offers search the one under way or next and the three after it', () => {
    expect(view('2026-10-21')).toEqual(['ramadan-2027 nearest', 'ramadan-2028', 'ramadan-2029', 'ramadan-2030']);
    expect(view('2027-03-09')).toEqual(['ramadan-2027 nearest', 'ramadan-2028', 'ramadan-2029', 'ramadan-2030', 'ramadan-2030-1452']);
    expect(view('2027-03-10')).toEqual(['ramadan-2028 nearest', 'ramadan-2029', 'ramadan-2030', 'ramadan-2030-1452']);
  });

  it('tells apart the two Ramadans that begin in 2030 by the second’s Hijri year', () => {
    expect(view('2029-06-01').filter(v => v.startsWith('ramadan-2030'))).toEqual(['ramadan-2030 nearest', 'ramadan-2030-1452']);
  });
});

// Imsak (or Fajr where it is the same), iftar and Isha for three days of Ramadan 1448, local time.
const KNOWN: [string, string, string, Record<string, [string, string, string]>][] = [
  // diyanet.gov.tr's yearly table for Istanbul: İmsak, Akşam, Yatsı.
  ['Istanbul (Diyanet)', 'istanbul', 'Europe/Istanbul', { '2027-02-08': ['06:35', '18:36', '19:57'], '2027-02-22': ['06:18', '18:53', '20:12'], '2027-03-08': ['05:57', '19:09', '20:28'] }],
  // e-solat.gov.my, zone WLY01: imsak, Maghrib, Isha.
  ['Kuala Lumpur (JAKIM)', 'kuala-lumpur', 'Asia/Kuala_Lumpur', { '2027-02-08': ['06:07', '19:29', '20:40'], '2027-02-22': ['06:06', '19:29', '20:39'], '2027-03-08': ['06:04', '19:28', '20:37'] }],
  // api.aladhan.com's calendar, method 4: Isha two hours after Maghrib in Ramadan.
  ['Riyadh (Umm al-Qura)', 'riyadh', 'Asia/Riyadh', { '2027-02-08': ['05:12', '17:43', '19:43'], '2027-03-08': ['04:52', '17:59', '19:59'] }],
  // api.aladhan.com's calendar, method 5.
  ['Cairo (Egyptian)', 'cairo', 'Africa/Cairo', { '2027-02-08': ['05:13', '17:38', '18:57'], '2027-03-08': ['04:47', '17:58', '19:16'] }],
  // api.aladhan.com's calendar, method 1.
  ['Karachi (Karachi)', 'karachi', 'Asia/Karachi', { '2027-02-08': ['05:53', '18:21', '19:39'], '2027-03-08': ['05:33', '18:37', '19:53'] }],
];

describe('ramadanReport', () => {
  it.each(KNOWN)('puts imsak, iftar and Isha within two minutes of the published ones for %s', (_, slug, tz, days) => {
    const r = ramadanReport(placeBySlug('city', slug)!, tz, 1448);
    expect(r.prayer.days).toHaveLength(29);
    for (const [date, want] of Object.entries(days)) {
      const d = r.prayer.days.find(x => x.date === date)!;
      [imsakOf(r, d), d.times.maghrib, d.times.isha].forEach((ms, i) => expect(Math.abs(minutes(clock(ms, tz)) - minutes(want[i])), `${date} ${i}`).toBeLessThanOrEqual(2));
    }
  });

  it('ends sehri 10 minutes before Fajr in Malaysia and at Fajr in Turkey', () => {
    const kl = ramadanReport(placeBySlug('city', 'kuala-lumpur')!, 'Asia/Kuala_Lumpur', 1448);
    expect(kl.prayer.days[0].times.fajr - imsakOf(kl, kl.prayer.days[0])).toBe(10 * 60_000);
    const ist = ramadanReport(placeBySlug('city', 'istanbul')!, 'Europe/Istanbul', 1448);
    expect(imsakOf(ist, ist.prayer.days[0])).toBe(ist.prayer.days[0].times.fajr);
  });

  it('measures the fast from imsak to iftar, longer as spring comes in the north', () => {
    const ist = ramadanReport(placeBySlug('city', 'istanbul')!, 'Europe/Istanbul', 1448);
    const [first, last] = [ist.prayer.days[0], ist.prayer.days[28]];
    expect(fastOf(ist, first)).toBe(first.times.maghrib - first.times.fajr);
    expect(fastOf(ist, last)).toBeGreaterThan(fastOf(ist, first));
  });
});

describe('the Ramadan dates page’s calendar', () => {
  it('finds Eid al-Adha on 10 Dhu al-Hijjah', () => {
    expect(eidAlAdhaOf(1448)).toBe('2027-05-16');
    expect(eidAlAdhaOf(1452)).toBe('2031-04-02');
  });

  it('lists every Ramadan beginning in a span of years, two in 2030', () => {
    const years = ramadansBeginning(2016, 2036);
    expect(years[0]).toBe(1437);
    expect(ramadanOf(years[0]).start).toBe('2016-06-06');
    expect(years.filter(hy => ramadanOf(hy).start.startsWith('2030'))).toEqual([1451, 1452]);
    expect(years).toHaveLength(22);
    expect(ramadanOf(years[years.length - 1]).start.startsWith('2036')).toBe(true);
  });
});
