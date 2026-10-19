import { describe, expect, it } from 'vitest';
import { EN } from '../copy/format';
import type { HazardEvent, HazardMeta, HazardRange, HazardRangeId, HazardRow } from './hazards-data';
import { hazardDate, hazardEventCount, hazardFacts, hazardIndexed, hazardLinks, hazardSentences, MIN_EVENTS, quakeTie } from './hazards-facts';

const quake = (d: string, m: number, extra: Partial<HazardEvent> = {}): HazardEvent => ({ k: 'q', d, m, at: [35, 38], ...extra });

// Keys as the builder writes them: USGS ids, and NOAA's own for what USGS doesn't list.
const EVENTS: Record<string, HazardEvent> = {
  great: quake('2023-02-06', 7.8, { where: 'Pazarcik earthquake', deaths: 59259, n: 1, wiki: '2023 Turkey–Syria earthquakes' }),
  second: quake('2023-02-06', 6.7, { where: '9 km E of Nurdagi, Turkey' }),
  third: quake('2020-10-30', 6.6, { where: 'Samos', deaths: 119, n: 2 }),
  small1: quake('2019-03-20', 5.7, { where: '8 km E of Acipayam, Turkey', deaths: 3, n: 3 }),
  small2: quake('2021-06-01', 5.2),
  small3: quake('2024-08-01', 4.9, { n: 4 }),
  'eq:5': quake('1268', 7, { where: 'Cilicia', n: 5 }),
  'ts:6': { k: 't', d: '1956-07-09', m: 7.7, h: 30, deaths: 53, at: [25.9, 36.6], where: 'Amorgos', n: 6 },
  'vo:7': { k: 'v', d: '-1609', m: 7, at: [25.4, 36.4], where: 'Santorini', n: 7 },
};
const META: HazardMeta = { asOf: '2026-10-19', floors: { '10y': 4.5, '100y': 6, all: 6 }, usgsSince: 1900, cityKm: 100, cityBigKm: 200, bigMag: 7, seaKm: 100, farSeaKm: 300, events: EVENTS };

const range = (r: Partial<HazardRange>): HazardRange => ({
  from: 2017, to: 2026, usgs: 0, m6: 0, m7: 0, quakes: 0, quakesUnmatched: 0, tsunamis: 0, tsunamisFrom: 0, tsunamisUnlinked: 0,
  eruptions: 0, volcanoes: 0, deaths: 0, deadly: 0, top: [], ...r,
});

const say = (row: HazardRow, r: HazardRangeId, place = 'Türkiye', scope: 'country' | 'city' = 'country') =>
  hazardSentences(hazardFacts(row, r, META, scope)!, place, EN).join(' ');

describe('the index threshold', () => {
  it('counts each event once across USGS and NOAA', () => {
    const r = range({ usgs: 3, quakes: 2, quakesUnmatched: 1, eruptions: 1, tsunamis: 2, tsunamisUnlinked: 1 });
    expect(hazardEventCount(r)).toBe(6);
  });

  it(`indexes from ${MIN_EVENTS} events, and not below`, () => {
    expect(hazardIndexed(range({ usgs: MIN_EVENTS - 1 }))).toBe(false);
    expect(hazardIndexed(range({ usgs: MIN_EVENTS - 1, eruptions: 1 }))).toBe(true);
    expect(hazardIndexed(range({ quakes: 9 }))).toBe(false);
  });
});

