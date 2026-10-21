import { describe, expect, it } from 'vitest';
import { ramadanDates } from './ramadan-dates';

describe('ramadanDates', () => {
  it('answers with the next Ramadan and the one after, and lists ten years either side', () => {
    const d = ramadanDates('2026-10-21');
    expect([d.nearest.hijriYear, d.nearest.start, d.nearest.eid, d.day]).toEqual([1448, '2027-02-08', '2027-03-09', null]);
    expect(d.following.start).toBe('2028-01-28');
    expect([d.nearest.tarawih, d.nearest.qadr, d.nearest.eidAlAdha]).toEqual(['2027-02-07', '2027-03-05', '2027-05-16']);
    expect(d.thisYears.map(r => r.hijriYear)).toEqual([1447]);
    expect(d.nextYears.map(r => r.hijriYear)).toEqual([1448]);
    expect([d.rows[0].year, d.rows[d.rows.length - 1].year, d.rows.length]).toEqual([2016, 2036, 22]);
  });

  it('counts the day while Ramadan is under way, and moves on after its last day', () => {
    expect(ramadanDates('2027-02-20').day).toBe(13);
    expect(ramadanDates('2027-03-09').nearest.hijriYear).toBe(1449);
  });

  it('gives 2030 both its Ramadans, the second marked', () => {
    const d = ramadanDates('2029-06-01');
    expect(d.nextYears.map(r => [r.hijriYear, r.start, r.twin])).toEqual([[1451, '2030-01-05', false], [1452, '2030-12-26', true]]);
    expect(d.rows.filter(r => r.year === 2030)).toHaveLength(2);
  });
});
