import { describe, expect, it } from 'vitest';
import { climateAt } from './climate';
import { formatMa, longMa, parseDeepJump, periodAt, sunBrightness } from './deep-time';

describe('deep time', () => {
  it('reads ages in Ma, Ga, ka and by period', () => {
    expect(parseDeepJump('250 Ma')).toBe(250);
    expect(parseDeepJump('66mya')).toBe(66);
    expect(parseDeepJump('1.2 Ga')).toBe(1200);
    expect(parseDeepJump('1.8 billion years ago')).toBe(1800);
    expect(parseDeepJump('20 ka')).toBe(0.02);
    expect(parseDeepJump('Jurassic')).toBe(201.36);
    expect(parseDeepJump('1939')).toBeUndefined();
    expect(parseDeepJump('500 BCE')).toBeUndefined();
  });

  it('names the period and prints the age', () => {
    expect(periodAt(66.1).name).toBe('Cretaceous');
    expect(periodAt(65.9).name).toBe('Paleogene');
    expect(periodAt(1800).name).toBe('Statherian');
    expect(formatMa(250)).toBe('250.0 Ma');
    expect(formatMa(0.12)).toBe('120 ka');
    expect(longMa(1800)).toBe('1.8 billion years ago');
    expect(longMa(66)).toBe('66 million years ago');
  });

  it('dims the young Sun', () => {
    expect(sunBrightness(0)).toBe(1);
    expect(sunBrightness(1800)).toBeCloseTo(0.864, 3);
  });

  it('reads the climate between stages, holds the youngest to today and stops before the record', () => {
    const rows = [[1, 10, 14, 16, 200, 280, 300], [3, 20, 24, 26, 400, 480, 500]];
    expect(climateAt(rows, 2)?.gmst.mid).toBe(19);
    expect(climateAt(rows, 0)?.co2.mid).toBe(280);
    expect(climateAt(rows, 4)).toBeNull();
  });
});
