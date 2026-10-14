import { describe, expect, it } from 'vitest';
import { borderWindow, clockYear, clockYearLabel, powerColor, worldBorderPopupHtml, yearsSpan, yearStart } from './world-borders';

const s = (year: number) => yearStart(year) / 1000;

describe('world borders', () => {
  it('fetches the span of years showing and the next one', () => {
    expect(borderWindow(yearStart(-3401))).toBeNull();
    expect(borderWindow(Date.UTC(1917, 5, 1))).toEqual({ from: yearStart(1900), next: yearStart(1920), to: yearStart(1940) });
    expect(borderWindow(yearStart(-499))).toEqual({ from: yearStart(-500), next: yearStart(-400), to: yearStart(-300) });
    expect(borderWindow(Date.UTC(2026, 0, 1))).toEqual({ from: yearStart(2020), next: yearStart(2040), to: yearStart(2060) });
  });

  it('counts years as the clock does', () => {
    expect(clockYear(yearStart(-499))).toBe(-499);
    expect(clockYearLabel(-499)).toBe('500 BCE');
    expect(clockYearLabel(1914)).toBe('1914');
  });

  it('gives a power one colour everywhere', () => {
    expect(powerColor('France')).toBe(powerColor('France'));
    expect(new Set(['France', 'Spain', 'Portugal', 'Ottoman Empire', 'Russian Empire', 'Qing Dynasty'].map(powerColor)).size).toBeGreaterThan(2);
  });

  it('spans the years a shape holds', () => {
    expect(yearsSpan(s(1914), s(1915))).toBe('1914');
    expect(yearsSpan(s(1924), s(1936))).toBe('1924 – 1935');
    expect(yearsSpan(s(-499), s(-399))).toBe('500 BCE – 401 BCE');
    expect(yearsSpan(s(2006), null)).toBe('since 2006');
  });

  it('writes the popup', () => {
    const html = worldBorderPopupHtml({ id: 1, name: 'British Raj', subject: 'British Empire', wiki: null, wikidata: 'Q129286', t0: s(1914), t1: s(1920) });
    expect(html).toContain('Part of British Empire');
    expect(html).toContain('1914 – 1919');
    expect(html).toContain('Special:Search?search=British%20Raj');
    expect(html).toContain('https://www.wikidata.org/wiki/Q129286');
    expect(worldBorderPopupHtml({ id: 2, name: 'Ottoman Empire', subject: null, wiki: null, wikidata: null, t0: s(1914), t1: null })).toContain('Polity');
  });
});