describe('hazardFacts', () => {
  it('sees one great quake far above the rest, and says it was also the deadliest', () => {
    const row = { '10y': range({ usgs: 40, m6: 2, m7: 1, quakes: 3, deaths: 59378, deadly: 2, top: ['great', 'second', 'small1'] }) };
    const f = hazardFacts(row, '10y', META, 'country')!;
    expect(f.shape).toBe('one-great');
    expect(f.strongest?.id).toBe('great');
    expect(f.runnerUp?.id).toBe('second');
    const text = say(row, '10y');
    expect(text).toContain('From 2017 to October 19, 2026, USGS recorded 40 earthquakes of magnitude 4.5 or more in or off Türkiye.');
    expect(text).toContain('One stands far above the rest: a magnitude 7.8 on February 6, 2023 (Pazarcik earthquake). The next strongest reached 6.7.');
    expect(text).toContain('It was also the deadliest: NOAA records 59,259 deaths for it.');
  });

  it('says when the deadliest was not the strongest', () => {
    const row = { '10y': range({ usgs: 12, m6: 2, quakes: 2, deaths: 122, deadly: 2, top: ['third', 'small1', 'second'] }) };
    const text = say(row, '10y');
    expect(text).toContain('The strongest was a magnitude 6.7 on February 6, 2023');
    expect(text).toContain('The deadliest was not the strongest: a magnitude 6.6 on October 30, 2020 (Samos), for which NOAA records 119 deaths.');
    expect(text).toContain('NOAA records deaths in 2 of the events here, 122 in all.');
  });

  it('calls a run of quakes with nothing large moderate', () => {
    const row = { '10y': range({ usgs: 20, quakes: 1, top: ['small1', 'small2', 'small3'] }) };
    expect(hazardFacts(row, '10y', META, 'country')!.shape).toBe('moderate');
    expect(say(row, '10y')).toContain('None reached magnitude 6: the strongest was a magnitude 5.7 on March 20, 2019 (8 km E of Acipayam, Turkey).');
  });

  it('names the busiest year and the quakes that followed its strongest', () => {
    const by = [1, 2, 1, 1, 2, 1, 30, 1, 1, 0];
    const row = { '10y': range({ usgs: 40, m7: 1, by, top: ['great', 'small2'], peak: { id: 'great', after: 24 } }) };
    const text = say(row, '10y');
    expect(text).toContain('2023 had the most magnitude 4.5+ earthquakes: 30 of the 40.');
    expect(text).toContain('24 came in the 30 days after the strongest, within 150 km of it.');
  });

  it('compares the two halves of ten years when no single year stands out', () => {
    const row = { '10y': range({ usgs: 60, by: [2, 3, 2, 3, 2, 8, 10, 9, 11, 10], top: ['small2'] }) };
    expect(say(row, '10y')).toContain('48 came from 2022 on, against 12 in the five years before.');
  });

  it('opens the whole record with its oldest event, and says how thin the record grows', () => {
    const row = {
      '100y': range({ from: 1927, usgs: 60, quakes: 40 }),
      all: range({ from: -1609, usgs: 90, quakes: 160, quakesUnmatched: 120, eruptions: 1, volcanoes: 1, tsunamis: 1, deaths: 59259, deadly: 1, top: ['great', 'eq:5', 'ts:6', 'vo:7'] }),
    };
    const text = say(row, 'all');
    expect(text).toContain('From 1900 to October 19, 2026, USGS recorded 90 earthquakes of magnitude 6 or more');
    expect(text).toContain('NOAA’s record here begins in 1610 BCE with an eruption (Santorini).');
    expect(text).toContain('It grows thinner going back: 40 of the 160 significant earthquakes NOAA lists here are from 1927 on.');
    expect(text).toContain('NOAA’s list of significant earthquakes has 160 here, back to 1610 BCE.');
    expect(text).toContain('NOAA lists one tsunami that began in or off Türkiye. It reached 30 m, on July 9, 1956.');
    expect(text).toContain('The largest was Santorini in 1610 BCE, at 7 on the volcanic explosivity index.');
  });

  it('says how much of an old record came before the last hundred years, without calling it thin', () => {
    const row = { '100y': range({ from: 1927, quakes: 6 }), all: range({ from: 29, usgs: 3, quakes: 56, quakesUnmatched: 50, top: ['eq:5', 'third'] }) };
    const text = say(row, 'all', 'Istanbul', 'city');
    expect(text).toContain('50 of the 56 significant earthquakes NOAA lists here came before 1927.');
    expect(text).not.toContain('thinner');
    expect(text).toContain('The strongest on either list was an estimated magnitude 7 in 1268 (Cilicia).');
    expect(text).toContain('back to AD 29');
  });

  it('marks a magnitude before instruments as an estimate', () => {
    const row = { all: range({ from: 1268, quakes: 6, quakesUnmatched: 6, top: ['eq:5'] }) };
    expect(say(row, 'all')).toContain('an estimated magnitude 7 in 1268 (Cilicia)');
  });

  it('says "in" for a country where nothing counted at sea', () => {
    expect(say({ inland: true, '10y': range({ usgs: 6, top: ['small2'] }) }, '10y', 'Armenia')).toContain('or more in Armenia.');
  });

  it('names NOAA’s list before its one quake when USGS has none', () => {
    const text = say({ inland: true, '10y': range({ quakes: 1, quakesUnmatched: 1, top: ['small3'] }) }, '10y', 'Austria');
    expect(text).toBe('USGS recorded no earthquake of magnitude 4.5 or more in Austria from 2017 to October 19, 2026. NOAA’s list of significant earthquakes has one in Austria in these years. It was a magnitude 4.9 on August 1, 2024. NOAA records no deaths for it.');
  });

  it('speaks of a city by its distance', () => {
    const row = { '10y': range({ usgs: 7, top: ['small2'] }) };
    expect(say(row, '10y', 'Malatya', 'city')).toContain('within 100 km of Malatya, or 200 km for magnitude 7 and above.');
  });

  it('says plainly when nothing is recorded, and writes different pages for different records', () => {
    const quiet = { '10y': range({}) };
    expect(say(quiet, '10y', 'Estonia')).toBe('USGS recorded no earthquake of magnitude 4.5 or more in or off Estonia from 2017 to October 19, 2026.');
    const a = say({ '10y': range({ usgs: 40, m7: 1, top: ['great', 'second'] }) }, '10y');
    const b = say({ '10y': range({ usgs: 20, top: ['small1', 'small2'] }) }, '10y');
    expect(a).not.toBe(b);
  });

  it('names both quakes that share the top magnitude, and says which was the deadliest', () => {
    const tied = { ...EVENTS, erzincan: quake('1939-12-26', 7.8, { where: '20 km NNE of Erzincan, Turkey', deaths: 32_700, n: 9 }) };
    const meta = { ...META, events: tied };
    const row = { '100y': range({ from: 1927, usgs: 96, m7: 21, quakes: 168, ties: 2, top: ['great', 'erzincan', 'third'] }) };
    const f = hazardFacts(row, '100y', meta, 'country')!;
    expect(f.tie?.named.map(e => e.id)).toEqual(['erzincan', 'great']);
    const text = hazardSentences(f, 'Türkiye', EN).join(' ');
    expect(text).toContain('21 of them reached magnitude 7 or more; the strongest was a magnitude 7.8, twice: on December 26, 1939 (20 km NNE of Erzincan, Turkey) and on February 6, 2023 (Pazarcik earthquake).');
    expect(text).toContain('The one on February 6, 2023 was the deadliest: NOAA records 59,259 deaths for it.');
  });

  it('counts a tie of more than two and names the latest', () => {
    const row = { '100y': range({ from: 1927, usgs: 40, m7: 5, ties: 3, top: ['great', 'small2'] }) };
    const text = say(row, '100y');
    expect(text).toContain('the strongest was a magnitude 7.8, three times, most recently on February 6, 2023 (Pazarcik earthquake).');
  });

  it('tells a tsunami from elsewhere by the dead its runups count here', () => {
    const events = { ...EVENTS, 'ts:2439': { k: 't', d: '2004-12-26', m: 9.1, h: 50.9, at: [95.9, 3.3], where: 'Off W. Coast Of Northern Sumatra', n: 2439 } as HazardEvent };
    const row = { inland: undefined, '100y': range({ from: 1927, tsunamis: 2, tsunamisFrom: 2, tsunamisUnlinked: 2, deaths: 35_332, deadly: 2, top: ['ts:2439'], waves: [{ id: 'ts:2439', deaths: 35_322, h: 12.5, away: true }] }) };
    const text = hazardSentences(hazardFacts(row, '100y', { ...META, events }, 'country')!, 'Sri Lanka', EN).join(' ');
    expect(text).toBe('USGS recorded no earthquake of magnitude 6 or more in or off Sri Lanka from 1927 to October 19, 2026. '
      + 'NOAA lists 2 tsunamis from elsewhere that reached Sri Lanka with deaths or a metre of water or more. '
      + 'The highest water NOAA records here was 12.5 m, on December 26, 2004. '
      + 'The deadliest here came on December 26, 2004 from a magnitude 9.1 earthquake (Off W. Coast Of Northern Sumatra): NOAA’s runup records count 35,322 deaths in Sri Lanka. '
      + 'NOAA records deaths in 2 of the events here, 35,332 in all.');
  });

  it('is undefined for a range the table lacks', () => {
    expect(hazardFacts({}, '100y', META, 'country')).toBeUndefined();
  });
});

