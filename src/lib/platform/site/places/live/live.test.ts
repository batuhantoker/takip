import { describe, expect, it } from 'vitest';
import type { AirportWx } from '@/lib/feeds/aviation-weather/metar';
import type { TransitResponse } from '@/lib/feeds/transit/view';
import { EN } from '../copy/format';
import { describeReport, stationsNow } from './metar-now';
import { summarise } from './transit-now';

const wx = (over: Partial<AirportWx>): AirportWx => ({ id: 'KLUK', lat: 39.1, lng: -84.4, cat: 'VFR', at: '2026-10-19T12:53:00Z', raw: '', ...over });

describe('metar-now', () => {
  it('says what the report says, in °F too for a US city', () => {
    expect(describeReport(wx({ tempC: 14, windDir: 230, windKt: 9, gustKt: 18, visSm: '10+' }), 'US', EN))
      .toBe('14 °C (57 °F), wind from 230° at 9 kt, gusting 18 kt, visibility 10+ miles');
    expect(describeReport(wx({ tempC: -3, windKt: 0, ceilingFt: 1200 }), 'PL', EN)).toBe('-3 °C, wind calm, cloud base 1,200 ft');
    expect(describeReport(wx({ windKt: 4 }), 'US', EN)).toBe('wind variable at 4 kt');
    expect(describeReport(wx({ windDir: 0, windKt: 3 }), 'US', EN)).toBe('wind variable at 3 kt');
  });

  it('keeps the stations that reported in the last three hours, in the order given', () => {
    const stations = [{ icao: 'KLUK', name: 'Lunken', km: 9 }, { icao: 'KCVG', name: 'Cincinnati Intl', km: 16 }, { icao: 'KHAO', name: 'Hamilton', km: 26 }];
    const now = Date.parse('2026-10-19T13:05:00Z');
    const rows = [wx({ id: 'KCVG', tempC: 15 }), wx({ id: 'KLUK', tempC: 14 }), wx({ id: 'KHAO', tempC: 13, at: '2026-10-19T08:00:00Z' })];
    const got = stationsNow(rows, stations, 'US', now, EN);
    expect(got.map(s => s.icao)).toEqual(['KLUK', 'KCVG']);
    expect(got[0].minutesAgo).toBe(12);
  });
});

describe('transit-now', () => {
  it('counts vehicles by feed, how they are placed, and the busiest routes', () => {
    const json: TransitResponse = {
      feeds: [{ id: 'a', name: 'Cincinnati Metro', ok: true, count: 3 }, { id: 'b', name: 'TANK', ok: false, count: 0 }],
      vehicles: [
        { key: 'a:1', feed: 0, lng: 0, lat: 0, route: '4' },
        { key: 'a:2', feed: 0, lng: 0, lat: 0, route: '4', estimated: true },
        { key: 'a:3', feed: 0, lng: 0, lat: 0, route: 'NBU:Line:cb7b', scheduled: true, estimated: true },
      ],
      skipped: 0,
      timestamp: '2026-10-19T13:00:00Z',
    };
    expect(summarise(json, 20, 0)).toEqual({
      total: 3, km: 20, feeds: [{ name: 'Cincinnati Metro', count: 3 }], estimated: 1, scheduled: 1,
      busiest: [{ route: '4', count: 2 }], down: ['TANK'], at: 0,
    });
  });
});
