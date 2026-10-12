import { describe, expect, it } from 'vitest';
import { parseTzevaCities, parseTzevaHistory, parseTzevaNotifications, sirensToAlerts } from './tzeva-adom';

const NOW = Date.parse('2026-10-12T20:00:00Z');
const sec = (iso: string) => Date.parse(iso) / 1000;

const CITIES = parseTzevaCities({
  cities: {
    'מנרה': { id: 1, en: 'Manara', lat: 33.1903, lng: 35.5414 },
    'מרגליות': { id: 2, en: 'Margaliot', lat: 33.2151, lng: 35.5446 },
    'בחר הכל': { id: 0, en: 'Select All', lat: 0, lng: 0 },
  },
});

describe('parseTzevaCities', () => {
  it('keys by Hebrew name and skips placeholder rows', () => {
    expect([...CITIES.keys()]).toEqual(['מנרה', 'מרגליות']);
  });

  it('throws on an unexpected body', () => {
    expect(() => parseTzevaCities([])).toThrow(/shape/);
  });
});

describe('parsing sirens', () => {
  it('flattens history waves and drops drills', () => {
    const history = [
      { id: 7665, description: null, alerts: [
        { time: sec('2026-10-12T19:55:00Z'), cities: ['מנרה', 'מרגליות'], threat: 5, isDrill: false },
        { time: sec('2026-10-12T19:56:00Z'), cities: ['מנרה'], threat: 0, isDrill: false },
      ] },
      { id: 7666, alerts: [{ time: sec('2026-10-12T19:57:00Z'), cities: ['מנרה'], threat: 9, isDrill: true }] },
    ];
    expect(parseTzevaHistory(history)).toHaveLength(2);
  });

  it('reads live notifications with either a time or a date stamp', () => {
    const sirens = parseTzevaNotifications([
      { notificationId: 'a', threat: 0, cities: ['מנרה'], date: sec('2026-10-12T19:59:00Z'), isDrill: false },
      { notificationId: 'b', threat: 5, cities: ['מרגליות'], time: '2026-10-12T19:59:30Z' },
      { notificationId: 'c', threat: 0, cities: [] },
    ]);
    expect(sirens.map(s => s.t)).toEqual([Date.parse('2026-10-12T19:59:00Z'), Date.parse('2026-10-12T19:59:30Z')]);
  });

  it('throws on an unexpected body', () => {
    expect(() => parseTzevaNotifications({})).toThrow(/shape/);
  });
});

describe('sirensToAlerts', () => {
  const sirens = [
    { t: Date.parse('2026-10-12T19:55:00Z'), cities: ['מנרה', 'מרגליות'], threat: 5 },
    { t: Date.parse('2026-10-12T12:00:00Z'), cities: ['מנרה'], threat: 5 },
    { t: Date.parse('2026-10-12T19:30:00Z'), cities: ['מנרה'], threat: 0 },
    { t: Date.parse('2026-10-10T19:30:00Z'), cities: ['מרגליות'], threat: 0 },
    { t: Date.parse('2026-10-12T19:58:00Z'), cities: ['עיר לא ידועה'], threat: 0 },
  ];

  it('keeps one alert per place and threat inside 24 h, latest first', () => {
    const { alerts, unplaced } = sirensToAlerts(sirens, CITIES, NOW);
    expect(alerts.map(a => [a.place, a.threat, a.count, a.active])).toEqual([
      ['Manara', 'uav', 2, true],
      ['Margaliot', 'uav', 1, true],
      ['Manara', 'rockets', 1, false],
    ]);
    expect(alerts[0]).toMatchObject({
      id: 'il-uav-מנרה',
      country: 'IL',
      lat: 33.1903,
      precision: 'locality',
      label: 'Hostile aircraft (UAV)',
      since: '2026-10-12T19:55:00.000Z',
      provider: 'Tzeva Adom',
    });
    expect(unplaced).toEqual(['עיר לא ידועה']);
  });
});
