import { describe, expect, it } from 'vitest';
import { accuracyText, deviceText, flag, placeShort, placeText } from './place';

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

describe('shared locations', () => {
  it('reads the browser accuracy in metres or kilometres', () => {
    expect(accuracyText(28.4)).toBe('±28 m');
    expect(accuracyText(1250)).toBe('±1.3 km');
    expect(accuracyText(42_000)).toBe('±42 km');
    expect(accuracyText(null)).toBe('');
  });

  it('names a shared location by its label, else by rounded coordinates', () => {
    expect(deviceText({ latitude: 39.9334, longitude: 32.8597, accuracyM: 30, label: 'Ankara, Türkiye' })).toBe('Ankara, Türkiye');
    expect(deviceText({ latitude: 39.9334, longitude: 32.8597, accuracyM: 30, label: null })).toBe('Shared location 39.93, 32.86');
  });
});
