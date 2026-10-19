import { describe, expect, it } from 'vitest';
import { addRunup, csvRows, hitDeaths, matchNoaa, rangeStats, type Bag, type NoaaEvent, type UsgsQuake } from './hazards';
import { countryBox } from './hazards-geo';

const T = Date.parse('2023-02-06T01:17:34Z');
const usgs = (id: string, t: number, mag: number, at: [number, number] = [37.04, 37.23]): UsgsQuake => ({ id, t, at, mag, place: `${id} place` });
const noaa = (id: number, kind: NoaaEvent['kind'], t: number, extra: Partial<NoaaEvent> = {}): NoaaEvent => ({
  id, rec: `${kind === 'q' ? 'eq' : kind === 't' ? 'ts' : 'vo'}:${id}`, kind, t, prec: 9, at: [37.02, 37.17], mag: 7.8, deaths: null, h: null, links: [], ...extra,
});

describe('csvRows', () => {
  it('keeps commas inside quotes', () => {
    expect(csvRows('id,place\nus1,"26 km SW of Hakkâri, Turkey"\n')).toEqual([['id', 'place'], ['us1', '26 km SW of Hakkâri, Turkey']]);
  });
});

describe('matchNoaa', () => {
  it('pairs a NOAA quake with the nearest USGS one within 120 s and 150 km, and nothing else', () => {
    const near = usgs('near', T + 30_000, 7.8);
    const far = usgs('far', T + 10_000, 7.8, [45, 37]);
    const late = usgs('late', T + 600_000, 7.5);
    const q = noaa(1, 'q', T);
    const coarse = noaa(2, 'q', T, { prec: 6 });
    const old = noaa(3, 'q', Date.parse('1899-06-01T00:00:00Z'));
    expect(matchNoaa([q, coarse, old], [far, late, near])).toBe(1);
    expect(q.usgs?.id).toBe('near');
    expect(coarse.usgs).toBeUndefined();
  });
});

describe('rangeStats', () => {
  it('counts each event once across the two lists, and each toll once', () => {
    const main = usgs('main', T, 7.8);
    const after = usgs('after', T + 86_400_000, 6.7);
    const q = noaa(1, 'q', T, { deaths: 56_697, links: [2] });
    const wave = noaa(2, 'q', T, {});
    const tsunami = noaa(3, 't', T + 60_000, { deaths: 56_697, h: 0.6, links: [1] });
    const lone = noaa(4, 't', T, { deaths: 2, h: 1.2 });
    const older = noaa(5, 'q', Date.parse('1939-12-26T23:57:00Z'), { mag: 7.8, deaths: 32_700 });
    wave.kind = 'v';
    wave.rec = 'vo:2';
    wave.mag = 2;
    q.usgs = main;
    const noaaOf = new Map([['main', q]]);
    const r = rangeStats({ usgs: [main, after], noaa: [q, tsunami, lone, older, wave] }, '10y', 2026, noaaOf)!;
    expect(r.usgs).toBe(2);
    expect(r.quakes).toBe(1);
    expect(r.quakesUnmatched).toBe(0);
    expect(r.tsunamis).toBe(2);
    expect(r.tsunamisUnlinked).toBe(1);
    expect(r.eruptions).toBe(1);
    // The quake's total already holds its tsunami's dead; the unlinked tsunami's toll is its own event's.
    expect(r.deaths).toBe(56_699);
    expect(r.top[0]).toBe('main');
    expect(r.by?.[6]).toBe(2);
    expect(r.peak).toEqual({ id: 'main', after: 1 });

    const century = rangeStats({ usgs: [main, after], noaa: [q, older] }, '100y', 2026, noaaOf)!;
    expect(century.quakes).toBe(2);
    expect(century.quakesUnmatched).toBe(1);
    // A tie at 7.8: the measured one first.
    expect(century.top.slice(0, 2)).toEqual(['main', 'eq:5']);
  });
});

describe('countryBox', () => {
  it('boxes a country as it is, or across the antimeridian when its parts sit either side', () => {
    expect(countryBox([[26, 36, 45, 42]])).toEqual([26, 36, 45, 42]);
    // Fiji: islands either side of 180°.
    expect(countryBox([[177, -19, 180, -16], [-180, -17, -178, -16]])).toEqual([177, -19, -178, -16]);
    // The US: Alaska's Aleutians reach past 180°, so the box runs from them east to Maine.
    expect(countryBox([[-125, 24, -67, 49], [-180, 51, -130, 72], [172, 52, 180, 53]])).toEqual([172, 24, -67, 72]);
  });
});

describe('tsunamis from elsewhere', () => {
  it('count where their runups killed or rose a metre, with the dead there and not the event’s whole toll', () => {
    const t2004 = noaa(2439, 't', Date.parse('2004-12-26T00:58:53Z'), { deaths: 227_899, h: 50.9, at: [95.9, 3.3], links: [9] });
    const bag: Bag = { usgs: [], noaa: [] };
    addRunup(bag, t2004, { ts: 2439, at: null, country: 'SRI LANKA', deaths: 35_322, h: 12.5 });
    addRunup(bag, t2004, { ts: 2439, at: [81.2, 8.6], country: 'SRI LANKA', deaths: 40, h: 4 });
    // NCEI's "ALL OF" row already holds the dead at the points: the larger, not the sum.
    expect(hitDeaths(bag.hits!.get(t2004))).toBe(35_322);
    const r = rangeStats(bag, '100y', 2026, new Map())!;
    expect(r).toMatchObject({ tsunamis: 1, tsunamisFrom: 1, tsunamisUnlinked: 1, deaths: 35_322, deadly: 1 });
    expect(r.waves).toEqual([{ id: 'ts:2439', deaths: 35_322, h: 12.5, away: true }]);
  });
});

describe('ties', () => {
  it('counts the quakes sharing the top magnitude and keeps the latest two', () => {
    const a = usgs('a', Date.parse('1939-12-26T23:57:00Z'), 7.8);
    const b = usgs('b', T, 7.8);
    const c = usgs('c', T + 1000, 7.5);
    const r = rangeStats({ usgs: [a, b, c], noaa: [] }, '100y', 2026, new Map(), true)!;
    expect(r.ties).toBe(2);
    expect(r.top).toEqual(expect.arrayContaining(['a', 'b']));
  });
});
