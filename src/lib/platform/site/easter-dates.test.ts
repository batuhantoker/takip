import { describe, expect, it } from 'vitest';
import { easterDates, easterYear, julianToGregorian, orthodoxEaster, westernEaster } from './easter-dates';

// Western and Orthodox Easter, 2016–2036: Wikipedia's Template:Table of dates of Easter, after the WCC's 1997 table.
const PUBLISHED: [number, string, string][] = [
  [2016, '03-27', '05-01'], [2017, '04-16', '04-16'], [2018, '04-01', '04-08'], [2019, '04-21', '04-28'], [2020, '04-12', '04-19'],
  [2021, '04-04', '05-02'], [2022, '04-17', '04-24'], [2023, '04-09', '04-16'], [2024, '03-31', '05-05'], [2025, '04-20', '04-20'],
  [2026, '04-05', '04-12'], [2027, '03-28', '05-02'], [2028, '04-16', '04-16'], [2029, '04-01', '04-08'], [2030, '04-21', '04-28'],
  [2031, '04-13', '04-13'], [2032, '03-28', '05-02'], [2033, '04-17', '04-24'], [2034, '04-09', '04-09'], [2035, '03-25', '04-29'],
  [2036, '04-13', '04-20'],
];

describe('the computus', () => {
  it('gives the published Western and Orthodox Easter for 2016 to 2036', () => {
    for (const [year, western, orthodox] of PUBLISHED) {
      expect([year, westernEaster(year), orthodoxEaster(year)]).toEqual([year, `${year}-${western}`, `${year}-${orthodox}`]);
    }
  });

  it('knows the extremes and the century shift of the Julian calendar', () => {
    expect([westernEaster(1818), westernEaster(1943), westernEaster(2285)]).toEqual(['1818-03-22', '1943-04-25', '2285-03-22']);
    expect([orthodoxEaster(2010), orthodoxEaster(1983)]).toEqual(['2010-04-04', '1983-05-08']);
    expect([julianToGregorian(2025, 12, 25), julianToGregorian(2100, 12, 25)]).toEqual(['2026-01-07', '2101-01-08']);
  });
});

describe('easterYear', () => {
  it('hangs the feasts on each Easter', () => {
    const y = easterYear(2027);
    expect([y.ashWednesday, y.palmSunday, y.goodFriday, y.easterMonday, y.ascension, y.pentecost])
      .toEqual(['2027-02-10', '2027-03-21', '2027-03-26', '2027-03-29', '2027-05-06', '2027-05-16']);
    expect([y.orthodoxGoodFriday, y.orthodoxEaster, y.orthodoxPentecost, y.same]).toEqual(['2027-04-30', '2027-05-02', '2027-06-20', false]);
    expect([y.christmas, y.julianChristmas]).toEqual(['2027-12-25', '2027-01-07']);
  });

  it('marks the years both churches keep the same day', () => {
    expect(PUBLISHED.map(([year]) => easterYear(year)).filter(y => y.same).map(y => y.year)).toEqual([2017, 2025, 2028, 2031, 2034]);
  });
});

describe('easterDates', () => {
  it('answers for this year until its Orthodox Easter has passed, then next year', () => {
    expect(easterDates('2027-03-01').nearest.year).toBe(2027);
    expect(easterDates('2027-04-10').nearest.year).toBe(2027);
    expect(easterDates('2027-05-02').nearest.year).toBe(2027);
    const d = easterDates('2026-10-21');
    expect([d.thisYear, d.nearest.year, d.following.year]).toEqual([2026, 2027, 2028]);
    expect([d.rows[0].year, d.rows[d.rows.length - 1].year, d.rows.length]).toEqual([2016, 2036, 21]);
  });
});
