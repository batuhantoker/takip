import { describe, expect, it } from 'vitest';
import { routeModes, vehicleMode } from './route-mode';

describe('routeModes', () => {
  it('names the main mode and lists only the routes that run another', () => {
    expect(routeModes([['1', 'bus'], ['2', 'bus'], ['Red', 'metro'], ['Green-B', 'tram']])).toEqual({ main: 'bus', other: { metro: ['Red'], tram: ['Green-B'] } });
    expect(routeModes([['1', 'bus'], ['2', 'bus']])).toBeNull();
  });
});

describe('vehicleMode', () => {
  const table = { mbta: { main: 'bus' as const, other: { metro: ['Red', 'Orange'] } } };

  it("reads a mixed feed's route, falling back to its main mode", () => {
    expect(vehicleMode({ id: 'mbta' }, 'Red', table)).toBe('metro');
    expect(vehicleMode({ id: 'mbta' }, '57', table)).toBe('bus');
    expect(vehicleMode({ id: 'mbta' }, undefined, table)).toBe('bus');
  });

  it("takes a single-mode feed's one mode, and says nothing for a feed that never said", () => {
    expect(vehicleMode({ id: 'iett', modes: ['bus'] }, 'X', table)).toBe('bus');
    expect(vehicleMode({ id: 'unknown' }, 'X', table)).toBeUndefined();
  });
});
