import { describe, expect, it } from 'vitest';
import { auroraReport, chanceAt, darkness, likeliestNear, ovationLookup, type OvationGrid } from './aurora-now';

const grid = (cells: [number, number, number][]): OvationGrid => ({
  observed_at: '2026-10-19T21:50:00Z', forecast_at: '2026-10-19T22:25:00Z', cells, max_pct: Math.max(0, ...cells.map(c => c[2])),
});
const TROMSO = { lat: 69.65, lng: 18.96, tz: 'Europe/Oslo' };
const NIGHT = Date.parse('2026-10-19T22:00:00Z');
const H = 3_600_000;

describe('the OVATION grid', () => {
  it('interpolates between the four nodes around a place, a missing node counting as nothing', () => {
    const look = ovationLookup(grid([[18, 69, 40], [19, 69, 40], [18, 70, 20], [19, 70, 20]]));
    expect(chanceAt(look, 69, 18)).toBe(40);
    expect(chanceAt(look, 69.5, 18.5)).toBeCloseTo(30, 6);
    expect(chanceAt(look, 68.5, 18)).toBeCloseTo(20, 6);
  });

  it('wraps longitude at the antimeridian', () => {
    const look = ovationLookup(grid([[180, -52, 30], [-179, -52, 10]]));
    expect(chanceAt(look, -52, -179.5)).toBeCloseTo(20, 6);
    expect(chanceAt(look, -52, 179.5)).toBeCloseTo(15, 6);
  });

  it('finds the likeliest node within reach, and which way it lies', () => {
    const look = ovationLookup(grid([[19, 73, 25], [19, 75, 60], [40, 69, 90]]));
    expect(likeliestNear(look, 69.65, 18.96)).toEqual({ pct: 25, km: 373, toward: 'N' });
    expect(likeliestNear(look, 50, 10)).toBeNull();
  });
});

describe('darkness', () => {
  it('has the dark end before dawn on an autumn night in Munich', () => {
    const d = darkness(Date.parse('2026-10-19T20:00:00Z'), 48.14, 11.58);
    expect(d.state).toBe('dark');
    expect(d.darkUntil).toBeGreaterThan(Date.parse('2026-10-20T04:00:00Z'));
    expect(d.darkUntil).toBeLessThan(Date.parse('2026-10-20T05:00:00Z'));
  });

  it('gives the next dark on an autumn afternoon', () => {
    const d = darkness(Date.parse('2026-10-19T12:00:00Z'), TROMSO.lat, TROMSO.lng);
    expect(d.state).toBe('light');
    expect(d.darkFrom).toBeGreaterThan(Date.parse('2026-10-19T16:00:00Z'));
    expect(d.darkFrom).toBeLessThan(Date.parse('2026-10-19T18:00:00Z'));
  });

  it('looks months ahead under the midnight sun', () => {
    const d = darkness(Date.parse('2026-06-21T12:00:00Z'), TROMSO.lat, TROMSO.lng);
    expect(d.darkFrom).toBeNull();
    expect(d.darkAgain).toBeGreaterThan(Date.parse('2026-08-01T00:00:00Z'));
    expect(d.darkAgain).toBeLessThan(Date.parse('2026-09-01T00:00:00Z'));
  });
});

describe('auroraReport', () => {
  it('says it is likely overhead when the place is dark and its cells are high', () => {
    const r = auroraReport(grid([[18, 69, 30], [19, 69, 30], [18, 70, 30], [19, 70, 30]]), TROMSO, NIGHT);
    expect(r).toMatchObject({ case: 'overhead', here: 30, worldMax: 30 });
    expect(r.clock.darkUntil?.date).toBe('2026-10-20');
  });

  it('points to the horizon when only cells within 500 km are high', () => {
    const r = auroraReport(grid([[19, 73, 25]]), TROMSO, NIGHT);
    expect(r).toMatchObject({ case: 'horizon', here: 0, nearby: { pct: 25, toward: 'N' } });
  });

  it('is quiet, light or without dark as the numbers say', () => {
    expect(auroraReport(grid([]), TROMSO, NIGHT).case).toBe('quiet');
    expect(auroraReport(grid([[19, 70, 50]]), TROMSO, NIGHT - 10 * H).case).toBe('light');
    expect(auroraReport(grid([[19, 70, 50]]), TROMSO, Date.parse('2026-06-21T22:00:00Z')).case).toBe('no-dark');
  });

  it('keeps the darkness lines without a nowcast', () => {
    const r = auroraReport(null, TROMSO, NIGHT);
    expect(r.case).toBe('unavailable');
    expect(r.darkness.state).toBe('dark');
    expect(r.here).toBeNull();
  });
});
