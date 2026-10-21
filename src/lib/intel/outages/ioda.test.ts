import { describe, expect, it } from 'vitest';
import { IODA_WINDOW_S, mapIodaEvents } from './ioda';
import { mergeOutages } from './outage';

// Trimmed from api.ioda.inetintel.cc.gatech.edu/v2/outages/events?entityType=country&format=codf, 2026-10-21.
const UNTIL = 1792610484;
const FROM = UNTIL - IODA_WINDOW_S;
const EVENTS = [
  { location: 'country/PG', location_name: 'Papua New Guinea', start: 1791413700, duration: 1196784, datasource: 'bgp', score: 25168.96 },
  { location: 'country/NG', location_name: 'Nigeria', start: 1792524600, duration: 4800, datasource: 'bgp', score: 83.16 },
  { location: 'country/NG', location_name: 'Nigeria', start: 1792530000, duration: 36900, datasource: 'bgp', score: 626.85 },
  { location: 'country/LK', location_name: 'Sri Lanka', start: 1792600000, duration: UNTIL - 1792600000, datasource: 'ping-slash24', score: 9000 },
  { location: 'country/LK', location_name: 'Sri Lanka', start: 1792601000, duration: 3000, datasource: 'bgp', score: 300 },
];

describe('mapIodaEvents', () => {
  const pins = mapIodaEvents(EVENTS, FROM, UNTIL);

  it('leaves out drops that began before the window', () => {
    expect(pins.map(p => p.country)).toEqual(['NG', 'LK']);
  });

  it('spans a country’s events, and reads one running to the window’s end as ongoing', () => {
    expect(pins[0]).toMatchObject({
      source: 'ioda', kind: 'signal', country_name: 'Nigeria', ongoing: false,
      start: '2026-10-20T19:30:00.000Z', end: '2026-10-21T07:15:00.000Z', seen_in: ['bgp'],
      url: 'https://ioda.inetintel.cc.gatech.edu/country/NG',
    });
    expect(pins[1]).toMatchObject({ ongoing: true, end: null, seen_in: ['ping-slash24', 'bgp'] });
  });
});

describe('mergeOutages', () => {
  const [nigeria, lanka] = mapIodaEvents(EVENTS, FROM, UNTIL);
  const now = UNTIL * 1000;

  it('drops an IODA signal that overlaps a Cloudflare report for the same country', () => {
    const cloudflare = { ...lanka, id: 'cf-LK', source: 'cloudflare' as const, kind: 'annotation' as const, start: '2026-10-21T08:00:00Z', end: null };
    expect(mergeOutages([cloudflare], [nigeria, lanka], now).map(o => o.id)).toEqual(['cf-LK', nigeria.id]);
  });

  it('keeps one that doesn’t overlap', () => {
    const earlier = { ...lanka, id: 'cf-LK', source: 'cloudflare' as const, start: '2026-10-01T00:00:00Z', end: '2026-10-02T00:00:00Z' };
    expect(mergeOutages([earlier], [lanka], now)).toHaveLength(2);
  });
});
