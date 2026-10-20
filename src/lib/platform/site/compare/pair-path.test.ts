import { describe, expect, it } from 'vitest';
import { reversedPairPath } from './pair-path';

describe('reversedPairPath', () => {
  it('names the pair in alphabetical order, the measure kept', () => {
    expect(reversedPairPath('/compare/turkey-vs-greece')).toBe('/compare/greece-vs-turkey');
    expect(reversedPairPath('/compare/turkey-vs-greece/life-expectancy')).toBe('/compare/greece-vs-turkey/life-expectancy');
    expect(reversedPairPath('/compare/united-states-vs-china')).toBe('/compare/china-vs-united-states');
  });

  it('leaves the canonical spelling and anything else alone', () => {
    expect(reversedPairPath('/compare/greece-vs-turkey')).toBeNull();
    expect(reversedPairPath('/compare/greece-vs-turkey/life-expectancy')).toBeNull();
    expect(reversedPairPath('/compare')).toBeNull();
    expect(reversedPairPath('/compare/turkey')).toBeNull();
    expect(reversedPairPath('/compare/c-vs-b-vs-a')).toBeNull();
    expect(reversedPairPath('/country/turkey-vs-greece')).toBeNull();
  });
});
