import { Prec } from '@takip/core/time';
import { describe, expect, it } from 'vitest';
import { formatAt, historyPopupHtml } from './popup';

const s = (iso: string) => Date.parse(iso) / 1000;

describe('history popup', () => {
  it('writes a time at its precision, BCE included', () => {
    expect(formatAt(s('1916-07-01'), Prec.day)).toBe('1 Jul 1916');
    expect(formatAt(s('1916-07-01'), Prec.month)).toBe('Jul 1916');
    expect(formatAt(s('1916-07-01'), Prec.year)).toBe('1916');
    expect(formatAt(s('1916-07-01'), Prec.decade)).toBe('1910s');
    expect(formatAt(s('1916-07-01'), Prec.century)).toBe('20th century');
    const bce = new Date(0);
    bce.setUTCFullYear(-499, 0, 1);
    expect(formatAt(bce.getTime() / 1000, Prec.year)).toBe('500 BCE');
  });

  it('leaves out a magnitude the map feature dropped, and escapes text', () => {
    const p = { id: 1, kind: 'battle', family: 'conflict', title: '<b>Somme</b>', t0: s('1916-07-01'), t1: s('1916-07-02'), prec: Prec.day, ongoing: 0, geoPrec: 1 };
    const html = historyPopupHtml(p, { ...p, tStart: p.t0, tEnd: s('1916-11-18'), endPrec: Prec.day, attrs: { outcome: 'Inconclusive', url: 'javascript:alert(1)' } });
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('DEATHS');
    expect(html).toContain('&lt;b&gt;Somme&lt;/b&gt;');
    expect(html).toContain('1 Jul 1916 – 18 Nov 1916');
    expect(html).toContain('Inconclusive');
    expect(html).not.toContain('javascript:');
  });

  it('shows quake magnitude to one decimal and links the source page', () => {
    const p = { id: 2, kind: 'hazard.quake', family: 'hazard', title: 'M 6.1 - Crete', t0: s('2026-10-01'), t1: s('2026-10-01'), prec: Prec.second, ongoing: 0, geoPrec: 1, magnitude: 6.12 };
    const html = historyPopupHtml(p, { ...p, tStart: p.t0, tEnd: null, endPrec: null, attrs: { url: 'https://earthquake.usgs.gov/earthquakes/eventpage/us7000abcd' } });
    expect(html).toContain('6.1');
    expect(html).toContain('href="https://earthquake.usgs.gov/earthquakes/eventpage/us7000abcd"');
  });
});
