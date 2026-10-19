import { describe, expect, it } from 'vitest';
import { flag, placeShort, placeText } from './place';

describe('places', () => {
  it('reads a place from city to country', () => {
    expect(placeText({ country: 'DE', region: 'Hesse', city: 'Frankfurt am Main' })).toBe('Frankfurt am Main, Hesse, Germany');
    expect(placeText({ country: 'SG', region: 'Singapore', city: 'Singapore' })).toBe('Singapore, Singapore');
    expect(placeShort({ country: 'TR', region: 'Istanbul', city: 'Esenyurt' })).toBe('Esenyurt, Türkiye');
    expect(placeText({ country: null, region: null, city: null })).toBe('Unknown place');
    expect(placeText(null)).toBe('Unknown place');
  });

  it('draws flags only for two-letter codes', () => {
    expect(flag('us')).toBe('🇺🇸');
    expect(flag('USA')).toBeNull();
    expect(flag(null)).toBeNull();
  });
});