describe('quakeTie', () => {
  const q = (id: string, d: string, m: number) => ({ ...quake(d, m), id });
  it('is undefined for a strongest that stands alone', () => {
    expect(quakeTie([q('a', '2023-02-06', 7.8), q('b', '1939-12-26', 7.7)])).toBeUndefined();
  });
  it('names both of two in date order, and the latest of more', () => {
    expect(quakeTie([q('a', '1939-12-26', 7.8), q('b', '2023-02-06', 7.8)])?.named.map(e => e.id)).toEqual(['a', 'b']);
    expect(quakeTie([q('a', '1939-12-26', 7.8), q('b', '2023-02-06', 7.8), q('c', '1999-08-17', 7.8)])).toMatchObject({ n: 3, named: [{ id: 'b' }] });
    // The builder's count covers ties the page doesn't list.
    expect(quakeTie([q('b', '2023-02-06', 7.8)], 4)).toMatchObject({ n: 4, named: [{ id: 'b' }] });
  });
});

describe('hazardLinks', () => {
  it('links USGS by the key and NCEI by its id', () => {
    expect(hazardLinks({ ...EVENTS.great, id: 'us6000jllz' })).toEqual({
      usgs: 'https://earthquake.usgs.gov/earthquakes/eventpage/us6000jllz',
      noaa: 'https://www.ngdc.noaa.gov/hazel/view/hazards/earthquake/event-more-info/1',
    });
    expect(hazardLinks({ ...EVENTS['vo:7'], id: 'vo:7' })).toEqual({ noaa: 'https://www.ngdc.noaa.gov/hazel/view/hazards/volcano/event-more-info/7' });
  });
});

describe('hazardDate', () => {
  it('is as precise as the source', () => {
    expect(hazardDate('2023-02-06', EN)).toBe('February 6, 2023');
    expect(hazardDate('1939-12', EN)).toBe('December 1939');
    expect(hazardDate('1268', EN)).toBe('1268');
    expect(hazardDate('-1449', EN)).toBe('1450 BCE');
  });
});
