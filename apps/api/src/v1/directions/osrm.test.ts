import { describe, it, expect } from 'vitest';
import { osrmInstruction, normalizeOsrm, type OsrmResponse } from './osrm';

describe('osrmInstruction', () => {
  it('builds turn text from type, modifier and street name', () => {
    expect(osrmInstruction({ name: 'Torstraße', maneuver: { type: 'turn', modifier: 'right' } }))
      .toBe('Turn right onto Torstraße');
    expect(osrmInstruction({ name: 'Friedrichstraße', maneuver: { type: 'depart' } }))
      .toBe('Head out on Friedrichstraße');
    expect(osrmInstruction({ maneuver: { type: 'arrive' } }))
      .toBe('You have arrived at your destination');
  });

  it('handles roundabouts with and without an exit number', () => {
    expect(osrmInstruction({ name: 'A1', maneuver: { type: 'roundabout', exit: 3 } }))
      .toBe('At the roundabout, take exit 3 onto A1');
    expect(osrmInstruction({ maneuver: { type: 'rotary' } })).toBe('Enter the roundabout');
  });

  it('omits the "onto" clause for unnamed roads', () => {
    expect(osrmInstruction({ maneuver: { type: 'turn', modifier: 'left' } })).toBe('Turn left');
    expect(osrmInstruction({ name: '', maneuver: { type: 'continue' } })).toBe('Continue');
  });
});

describe('normalizeOsrm', () => {
  const osrm: OsrmResponse = {
    routes: [
      {
        distance: 1888,
        duration: 260,
        geometry: { coordinates: [[13.3888, 52.517], [13.3897, 52.5294]] },
        legs: [
          {
            steps: [
              { name: 'Friedrichstraße', distance: 187, duration: 31, maneuver: { type: 'depart', location: [13.3888, 52.517] } },
              { name: 'Torstraße', distance: 750, duration: 124, maneuver: { type: 'turn', modifier: 'right', location: [13.3872, 52.5271] } },
            ],
          },
        ],
      },
    ],
  };

  it('normalises an OSRM route to the shared shape', () => {
    const r = normalizeOsrm(osrm, 'auto')!;
    expect(r.provider).toBe('osrm');
    expect(r.distance).toBe(1888);
    expect(r.geometry.coordinates).toHaveLength(2);
    expect(r.steps.map((s) => s.instruction)).toEqual([
      'Head out on Friedrichstraße',
      'Turn right onto Torstraße',
    ]);
  });

  it('returns null without geometry', () => {
    expect(normalizeOsrm({}, 'auto')).toBeNull();
    expect(normalizeOsrm({ routes: [{ geometry: { coordinates: [] } }] }, 'auto')).toBeNull();
  });
});
