import { describe, expect, it } from 'vitest';
import { defaultTemperatureUnit, formatTemperature, toUnit } from './temperature-unit';

describe('defaultTemperatureUnit', () => {
  it('picks °F from a US or other Fahrenheit time zone, whatever the language', () => {
    expect(defaultTemperatureUnit('America/Chicago', 'tr-TR')).toBe('f');
    expect(defaultTemperatureUnit('America/Indiana/Knox', undefined)).toBe('f');
    expect(defaultTemperatureUnit('US/Pacific', 'en-GB')).toBe('f');
    expect(defaultTemperatureUnit('Pacific/Honolulu', 'en')).toBe('f');
    expect(defaultTemperatureUnit('Africa/Monrovia', 'en')).toBe('f');
  });

  it('picks °C everywhere else, even with a US-English browser', () => {
    expect(defaultTemperatureUnit('Europe/Istanbul', 'en-US')).toBe('c');
    expect(defaultTemperatureUnit('America/Toronto', 'en-US')).toBe('c');
    expect(defaultTemperatureUnit('America/Mexico_City', 'es-MX')).toBe('c');
  });

  it('falls back to the language region only when the zone is plain UTC', () => {
    expect(defaultTemperatureUnit('UTC', 'en-US')).toBe('f');
    expect(defaultTemperatureUnit('Etc/UTC', 'en-GB')).toBe('c');
    expect(defaultTemperatureUnit(undefined, 'en')).toBe('c');
    expect(defaultTemperatureUnit('', 'not a locale')).toBe('c');
  });
});

describe('formatTemperature', () => {
  it('converts and labels the reading', () => {
    expect(toUnit(100, 'f')).toBe(212);
    expect(formatTemperature(22.2, 'c')).toBe('22.2 °C');
    expect(formatTemperature(-40, 'f')).toBe('-40.0 °F');
    expect(formatTemperature(null, 'f')).toBeNull();
    expect(formatTemperature('', 'c')).toBeNull();
  });
});
