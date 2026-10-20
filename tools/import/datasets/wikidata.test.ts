import { Prec } from '@takip/core/time';
import { describe, expect, it } from 'vitest';
import { alsoAtrocity, DATES, DUPLICATES, isoDate } from './wikidata';

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

describe('battles that are also atrocities', () => {
  it('names the gravest atrocity class, or none', () => {
    // Siege of Tripolitsa: siege, battle, massacre.
    expect(alsoAtrocity(new Set(['Q188055', 'Q178561', 'Q3199915']))).toBe('conflict.massacre');
    expect(alsoAtrocity(new Set(['Q178561', 'Q3199915', 'Q41397']))).toBe('conflict.genocide');
    expect(alsoAtrocity(new Set(['Q178561']))).toBeUndefined();
  });
});
