import { describe, expect, it } from 'vitest';
import { horizonsDateMs, lightingAt, rowTimeMs, splitAtAntimeridian, thin, trackAt, type TrackPoint } from './surface';

describe('trackAt', () => {
  const track: TrackPoint[] = [
    { t: 0, lat: 0, lng: 170, altKm: 50 },
    { t: 100, lat: 10, lng: -170, altKm: 60 },
  ];

  it('interpolates across the antimeridian the short way', () => {
    const p = trackAt(track, 50)!;
    expect(p.lat).toBe(5);
    expect(Math.abs(p.lng)).toBeCloseTo(180, 6);
    expect(p.altKm).toBe(55);
  });

  it('gives nothing outside the track', () => {
    expect(trackAt(track, 101)).toBeNull();
    expect(trackAt(track.slice(0, 1), 0)).toBeNull();
  });
});

describe('splitAtAntimeridian', () => {
  it('breaks a ground track where it wraps', () => {
    const parts = splitAtAntimeridian([[170, 0], [179, 1], [-179, 2], [-170, 3]]);
    expect(parts).toEqual([[[170, 0], [179, 1]], [[-179, 2], [-170, 3]]]);
  });
});

describe('thin', () => {
  it('keeps the count under the cap and the final point', () => {
    const pts = Array.from({ length: 1001 }, (_, i) => i);
    const out = thin(pts, 100);
    expect(out.length).toBeLessThanOrEqual(101);
    expect(out[0]).toBe(0);
    expect(out[out.length - 1]).toBe(1000);
  });
});

describe('horizonsDateMs', () => {
  it('reads observer-table times as UT', () => {
    expect(horizonsDateMs(' 2026-Oct-12 20:24:00.000')).toBe(Date.UTC(2026, 9, 12, 20, 24));
    expect(horizonsDateMs('2026-Oct-12 20:24')).toBe(Date.UTC(2026, 9, 12, 20, 24));
    expect(horizonsDateMs('nonsense')).toBeNaN();
  });
});

describe('rowTimeMs', () => {
  it('finds the date column whatever its precision', () => {
    expect(rowTimeMs({ 'Date__(UT)__HR:MN': '2026-Oct-12 19:12' })).toBe(Date.UTC(2026, 9, 12, 19, 12));
    expect(rowTimeMs({ 'Date__(UT)__HR:MN:SC.fff': '2026-Oct-12 19:12:30.000' })).toBe(Date.UTC(2026, 9, 12, 19, 12, 30));
    expect(rowTimeMs({})).toBeNaN();
  });
});

describe('lightingAt', () => {
  it('turns the sub-solar point the short way across the antimeridian', () => {
    const pts = [
      { t: 0, sun: [170, 2] as [number, number], earth: [0, 6] as [number, number] },
      { t: 10, sun: [-170, 4] as [number, number], earth: [2, 8] as [number, number] },
    ];
    const p = lightingAt(pts, 5)!;
    expect(Math.abs(p.sun[0])).toBeCloseTo(180, 6);
    expect(p.sun[1]).toBe(3);
    expect(p.earth).toEqual([1, 7]);
    expect(lightingAt([], 0)).toBeNull();
  });
});
