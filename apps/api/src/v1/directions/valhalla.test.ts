import { describe, it, expect } from 'vitest';
import {
  valhallaManeuverKind,
  normalizeValhalla,
  normalizeValhallaAll,
  buildCostingOptions,
  type ValhallaResponse,
} from './valhalla';

describe('valhallaManeuverKind', () => {
  it('classifies the maneuver families the UI has icons for', () => {
    expect(valhallaManeuverKind(1)).toBe('depart');
    expect(valhallaManeuverKind(4)).toBe('arrive');
    expect(valhallaManeuverKind(10)).toBe('right');
    expect(valhallaManeuverKind(14)).toBe('left');
    expect(valhallaManeuverKind(17)).toBe('roundabout');
    expect(valhallaManeuverKind(26)).toBe('merge');
  });

  it('falls back to straight for anything unmapped', () => {
    expect(valhallaManeuverKind(999)).toBe('straight');
  });
});

const valhallaTrip: ValhallaResponse = {
  trip: {
    summary: { length: 1.89, time: 267 },
    legs: [
      {
        shape: 'chkdcBo`epXqGn@oEb@s@Fu@HYBaAJkJhAgYpCg@',
        maneuvers: [
          { type: 1, instruction: 'Drive north on Friedrichstraße.', length: 1.141, time: 162, begin_shape_index: 0 },
          { type: 10, instruction: 'Turn right onto Torstraße.', length: 0.748, time: 104, begin_shape_index: 2 },
          { type: 4, instruction: 'You have arrived at your destination.', length: 0, time: 0, begin_shape_index: 5 },
        ],
      },
    ],
  },
};

describe('normalizeValhalla', () => {
  it('converts a trip into metres, seconds and GeoJSON', () => {
    const r = normalizeValhalla(valhallaTrip, 'auto')!;
    expect(r.provider).toBe('valhalla');
    expect(r.mode).toBe('auto');
    expect(r.distance).toBeCloseTo(1890, 0); // km -> m
    expect(r.duration).toBe(267);
    expect(r.geometry.type).toBe('LineString');
    expect(r.geometry.coordinates.length).toBeGreaterThan(1);
  });

  it('keeps the narrative instructions and maps maneuver kinds', () => {
    const r = normalizeValhalla(valhallaTrip, 'auto')!;
    expect(r.steps.map((s) => s.instruction)).toEqual([
      'Drive north on Friedrichstraße.',
      'Turn right onto Torstraße.',
      'You have arrived at your destination.',
    ]);
    expect(r.steps.map((s) => s.type)).toEqual(['depart', 'right', 'arrive']);
    expect(r.steps[1].distance).toBeCloseTo(748, 0);
  });

  it('does not duplicate the shared vertex between consecutive legs', () => {
    const leg = valhallaTrip.trip!.legs![0];
    const single = normalizeValhalla(valhallaTrip, 'auto')!.geometry.coordinates.length;
    const twoLegs = normalizeValhalla(
      { trip: { summary: { length: 3.78, time: 534 }, legs: [leg, leg] } },
      'auto',
    )!.geometry.coordinates.length;
    expect(twoLegs).toBe(single * 2 - 1);
  });

  it('returns null when there is no usable trip', () => {
    expect(normalizeValhalla({}, 'auto')).toBeNull();
    expect(normalizeValhalla({ trip: { legs: [] } }, 'auto')).toBeNull();
    expect(normalizeValhalla({ trip: { legs: [{ shape: '' }] } }, 'auto')).toBeNull();
  });
});

describe('normalizeValhallaAll', () => {
  it('returns the primary route followed by each alternate', () => {
    const withAlts = {
      ...valhallaTrip,
      alternates: [{ trip: valhallaTrip.trip }, { trip: valhallaTrip.trip }],
    };
    const all = normalizeValhallaAll(withAlts, 'auto');
    expect(all).toHaveLength(3);
    expect(all[0].steps).toHaveLength(3);
  });

  it('returns just the primary when the engine offers no alternative', () => {
    expect(normalizeValhallaAll(valhallaTrip, 'auto')).toHaveLength(1);
  });

  it('returns nothing when there is no usable trip', () => {
    expect(normalizeValhallaAll({}, 'auto')).toEqual([]);
  });
});

describe('buildCostingOptions', () => {
  it('turns avoid flags into the engine 0..1 preferences', () => {
    expect(buildCostingOptions('auto', { tolls: true, highways: true }))
      .toEqual({ auto: { use_tolls: 0, use_highways: 0 } });
  });

  it('keys the options by the travel mode', () => {
    expect(buildCostingOptions('bicycle', { ferries: true })).toEqual({ bicycle: { use_ferry: 0 } });
  });

  it('sends nothing when nothing is avoided', () => {
    expect(buildCostingOptions('auto', {})).toEqual({});
  });
});
