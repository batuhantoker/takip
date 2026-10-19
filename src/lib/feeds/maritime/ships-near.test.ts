import { describe, expect, it } from 'vitest';
import { countNear, parseNear } from './ships-near';

const parse = (q: string) => parseNear(new URLSearchParams(q));

describe('parseNear', () => {
  it('reads a point and radius, with spaces, defaulting to 10 km and capping at 100', () => {
    expect(parse('near=41.0167, 28.9667&km=5')).toEqual({ lat: 41.0167, lng: 28.9667, km: 5 });
    expect(parse('near=0,0')).toEqual({ lat: 0, lng: 0, km: 10 });
    expect(parse('near=0,0&km=1e6')).toEqual({ lat: 0, lng: 0, km: 100 });
  });

  it('is null without near, and an error for anything else malformed', () => {
    expect(parse('km=5')).toBeNull();
    expect(parse('near=north,east')).toHaveProperty('error');
    expect(parse('near=0,0&km=0')).toHaveProperty('error');
  });
});

describe('countNear', () => {
  it('counts the ships within the radius, those under way and their classes', () => {
    const ships = [{ lat: 0, lng: 0, speed: 0.5, type: 'cargo' }, { lat: 0.05, lng: 0, speed: 0.4 }, { lat: 0.2, lng: 0, speed: 9, type: 'cargo' }];
    expect(countNear(ships, { lat: 0, lng: 0, km: 10 })).toEqual({ km: 10, total: 2, underway: 1, types: { cargo: 1, other: 1 } });
  });
});
