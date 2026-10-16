import { describe, expect, it } from 'vitest';
import { calendarTicks, deepTicks, yearLabel } from './timeline-ticks';

const utc = (y: number, m = 0, d = 1, h = 0) => {
  const t = new Date(0);
  t.setUTCFullYear(y, m, d);
  t.setUTCHours(h);
  return t.getTime();
};
const labels = (lo: number, hi: number, max: number) => calendarTicks(lo, hi, max).map(t => t.label);

describe('calendarTicks', () => {
  it('marks a day in hours, naming midnight by its date', () => {
    expect(labels(utc(2026, 9, 12, 4), utc(2026, 9, 13, 4), 10)).toEqual(['06:00', '09:00', '12:00', '15:00', '18:00', '21:00', '13 Oct', '03:00']);
  });

  it('marks a month every few days from the 1st', () => {
    expect(labels(utc(2026, 8, 13), utc(2026, 9, 13), 8)).toEqual(['16 Sep', '21 Sep', '26 Sep', '1 Oct', '6 Oct', '11 Oct']);
  });

  it('marks a year in months, with the year at January', () => {
    expect(labels(utc(2025, 9, 13), utc(2026, 9, 13), 6)).toEqual(['Nov', '2026', 'Mar', 'May', 'Jul', 'Sep']);
  });

  it('marks centuries in round decades', () => {
    expect(labels(utc(1900), utc(2026, 9, 13), 8)).toEqual(['1900', '1920', '1940', '1960', '1980', '2000', '2020']);
  });

  it('counts across the common era without a year 0', () => {
    const ticks = calendarTicks(utc(-9999), utc(2026, 9, 13), 8);
    expect(ticks.map(t => t.label)).toEqual(['10,000 BCE', '8000 BCE', '6000 BCE', '4000 BCE', '2000 BCE', '1 CE', '2000']);
    expect(ticks[5].at).toBe(utc(1));
  });
});

describe('deepTicks', () => {
  it('marks round millions of years, oldest first', () => {
    expect(deepTicks(-540e6, 0, 6).map(t => t.label)).toEqual(['500 Ma', '400 Ma', '300 Ma', '200 Ma', '100 Ma', 'Now']);
  });
});

describe('yearLabel', () => {
  it('writes BCE years the way historians do', () => {
    expect(yearLabel(-500)).toBe('500 BCE');
    expect(yearLabel(-12_000)).toBe('12,000 BCE');
  });
});
