import { describe, it, expect } from 'vitest';
import { twoline2satrec } from 'satellite.js';
import { compassPoint, lookAngles, nextSkyPasses, sunAltitude } from './pass';

// As CelesTrak gave them on 2026-10-15.
const ISS = twoline2satrec(
  '1 25544U 98067A   26288.82192346  .00005580  00000+0  10980-3 0  9999',
  '2 25544  51.6317  63.1136 0006755 265.8514  94.1703 15.48879905590452',
);
const GOES16 = twoline2satrec(
  '1 41866U 16071A   26288.91611146 -.00000089  00000+0  00000+0 0  9991',
  '2 41866   0.6343  83.8499 0002006 148.4567  17.2650  1.00272698 36316',
);
const LONDON = { lat: 51.5, lng: -0.13 };
const FROM = Date.parse('2026-10-16T00:00:00Z');

describe('sunAltitude', () => {
  it('puts the sun overhead at the equator at an equinox noon and under it at midnight', () => {
    expect(sunAltitude(Date.parse('2026-03-20T12:07:00Z'), 0, 0)).toBeGreaterThan(88);
    expect(sunAltitude(Date.parse('2026-03-21T00:07:00Z'), 0, 0)).toBeLessThan(-88);
  });
});

describe('nextSkyPasses', () => {
  const passes = nextSkyPasses(ISS, LONDON.lat, LONDON.lng, FROM, { hours: 48, max: 20 });

  it('finds the ISS crossing London several times in two days, in order', () => {
    expect(passes.length).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < passes.length; i++) expect(passes[i].rise).toBeGreaterThan(passes[i - 1].set!);
  });

  it('times rise and set at the minimum elevation and the peak at the top', () => {
    for (const p of passes) {
      expect(p.set).not.toBeNull();
      expect(lookAngles(ISS, p.rise, LONDON.lat, LONDON.lng)!.elevation).toBeCloseTo(10, 0);
      expect(lookAngles(ISS, p.set!, LONDON.lat, LONDON.lng)!.elevation).toBeCloseTo(10, 0);
      expect(p.peak).toBeGreaterThan(p.rise);
      expect(p.peak).toBeLessThan(p.set!);
      expect(p.set! - p.rise).toBeLessThan(12 * 60_000);
      for (let t = p.rise; t <= p.set!; t += 7_000) {
        expect(lookAngles(ISS, t, LONDON.lat, LONDON.lng)!.elevation).toBeLessThanOrEqual(p.maxElevation + 0.05);
      }
    }
  });

  it('calls a pass visible only when the place is dark', () => {
    for (const p of passes.filter(q => q.visible)) {
      const darkSomewhere = [p.rise, p.peak, p.set!].some(t => sunAltitude(t, LONDON.lat, LONDON.lng) <= -6);
      expect(darkSomewhere).toBe(true);
    }
    const noon = passes.filter(p => sunAltitude(p.peak, LONDON.lat, LONDON.lng) > 10);
    expect(noon.every(p => !p.visible)).toBe(true);
  });

  it('starts a pass now for a satellite already up, and leaves a geostationary one unset', () => {
    const [goes, ...rest] = nextSkyPasses(GOES16, 25.8, -80.2, FROM, { hours: 6 });
    expect(rest).toEqual([]);
    expect(goes.rise).toBe(FROM);
    expect(goes.set).toBeNull();
    expect(goes.maxElevation).toBeGreaterThan(40);
  });

  it('finds nothing for a geostationary satellite below the horizon', () => {
    expect(nextSkyPasses(GOES16, 51.5, 100, FROM, { hours: 6 })).toEqual([]);
  });
});

describe('compassPoint', () => {
  it('rounds to the nearest of eight points', () => {
    expect(compassPoint(0)).toBe('N');
    expect(compassPoint(350)).toBe('N');
    expect(compassPoint(100)).toBe('E');
    expect(compassPoint(-90)).toBe('W');
  });
});
