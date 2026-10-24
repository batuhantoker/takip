import { describe, expect, it } from 'vitest';
import { HISTORY_FAMILIES } from '@/lib/history/popup';
import { HISTORY_FAMILY_LINKS, parsePanelLink, parseViewModeLink, viewModeQuery, yearStart } from './view-mode-link';

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

  it('reads a span of years, and leaves out one that runs backwards or past today', () => {
    expect(parse('view=history&year=2017&from=2017&to=2026')).toEqual({ view: 'history', year: 2017, layer: null, range: { from: 2017, to: 2026 } });
    expect(parse('view=history&from=-500&to=-400')).toMatchObject({ range: { from: -500, to: -400 } });
    expect(parse('view=history&from=2026&to=2017')).not.toHaveProperty('range');
    expect(parse('view=history&from=2017&to=2999')).not.toHaveProperty('range');
    expect(parse('view=history&from=2017')).not.toHaveProperty('range');
  });

  it('switches on only event families History has', () => {
    expect(parse('view=history&families=hazard,disaster,hazard')).toMatchObject({ families: ['hazard', 'disaster'] });
    expect(parse('view=history&families=aliens')).not.toHaveProperty('families');
    for (const f of HISTORY_FAMILY_LINKS) expect(HISTORY_FAMILIES).toHaveProperty(f);
  });

  it('draws only the event kinds History has', () => {
    expect(parse('view=history&families=disaster&kinds=accident.aviation,accident.rail,accident.aviation')).toMatchObject({ families: ['disaster'], kinds: ['accident.aviation', 'accident.rail'] });
    expect(parse('view=history&kinds=battle,aliens,constructor,__proto__')).toMatchObject({ kinds: ['battle'] });
    expect(parse('view=history&kinds=aliens')).not.toHaveProperty('kinds');
    expect(parse('view=history&kinds=')).not.toHaveProperty('kinds');
  });

  it('colours countries only by a metric code it can read, with its source and charted country', () => {
    expect(parse('view=history&year=1950&metric=wpp:LEx&source=wpp-2024&country=TUR')).toMatchObject({ metric: 'wpp:LEx', source: 'wpp-2024', countries: ['TUR'] });
    expect(parse('view=history&metric=wdi:NY.GDP.PCAP.KD')).toMatchObject({ metric: 'wdi:NY.GDP.PCAP.KD' });
    expect(parse('view=history&metric=owid:le_0&country=SDS')).toMatchObject({ metric: 'owid:le_0', countries: ['SDS'] });
    for (const bad of ['metric=LEx', 'metric=wpp:LEx%3Cscript%3E', 'metric=wpp:a%20b', `metric=wpp:${'x'.repeat(60)}`]) {
      expect(parse(`view=history&${bad}`)).not.toHaveProperty('metric');
    }
    expect(parse('view=history&metric=wpp:LEx&source=WPP 2024&country=tr')).toEqual({ view: 'history', year: null, layer: null, metric: 'wpp:LEx' });
    expect(parse('view=history&source=wpp-2024&country=TUR')).toEqual({ view: 'history', year: null, layer: null });
  });

  it('charts up to four countries, dropping any id it can not read', () => {
    expect(parse('view=history&metric=wpp:LEx&country=GRC,TUR,GRC,tur,X1Y')).toMatchObject({ countries: ['GRC', 'TUR'] });
    expect(parse('view=history&metric=wpp:LEx&country=AAA,BBB,CCC,DDD,EEE')).toMatchObject({ countries: ['AAA', 'BBB', 'CCC', 'DDD'] });
    expect(parse('view=history&metric=wpp:LEx&country=,')).not.toHaveProperty('countries');
  });

  it('reads deep time by millions of years or by chapter', () => {
    expect(parse('view=deep&ma=250')).toEqual({ view: 'deep', ma: 250, chapter: null });
    expect(parse('view=deep&chapter=2')).toEqual({ view: 'deep', ma: null, chapter: 2 });
  });

  it('falls back to the solar system for a body it does not know', () => {
    expect(parse('view=space&focus=mars')).toEqual({ view: 'space', focus: 'mars' });
    expect(parse('view=space&focus=pluto')).toEqual({ view: 'space', focus: 'solar' });
  });

  it('selects a craft, rover, landing site or body in space, or replays a flight', () => {
    expect(parse('view=space&focus=mars&craft=-76')).toEqual({ view: 'space', focus: 'mars', select: { kind: 'craft', id: -76 } });
    expect(parse('view=space&focus=mars&rover=curiosity')).toMatchObject({ select: { kind: 'rover', id: 'curiosity' } });
    expect(parse('view=space&focus=moon&site=moon:apollo-11')).toMatchObject({ select: { kind: 'site', world: 'moon', id: 'apollo-11' } });
    expect(parse('view=space&body=jupiter')).toMatchObject({ select: { kind: 'body', key: 'jupiter' } });
    expect(parse('view=space&replay=-31')).toEqual({ view: 'space', focus: 'solar', replay: -31 });
    expect(parse('view=space&craft=76&site=venus:x&body=vulcan&replay=abc')).toEqual({ view: 'space', focus: 'solar' });
  });

  it('refuses a replay moment in the future', () => {
    expect(parse(`view=replay&at=${NOW - 3_600_000}`)).toEqual({ view: 'replay', at: NOW - 3_600_000 });
    expect(parse(`view=replay&at=${NOW + 3_600_000}`)).toEqual({ view: 'replay', at: null });
  });

  it('ignores links without a view', () => {
    expect(parse('layers=earthquakes')).toBeNull();
  });

  it('writes what it reads', () => {
    for (const q of [
      'view=history&year=1683&layer=world-borders', 'view=history&year=1927&from=1927&to=2026&families=hazard',
      'view=history&year=1950&from=1950&to=2026&families=disaster&kinds=accident.aviation%2Caccident.rail',
      'view=history&year=1950&from=1950&to=2026&metric=wpp%3ALEx&source=wpp-2024&country=GRC%2CTUR', 'view=deep&ma=66', 'view=space&focus=moon',
      'view=space&focus=mars&rover=curiosity', 'view=space&focus=solar&craft=-31&replay=-31',
    ]) {
      expect(viewModeQuery(parse(q)!)).toBe(q);
    }
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
