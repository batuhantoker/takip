import { Prec } from '@takip/core/time';
import { describe, expect, it } from 'vitest';
import { DATES, DUPLICATES, isoDate } from './wikidata';

describe('wikidata duplicates', () => {
  it('keeps an item that is not itself dropped', () => {
    for (const [dropped, kept] of Object.entries(DUPLICATES)) {
      expect(kept).not.toBe(dropped);
      expect(DUPLICATES[kept]).toBeUndefined();
    }
  });
});

describe('wikidata dates', () => {
  it('reads a day or a month', () => {
    expect(isoDate('1939-09-06')).toEqual({ t: Date.UTC(1939, 8, 6), prec: Prec.day });
    expect(isoDate('1941-06')).toEqual({ t: Date.UTC(1941, 5, 1), prec: Prec.month });
  });

  it('never ends a battle before it starts', () => {
    for (const [start, end] of Object.values(DATES)) if (end) expect(isoDate(end).t).toBeGreaterThanOrEqual(isoDate(start).t);
  });
});
