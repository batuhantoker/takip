import { describe, expect, it } from 'vitest';
import { linesInView } from './lines';
import type { TransitResponse, TransitVehicle } from './view';

const res = (vehicles: Omit<TransitVehicle, 'lng' | 'lat'>[]): TransitResponse => ({
  feeds: [{ id: 'mbta', name: 'MBTA', ok: true, count: 0 }, { id: 'mvrta', name: 'MVRTA', ok: true, count: 0 }],
  vehicles: vehicles.map(v => ({ lng: 0, lat: 0, ...v })),
  skipped: 0,
  timestamp: '',
});

describe('linesInView', () => {
  it('groups vehicles by feed and route, the busiest first, numbers in order', () => {
    const lines = linesInView(res([
      { key: 'mbta:1', feed: 0, route: '9' },
      { key: 'mbta:2', feed: 0, route: '10' },
      { key: 'mbta:3', feed: 0, route: '10' },
      { key: 'mvrta:1', feed: 1, route: '10' },
      { key: 'mbta:4', feed: 0, route: '1' },
      { key: 'mbta:5', feed: 0 },
    ]));
    expect(lines.map(l => [l.feed, l.route, l.vehicles])).toEqual([['mbta', '10', 2], ['mbta', '1', 1], ['mbta', '9', 1], ['mvrta', '10', 1]]);
    expect(lines[3].operator).toBe('MVRTA');
  });

  it('keeps a trip heading the other way for the second direction', () => {
    const [line] = linesInView(res([
      { key: 'mbta:1', feed: 0, route: 'Red', mode: 'metro', trip: 'a', bearing: 10 },
      { key: 'mbta:2', feed: 0, route: 'Red', mode: 'metro', trip: 'b', bearing: 20 },
      { key: 'mbta:3', feed: 0, route: 'Red', mode: 'metro', trip: 'c', bearing: 195 },
      { key: 'mbta:4', feed: 0, route: 'Red', mode: 'metro', trip: 'a', bearing: 12 },
    ]));
    expect(line).toMatchObject({ mode: 'metro', vehicles: 4, trips: ['a', 'c'] });
  });

  it('falls back to any second trip without bearings', () => {
    const [line] = linesInView(res([{ key: 'mbta:1', feed: 0, route: '9', trip: 'x' }, { key: 'mbta:2', feed: 0, route: '9', trip: 'y' }]));
    expect(line.trips).toEqual(['x', 'y']);
  });
});
