import { describe, expect, it } from 'vitest';
import { parsePanelLink, parseViewModeLink, viewModeQuery, yearStart } from './view-mode-link';

const NOW = Date.parse('2026-10-19T12:00:00Z');
const parse = (q: string) => parseViewModeLink(new URLSearchParams(q), NOW);

describe('parseViewModeLink', () => {
  it('reads History at a year, and leaves out a year it cannot show', () => {
    expect(parse('view=history&year=1914')).toEqual({ view: 'history', year: 1914, layer: null });
    expect(parse('view=history&year=-500')).toMatchObject({ year: -500 });
    expect(parse('view=history&year=2999')).toMatchObject({ year: null });
    expect(parse('view=history&year=19x4')).toMatchObject({ year: null });
  });

  it('switches on only border layers it knows', () => {
    expect(parse('view=history&year=1939&layer=ww2-europe')).toMatchObject({ layer: 'ww2-europe' });
    expect(parse('view=history&layer=anything')).toMatchObject({ layer: null });
  });

  it('reads deep time by millions of years or by chapter', () => {
    expect(parse('view=deep&ma=250')).toEqual({ view: 'deep', ma: 250, chapter: null });
    expect(parse('view=deep&chapter=2')).toEqual({ view: 'deep', ma: null, chapter: 2 });
  });

  it('falls back to the solar system for a body it does not know', () => {
    expect(parse('view=space&focus=mars')).toEqual({ view: 'space', focus: 'mars' });
    expect(parse('view=space&focus=pluto')).toEqual({ view: 'space', focus: 'solar' });
  });

  it('refuses a replay moment in the future', () => {
    expect(parse(`view=replay&at=${NOW - 3_600_000}`)).toEqual({ view: 'replay', at: NOW - 3_600_000 });
    expect(parse(`view=replay&at=${NOW + 3_600_000}`)).toEqual({ view: 'replay', at: null });
  });

  it('ignores links without a view', () => {
    expect(parse('layers=earthquakes')).toBeNull();
  });

  it('writes what it reads', () => {
    for (const q of ['view=history&year=1683&layer=world-borders', 'view=deep&ma=66', 'view=space&focus=moon']) expect(viewModeQuery(parse(q)!)).toBe(q);
  });
});

describe('yearStart', () => {
  it('keeps the first century as it is', () => {
    expect(new Date(yearStart(50)).getUTCFullYear()).toBe(50);
    expect(new Date(yearStart(1914)).toISOString()).toBe('1914-01-01T00:00:00.000Z');
  });
});

describe('parsePanelLink', () => {
  it('opens only panels it knows', () => {
    expect(parsePanelLink(new URLSearchParams('panel=route'))).toBe('route');
    expect(parsePanelLink(new URLSearchParams('panel=admin'))).toBeNull();
  });
});
