import { describe, expect, it } from 'vitest';
import { jewishHolidays, jewishYear, monthsOf } from './jewish-holidays';

// First days as hebcal.com gives them (its API, maj=on; i=on for Israel), checked 2026-10-21.
describe('jewishYear', () => {
  it('gives 2027 as hebcal does, outside Israel and in it', () => {
    const h = jewishYear(2027).holidays;
    expect([h.purim.first, h.passover.first, h.passover.last, h.passover.israel, h.shavuot.first, h.shavuot.last, h.tishaBav.first])
      .toEqual(['2027-03-23', '2027-04-22', '2027-04-29', '2027-04-28', '2027-06-11', '2027-06-12', '2027-08-12']);
    expect([h.roshHashanah.first, h.roshHashanah.last, h.yomKippur.first, h.sukkot.first, h.simchatTorah.first, h.simchatTorah.israel, h.hanukkah.first, h.hanukkah.last])
      .toEqual(['2027-10-02', '2027-10-03', '2027-10-11', '2027-10-16', '2027-10-24', '2027-10-23', '2027-12-25', '2028-01-01']);
    expect([h.roshHashanah.eve, h.yomKippur.eve, h.passover.eve, h.hanukkah.eve]).toEqual(['2027-10-01', '2027-10-10', '2027-04-21', '2027-12-24']);
    expect(jewishYear(2027).hebrewYear).toBe(5788);
  });

  it('puts Purim in Adar II in a leap year and Adar in a common one', () => {
    expect([monthsOf(5784).length, jewishYear(2024).holidays.purim.first]).toEqual([13, '2024-03-24']);
    expect([monthsOf(5785).length, jewishYear(2025).holidays.purim.first]).toEqual([12, '2025-03-14']);
  });

  it('moves Tisha B’Av off Shabbat to Sunday', () => {
    expect([jewishYear(2019).holidays.tishaBav.first, jewishYear(2019).holidays.tishaBav.moved]).toEqual(['2019-08-11', true]);
    expect([jewishYear(2022).holidays.tishaBav.first, jewishYear(2022).holidays.tishaBav.moved]).toEqual(['2022-08-07', true]);
    expect([jewishYear(2025).holidays.tishaBav.first, jewishYear(2025).holidays.tishaBav.moved]).toEqual(['2025-08-03', undefined]);
  });

  it('matches hebcal at both ends of the table', () => {
    const a = jewishYear(2016).holidays, b = jewishYear(2036).holidays;
    expect([a.purim.first, a.passover.first, a.roshHashanah.first, a.hanukkah.first]).toEqual(['2016-03-24', '2016-04-23', '2016-10-03', '2016-12-25']);
    expect([b.purim.first, b.passover.first, b.roshHashanah.first, b.yomKippur.first, b.hanukkah.first]).toEqual(['2036-03-13', '2036-04-12', '2036-09-22', '2036-10-01', '2036-12-14']);
  });
});

describe('jewishHolidays', () => {
  it('leads with the next Rosh Hashanah, Yom Kippur and Passover, and marks the next holiday', () => {
    const d = jewishHolidays('2026-10-21');
    expect([d.lead.roshHashanah.first, d.lead.yomKippur.first, d.lead.passover.first, d.lead.begun]).toEqual(['2027-10-02', '2027-10-11', '2027-04-22', false]);
    expect([d.following.roshHashanah.first, d.following.passover.first]).toEqual(['2028-09-21', '2028-04-11']);
    expect([d.next.key, d.next.first, d.now]).toEqual(['hanukkah', '2026-12-05', false]);
    expect([d.rows[0].year, d.rows[d.rows.length - 1].year, d.rows.length]).toEqual([2016, 2036, 21]);
  });

  it('keeps the High Holy Days between Rosh Hashanah and Yom Kippur, and counts a holiday under way', () => {
    const d = jewishHolidays('2027-10-05');
    expect([d.lead.roshHashanah.first, d.lead.begun, d.lead.passover.first]).toEqual(['2027-10-02', true, '2028-04-11']);
    expect([d.next.key, d.now]).toEqual(['yomKippur', false]);
    expect([jewishHolidays('2027-04-25').next.key, jewishHolidays('2027-04-25').now]).toEqual(['passover', true]);
    expect(jewishHolidays('2027-10-11').lead.roshHashanah.first).toBe('2028-09-21');
  });
});
