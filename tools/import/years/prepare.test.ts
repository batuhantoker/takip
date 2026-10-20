import { describe, expect, it } from 'vitest';
import { utc } from '../dates';
import { classKind } from './kinds';
import { splitRef, type Known } from './known';
import { bulletTime, datesMeet, isLong, sameTime, timing } from './prepare';

const known = (from: number[], to: number[], kind = 'battle') => ({ tLo: utc(from[0], from[1], from[2]), tHi: utc(to[0], to[1], to[2]), kind }) as Known;

describe('dates', () => {
  it('turns a bullet date and range into store times', () => {
    expect(bulletTime({ y: 1683, m: 12, d: 30, y2: 1684, m2: 1, d2: 2, prec: 'day' })).toEqual({ tStart: utc(1683, 12, 30), tStartPrec: 6, tEnd: utc(1684, 1, 2), tEndPrec: 6 });
  });

  it('matches a known event within the calendar slip of its era', () => {
    const vienna = known([1683, 9, 12], [1683, 9, 13]);
    expect(sameTime({ y: 1683, m: 9, d: 2, prec: 'day' }, vienna)).toBe(true);
    expect(sameTime({ y: 1683, m: 8, d: 20, prec: 'day' }, vienna)).toBe(false);
    expect(sameTime({ y: 1683, prec: 'year' }, vienna)).toBe(true);
    expect(sameTime({ y: 2001, m: 9, d: 13, prec: 'day' }, known([2001, 9, 11], [2001, 9, 12]))).toBe(false);
  });

  it('treats wars and multi-year spans as settings, not the event', () => {
    expect(isLong(known([1683, 7, 14], [1699, 1, 26], 'war'))).toBe(true);
    expect(isLong(known([1683, 7, 14], [1683, 9, 13], 'battle.siege'))).toBe(false);
    expect(datesMeet({ y: 1683, prec: 'year' }, { y: 1683, m: 9, d: 12, prec: 'day' })).toBe(true);
    expect(datesMeet({ y: 1684, prec: 'year' }, { y: 1683, m: 9, d: 12, prec: 'day' })).toBe(false);
  });
});

describe('kinds and references', () => {
  it('maps a class through its roots, specific kinds first', () => {
    const roots = { Q1: ['Q188055', 'Q178561'], Q2: ['Q178561'] };
    expect([classKind(roots, 'Q1'), classKind(roots, 'Q2'), classKind(roots, 'Q124757'), classKind(roots, 'Q5')]).toEqual(['battle.siege', 'battle', 'politics.riot', null]);
  });

  it('splits stored article references', () => {
    expect(splitRef('fr:Bataille de Vienne')).toEqual(['fr', 'Bataille de Vienne']);
    expect(splitRef('Battle of Vienna')).toEqual(['en', 'Battle of Vienna']);
    expect(splitRef('Star Wars: Episode IV')).toEqual(['en', 'Star Wars: Episode IV']);
  });
});

describe('timing against Wikidata', () => {
  it('tells the event a bullet is about from one it mentions or a long setting', () => {
    const vienna: [string, number] = ['1683-09-12', 11];
    expect(timing({ y: 1683, m: 9, d: 12, prec: 'day' }, vienna)).toBe('agrees');
    expect(timing({ y: 1684, prec: 'year' }, vienna)).toBe('differs');
    expect(timing({ y: 1690, prec: 'year' }, ['1683-07-14', 11, '1699-01-26', 11])).toBe('long');
    expect(timing({ y: -489, m: 9, prec: 'month' }, ['-489-09-05', 11])).toBe('agrees');
    expect(timing({ y: 1683, prec: 'year' }, null)).toBe('unknown');
  });
});
