import { describe, expect, it } from 'vitest';
import { createTranslator } from '@/lib/core/i18n/translator';
import { ascentText, heightText, mountainDescription, mountainTitle, topsOf } from './copy';
import type { Mountain, MountainPlace } from './data';

const t = createTranslator('en', {});

const peak = (over: Partial<Mountain> = {}): Mountain => ({
  qid: 1, slug: 'x', kind: 'mountain', names: { en: 'Mount X' }, wiki: { en: 'Mount X' }, articles: 3, lon: 0, lat: 0,
  elev: 4000, prom: null, isol: null, parent: null, range: null, cc: ['FR'], ascent: null, image: null, gvp: null, highest: [],
  place: null, tz: null, indexed: true, ...over,
});

describe('mountain copy', () => {
  it('gives a US peak its height in feet first', () => {
    expect(heightText(t, 4421, true)).toBe('14,505 ft (4,421 m)');
    expect(heightText(t, 8848.86, false)).toBe('8,849 m (29,032 ft)');
  });

  it('keeps titles within 60 characters, dropping words before the name', () => {
    expect(mountainTitle(t, peak(), 'Mount X', 0)).toMatch(/^Mount X, .+: height, weather and map$/);
    const long = 'Pico de la Cruz Grande del Norte Muy Alto';
    expect([...mountainTitle(t, peak(), long, 0)].length).toBeLessThanOrEqual(60);
    expect(mountainTitle(t, peak({ cc: [] }), 'Mount X', 0)).toBe('Mount X: height, weather and map');
    expect(mountainTitle(t, peak({ kind: 'volcano' }), 'Etna', 188)).toMatch(/^Etna volcano, .+: height, eruptions and map$/);
    expect(mountainTitle(t, peak({ kind: 'volcano' }), 'Etna', 0)).not.toContain('eruptions');
  });

  it("leads the description with Wikipedia's opening when it fits the length search shows", () => {
    const extract = 'Mount X is the highest mountain on planet Earth above sea level. It lies in the Mahalangur Himal sub-range of the Himalayas and marks part of the China–Nepal border at its summit, far away.';
    expect(mountainDescription(t, peak(), 'Mount X', null, extract))
      .toBe('Mount X is the highest mountain on planet Earth above sea level. Summit weather forecast, nearby peaks and a 3D map.');
    expect(mountainDescription(t, peak({ elev: 1344.5 }), 'Mount X', null, null)).toMatch(/^Mount X is a mountain in .+, 1,345 m high\./);
  });

  it('lists what a peak tops as a reader would: the Earth, continents, countries, ranges', () => {
    const places = new Map<number, MountainPlace>([
      [28363, { qid: 28363, kind: 'other', names: { en: 'Solukhumbu District' }, cc: null }],
      [5451, { qid: 5451, kind: 'range', names: { en: 'Himalayas' }, cc: null }],
      [837, { qid: 837, kind: 'country', names: { en: 'Federal Democratic Republic of Nepal' }, cc: 'NP' }],
      [48, { qid: 48, kind: 'continent', names: { en: 'Asia' }, cc: null }],
      [2, { qid: 2, kind: 'world', names: { en: 'Earth' }, cc: null }],
    ]);
    expect(topsOf(t, { highest: [28363, 5451, 837, 48, 2] }, places)).toEqual(['Earth', 'Asia', 'Nepal', 'Himalayas']);
  });

  it('writes a first ascent at the precision Wikidata gives', () => {
    expect(ascentText(t, '1953-05-29')).toBe('May 29, 1953');
    expect(ascentText(t, '1820')).toBe('1820');
  });
});
