import { Prec } from '@takip/core/time';
import { describe, expect, it } from 'vitest';
import { createTranslator } from '@/lib/core/i18n/translator';
import { parseViewModeLink } from '@/lib/map/view-mode-link';
import { eventOpenPath, eventYears, isoDate, magnitudeRow } from './copy';
import type { EventPage } from './event-page';

const s = (year: number, month = 0, day = 1) => {
  const d = new Date(0);
  d.setUTCFullYear(year, month, day);
  return d.getTime() / 1000;
};

const event = (over: Partial<EventPage> = {}): EventPage => ({
  slug: 'x-1915', indexed: true, id: 1, title: 'X', kind: 'battle', family: 'conflict', t0: s(1915, 3, 25), t1: s(1916), tStart: s(1915, 3, 25),
  tEnd: null, prec: Prec.day, endPrec: null, ongoing: 0, lon: 26.4, lat: 40.2, geoPrec: 1, magnitude: null, attrs: {}, wiki: null, sources: [],
  partOf: [], parts: { total: 0, shown: [] }, related: { total: 0, shown: [] }, nearby: [], ...over,
});

const en = createTranslator('en', {});

describe('event page copy', () => {
  it('writes schema.org dates at the stated precision, years astronomically', () => {
    expect(isoDate(s(1915, 3, 25), Prec.day)).toBe('1915-04-25');
    expect(isoDate(s(1915, 3, 25), Prec.month)).toBe('1915-04');
    expect(isoDate(s(-479, 8, 22), Prec.year)).toBe('-0479');
  });

  it('names the years for the title', () => {
    expect(eventYears(en, event())).toBe('1915');
    expect(eventYears(en, event({ tStart: s(1914, 6, 28), tEnd: s(1918, 10, 11), endPrec: Prec.day }))).toBe('1914 – 1918');
    expect(eventYears(en, event({ tStart: s(-479), prec: Prec.year }))).toBe('480 BCE');
  });

  it('gives the death toll with its range, as the popup does', () => {
    expect(magnitudeRow(en, event({ magnitude: 1200 }), [900, 1500])).toEqual({ label: 'Deaths', value: '1,200 (900–1,500)' });
    expect(magnitudeRow(en, event({ family: 'territorial', magnitude: 3 }))).toBeNull();
  });

  it('opens History at the event’s year and place, with its family, clamped to the years History takes', () => {
    const link = parseViewModeLink(new URL(eventOpenPath(event()), 'http://x').searchParams);
    expect(link).toMatchObject({ view: 'history', year: 1915, families: ['conflict'] });
    const old = parseViewModeLink(new URL(eventOpenPath(event({ tStart: s(-7500) })), 'http://x').searchParams);
    expect(old).toMatchObject({ view: 'history', year: -3000 });
  });
});
