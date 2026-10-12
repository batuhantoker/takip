import { describe, expect, it } from 'vitest';
import { capPoint, countryLevelEvents, mapSwicAlert, parseSwicMembers, parseSwicTime, selectSwicAlerts, type SwicItem } from './wmo-swic';

const NOW = Date.parse('2026-10-12T20:00:00Z');

// Shaped from wmo_all.json, 2026-10-12.
const SB: SwicItem = {
  id: 'urn:oid:2.49.0.1.90.0.2026.10.12.19.42.24',
  event: 'Strong Wind',
  headline: 'Strong Wind Warning Number 10: Orange Alert',
  sent: '2026-10-12 19:42:24',
  expires: '2026-10-13 18:00:00',
  effective: '',
  areaDesc: 'Solomon Islands waters',
  mid: '079',
  s: 3,
  capURL: 'sb-sims-en/2026/10/12/19/42/24-95efec451caf8824b8263179cd293e40.xml',
};

const CN: SwicItem = {
  id: 'cn-1',
  event: 'Dense fog',
  headline: 'Renqiu Meteorological Observatory updates heavy fog red warning',
  sent: '2026-10-12 18:46:56',
  expires: '',
  areaDesc: 'Renqiu',
  mid: '001',
  s: 4,
  url: 'cn-cma-xx/2026/10/12/18/46/56-eb2ec74f2c2319397158f77c153d4404.xml',
};

const MEMBERS = parseSwicMembers([
  { ra: 2, members: [{ mid: '001', name: 'China', lat: 35.86166, lng: 104.195397 }] },
  { ra: 5, members: [{ mid: '079', name: 'Solomon Islands', lat: -9.64571, lng: 160.156194 }, { mid: 'bad' }] },
]);

describe('parseSwicTime', () => {
  it('reads SWIC stamps as UTC and rejects blanks', () => {
    expect(parseSwicTime('2026-10-12 19:58:00')).toBe('2026-10-12T19:58:00.000Z');
    expect(parseSwicTime('')).toBeUndefined();
    expect(parseSwicTime(undefined)).toBeUndefined();
  });
});

describe('selectSwicAlerts', () => {
  it('keeps current Severe and Extreme alerts outside the US and Canada', () => {
    const items = [
      SB,
      CN,
      { ...SB, id: 'moderate', s: 2 },
      { ...SB, id: 'expired', expires: '2026-10-12 19:00:00' },
      { ...SB, id: 'nws', capURL: 'us-noaa-nws-en/2026/x.xml' },
      { ...SB, id: 'msc', capURL: 'ca-msc-xx/2026/x.xml' },
      { ...SB, id: 'no-path', capURL: undefined },
    ];
    expect(selectSwicAlerts({ itemCount: items.length, items }, NOW).map(i => i.id)).toEqual([SB.id, 'cn-1']);
  });

  it('throws on an unexpected body', () => {
    expect(() => selectSwicAlerts({ error: 1 }, NOW)).toThrow(/shape/);
  });
});

describe('parseSwicMembers', () => {
  it('flattens regions and skips members without a position', () => {
    expect([...MEMBERS.keys()]).toEqual(['001', '079']);
  });
});

describe('capPoint', () => {
  it('centres on the largest polygon (lat,lon pairs)', () => {
    const xml = `<alert><info><area><polygon>46,52 48,52 48,56 46,56 46,52</polygon></area>
      <area><cap:polygon>10,10 10.1,10 10.1,10.1 10,10</cap:polygon></area></info></alert>`;
    expect(capPoint(xml)).toEqual({ lat: 47, lng: 54 });
  });

  it('falls back to a circle centre, then to nothing for region codes', () => {
    expect(capPoint('<cap:circle>-19.0487,-169.8619 14</cap:circle>')).toEqual({ lat: -19.0487, lng: -169.8619 });
    expect(capPoint('<area><geocode><valueName>CMA</valueName><value>130982</value></geocode></area>')).toBeNull();
  });
});

describe('mapSwicAlert', () => {
  it('maps a placed alert', () => {
    expect(mapSwicAlert(SB, { lat: -9, lng: 160 }, MEMBERS.get('079'))).toEqual({
      id: `swic-${SB.id}`,
      title: 'Strong Wind Warning Number 10: Orange Alert',
      category: 'weatherAlerts',
      type: 'Strong Wind',
      icon: 'weather',
      severity: 'high',
      lat: -9,
      lng: 160,
      date: '2026-10-12T19:42:24.000Z',
      expires: '2026-10-13T18:00:00.000Z',
      area: 'Solomon Islands waters — Solomon Islands',
      source: `https://severeweather.wmo.int/v2/cap-alerts/${SB.capURL}`,
      provider: 'WMO SWIC',
    });
  });
});

describe('countryLevelEvents', () => {
  it('folds unplaceable alerts into one event per member at its centroid', () => {
    const events = countryLevelEvents([CN, { ...CN, id: 'cn-2', event: 'Gale', areaDesc: 'Zhenfeng', sent: '2026-10-12 19:41:15' }], MEMBERS);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: 'swic-001-country',
      title: 'China: 2 severe weather warnings — Dense fog, Gale',
      lat: 35.86166,
      lng: 104.195397,
      date: '2026-10-12T19:41:15.000Z',
      area: 'Country-level, areas not mapped: Renqiu; Zhenfeng',
    });
  });

  it('drops alerts from a member it cannot place at all', () => {
    expect(countryLevelEvents([{ ...CN, mid: '999' }], MEMBERS)).toEqual([]);
  });
});
