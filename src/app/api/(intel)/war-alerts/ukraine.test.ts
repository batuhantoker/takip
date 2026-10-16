import { describe, expect, it } from 'vitest';
import { kyivTime, parseUaStates } from './ukraine';

describe('kyivTime', () => {
  it('converts Kyiv local time in summer (UTC+3) and winter (UTC+2)', () => {
    expect(kyivTime('2026-10-12 22:09:52')).toBe(Date.parse('2026-10-12T19:09:52Z'));
    expect(kyivTime('2026-12-01 12:00:00')).toBe(Date.parse('2026-12-01T10:00:00Z'));
    expect(kyivTime('not a date')).toBeNull();
  });
});

describe('parseUaStates', () => {
  // Shaped from ubilling.net.ua/aerialalerts, 2026-10-12.
  const body = {
    source: 'Vadym Klymenko API (default)',
    cachedat: '2026-10-12 23:15:45',
    states: {
      'м. Київ': { alertnow: true, changed: '2026-10-12 22:09:52' },
      'Сумська область': { alertnow: true, changed: '1970-01-01 03:00:00' },
      'Львівська область': { alertnow: false, changed: '1970-01-01 03:00:00' },
      'Нова область': { alertnow: true, changed: '2026-10-12 22:00:00' },
    },
  };

  it('anchors each oblast on alert at its centre and keeps unknown start times unknown', () => {
    const { alerts, at, unknown } = parseUaStates(body);
    expect(at).toBe(Date.parse('2026-10-12T20:15:45Z'));
    expect(unknown).toEqual(['Нова область']);
    expect(alerts).toEqual([
      {
        id: 'ua-kyiv', country: 'UA', place: 'Kyiv', lat: 50.4501, lng: 30.5234, precision: 'oblast',
        threat: 'air-raid', label: 'Air-raid alert', active: true, since: '2026-10-12T19:09:52.000Z',
        provider: 'ubilling.net.ua', source: 'https://map.ukrainealarm.com/',
      },
      expect.objectContaining({ id: 'ua-sumy-oblast', place: 'Sumy oblast', since: undefined }),
    ]);
  });

  it('throws on an unexpected body', () => {
    expect(() => parseUaStates({ states: null })).toThrow(/shape/);
  });
});
