import { describe, expect, it } from 'vitest';
import type { RtFeed, RtTripTimes } from '../gtfs/realtime';
import { fixesFromTrips, placeAtStops, stopFixes, type StopGraph } from './stop-place';

const graph: StopGraph = {
  stops: {
    A15N: [-73.944, 40.811, '125 St'],
    A12N: [-73.942, 40.825, '145 St'],
    D13N: [-73.938, 40.830, '155 St'],
  },
  prev: {
    A12N: [['A15N', 120, 'A C']],
    D13N: [['A12N', 100, 'D'], ['A15N', 200, 'B']],
  },
};
const now = 1_760_000_000;
const trips = (entries: [string, RtTripTimes][]): RtFeed['trips'] => new Map(entries);

describe('placeAtStops', () => {
  it('puts a stopped train at its stop, facing the way it came in', () => {
    const [v] = placeAtStops([{ id: 't1', stopId: 'A12N', status: 1, route: 'A' }], new Map(), graph, now);
    expect(v).toMatchObject({ id: 't1', lng: -73.942, lat: 40.825, stop: '145 St', estimated: true });
    expect(v.from).toBeUndefined();
    expect(v.bearing).toBeGreaterThan(0);
    expect(v.bearing).toBeLessThan(20);
  });

  it('puts a moving train along the run as far as its predicted arrival says', () => {
    const t = trips([['trip', { next: [{ stop: 'A12N', arrive: now + 30 }] }]]);
    const [v] = placeAtStops([{ id: 't', trip: 'trip', stopId: 'A12N', status: 2 }], t, graph, now);
    // 30 s left of a 120 s run: three quarters of the way from 125 St.
    expect(v.lat).toBeCloseTo(40.811 + 0.014 * 0.75, 5);
    expect(v).toMatchObject({ stop: '145 St', from: '125 St' });
  });

  it('times the run from when it left the stop the feed names', () => {
    const t = trips([['trip', { next: [{ stop: 'A12N', arrive: now + 50 }] }]]);
    const [v] = placeAtStops([{ id: 't', trip: 'trip', stopId: 'A12N', status: 2, fromId: 'A15N', left: now - 50 }], t, graph, now);
    expect(v.lat).toBeCloseTo(40.818, 5);
  });

  it('goes halfway without a prediction, and never sits on either end while moving', () => {
    const late = trips([['late', { next: [{ stop: 'A12N', arrive: now + 900 }] }]]);
    const [mid, early] = placeAtStops([
      { id: 'mid', stopId: 'A12N', status: 2 },
      { id: 'early', trip: 'late', stopId: 'A12N', status: 2 },
    ], late, graph, now);
    expect(mid.lat).toBeCloseTo(40.818, 5);
    expect(early.lat).toBeGreaterThan(40.811);
  });

  it("takes the run its route uses at a junction, and skips stops the graph doesn't know", () => {
    const placed = placeAtStops([
      { id: 'b', stopId: 'D13N', status: 2, route: 'B' },
      { id: 'x', stopId: 'NOPE', status: 1 },
    ], new Map(), graph, now);
    expect(placed.map(v => [v.id, v.from])).toEqual([['b', '125 St']]);
  });
});

describe('fixesFromTrips', () => {
  it('finds each running train from its trip update alone', () => {
    const fixes = fixesFromTrips(trips([
      // BART: the stop just left, then the ones ahead; no stop_sequence.
      ['bart', { left: { stop: 'M70-2', arrive: now - 137, depart: now - 119 }, next: [{ stop: 'M60-2', arrive: now + 19, depart: now + 37 }] }],
      // At a platform: arrived, not yet gone.
      ['dwell', { next: [{ stop: 'A12N', arrive: now - 10, depart: now + 20 }] }],
      // Paris: only stops ahead, the next one seventh on the trip.
      ['paris', { route: 'M7', next: [{ stop: 'S7', arrive: now + 40, seq: 7 }] }],
      // Waiting at its first stop: not under way yet.
      ['waiting', { next: [{ stop: 'O', arrive: now + 240, depart: now + 240, seq: 0 }, { stop: 'P', arrive: now + 320, seq: 1 }] }],
      // A stop listed ahead in the feed but passed since: the train is heading to the next.
      ['moved', { next: [{ stop: 'X', arrive: now - 30, depart: now - 20 }, { stop: 'Y', arrive: now + 60 }] }],
    ]), now, now - 5);
    expect(fixes).toEqual([
      { id: 'bart', trip: 'bart', route: undefined, stopId: 'M60-2', status: 2, t: now - 5, fromId: 'M70-2', left: now - 119 },
      { id: 'dwell', trip: 'dwell', route: undefined, stopId: 'A12N', status: 1, t: now - 5, fromId: undefined, left: undefined },
      { id: 'paris', trip: 'paris', route: 'M7', stopId: 'S7', status: 2, t: now - 5, fromId: undefined, left: undefined },
      { id: 'moved', trip: 'moved', route: undefined, stopId: 'Y', status: 2, t: now - 5, fromId: 'X', left: now - 20 },
    ]);
  });

  it('is only asked when the feed sends no vehicles of its own', () => {
    const t = trips([['a', { next: [{ stop: 'S', arrive: now + 30 }] }]]);
    expect(stopFixes({ vehicles: [{ id: 'bus', lat: 1, lng: 1 }], atStops: [], trips: t }, now)).toEqual([]);
    expect(stopFixes({ vehicles: [], atStops: [], trips: t }, now).map(f => f.stopId)).toEqual(['S']);
  });
});
