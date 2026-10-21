import { describe, expect, it } from 'vitest';
import { holidayTable } from './holidays-data';
import { nextHoliday, regionDaysOff, yearFacts } from './holidays-facts';
import { holidayYear } from './holidays-rules';

const row = (cc: string) => Object.values(holidayTable().rows).find(r => r.cc === cc)!;
const dates = (cc: string, year: number) => holidayYear(row(cc), year)!.days.filter(e => e.t === 'p' && !e.r).map(e => `${e.d}${e.n ? `+${e.n}` : ''}${e.from ? `@${e.from}` : ''}`);

describe('holiday rules', () => {
  it('match the official lists checked by hand', () => {
    // GOV.UK, all four nations; Scotland's World Cup bank holiday is GOV.UK's patch.
    expect(dates('GB', 2027)).toEqual(['2027-01-01', '2027-03-26', '2027-05-03', '2027-05-31', '2027-12-25', '2027-12-26', '2027-12-27', '2027-12-28']);
    expect(holidayYear(row('GB'), 2026)!.days.find(e => e.d === '2026-06-15')).toMatchObject({ r: ['SCT'] });
    // OPM, with the Saturday and Sunday holidays' days off.
    expect(dates('US', 2027)).toEqual(['2027-01-01', '2027-01-18', '2027-02-15', '2027-05-31', '2027-06-18', '2027-06-19', '2027-07-04', '2027-07-05',
      '2027-09-06', '2027-10-11', '2027-11-11', '2027-11-25', '2027-12-24', '2027-12-25', '2027-12-31']);
    // Diyanet's bayrams, with Kanun 2429's half days.
    expect(dates('TR', 2027)).toEqual(['2027-01-01', '2027-03-08@13:00', '2027-03-09+3', '2027-04-23', '2027-05-01', '2027-05-15@13:00', '2027-05-16+4',
      '2027-05-19', '2027-07-15', '2027-08-30', '2027-10-28@13:00', '2027-10-29']);
    // The State Council's 2026 notice, and 2027's statutory days until its notice.
    expect(holidayYear(row('CN'), 2026)!.days.filter(e => e.t === 'w').map(e => e.d)).toEqual(['2026-01-04', '2026-02-14', '2026-02-28', '2026-05-09', '2026-09-20', '2026-10-10']);
    expect(holidayYear(row('CN'), 2027)).toMatchObject({ pending: 1 });
    expect(holidayYear(row('CN'), 2025)).toBeNull();
  });
});

describe('holiday facts', () => {
  it('count Germany 2027 the way its calendar reads', () => {
    const f = yearFacts(row('DE'), 2027)!;
    // Nine nationwide holidays; 1 May, 3 Oct and both Christmas days fall on weekends.
    expect([f.holidays, f.onWeekdays, f.substitutes]).toEqual([9, 5, 0]);
    expect(f.longWeekends.map(r => `${r.from}/${r.days}`)).toEqual(['2027-01-01/3', '2027-03-26/4', '2027-05-15/3']);
    // Ascension on Thursday 6 May leaves Friday 7 as the bridge.
    expect(f.bridges.map(b => `${b.day}/${b.run.days}`)).toContain('2027-05-07/4');
  });

  it('give Turkey 2027 its bayrams, half days and the 5 days off around Kurban Bayramı', () => {
    const f = yearFacts(row('TR'), 2027)!;
    // 19 May is both Atatürk's day and Kurban Bayramı's fourth: thirteen days, eleven of them weekdays.
    expect([f.holidays, f.onWeekdays, f.halfDays, f.multiDay]).toEqual([13, 11, 2, true]);
    expect(f.longest).toMatchObject({ from: '2027-05-15', to: '2027-05-19', days: 5 });
    // The arife on Monday 8 March, a half day, joins the weekend to Ramazan Bayramı.
    expect(f.bridges.find(b => b.day === '2027-03-08')).toMatchObject({ half: true, run: { from: '2027-03-06', to: '2027-03-11' } });
  });

  it('count each UK nation’s bank holidays as GOV.UK does', () => {
    expect(['ENG', 'SCT', 'NIR'].map(n => regionDaysOff(row('GB'), 2027, n))).toEqual([8, 9, 10]);
  });

  it('count the US substitute days OPM gives', () => {
    const f = yearFacts(row('US'), 2027)!;
    // 18 Jun, 5 Jul, 24 Dec and 31 Dec (New Year's Day 2028).
    expect(f.substitutes).toBe(4);
    expect(f.longWeekends.at(-1)).toMatchObject({ from: '2027-12-31', to: '2028-01-02' });
  });

  it('use the country’s own weekend', () => {
    // Germany's rules with a Friday and Saturday weekend: Ascension, Thursday 6 May 2027, starts three days off.
    const f = yearFacts({ ...row('DE'), weekend: [5, 6] }, 2027)!;
    expect(f.longWeekends.map(r => `${r.from}/${r.days}`)).toContain('2027-05-06/3');
  });

  it('find the next holiday from a country’s date', () => {
    expect(nextHoliday(row('DE'), '2027-05-06')).toMatchObject({ days: 0, entry: { d: '2027-05-06' } });
    expect(nextHoliday(row('DE'), '2027-12-27')).toMatchObject({ days: 5, entry: { d: '2028-01-01' } });
  });
});
