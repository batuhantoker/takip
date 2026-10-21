import { describe, expect, it } from 'vitest';
import { timeZoneCity } from './timezone-cities';

describe('timeZoneCity', () => {
  it('places a zone at its principal city, [lng, lat]', () => {
    expect(timeZoneCity('America/New_York')).toEqual([-74.01, 40.71]);
  });

  it('knows the legacy names V8 still reports', () => {
    expect(timeZoneCity('Asia/Calcutta')).toEqual(timeZoneCity('Asia/Kolkata'));
    expect(timeZoneCity('Europe/Kiev')).toEqual(timeZoneCity('Europe/Kyiv'));
  });

  it('covers every zone this runtime can report', () => {
    expect(Intl.supportedValuesOf('timeZone').filter(tz => !timeZoneCity(tz) && tz !== 'UTC')).toEqual([]);
  });

  it('has no place for UTC, an unknown zone or nothing', () => {
    expect(timeZoneCity('UTC')).toBeNull();
    expect(timeZoneCity('Mars/Olympus')).toBeNull();
    expect(timeZoneCity('constructor')).toBeNull();
    expect(timeZoneCity(null)).toBeNull();
  });
});
