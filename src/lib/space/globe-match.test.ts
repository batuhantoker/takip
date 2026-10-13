import { describe, expect, it } from 'vitest';
import { angleBetween, bodyDirection } from './frames';
import { distanceForRadius, globeCameraDirection, globeCentreDropPx, globeCentreOffsetDeg, globeRadiusPx, zoomForRadius } from './globe-match';

const VIEW = { lat: 0, lng: 0, zoom: 1.5, pitch: 0, bearing: 0, height: 800, fov: 36.87 };

describe('globe matching', () => {
  it('draws the limb a little inside the flat radius, being further away than the centre', () => {
    const flat = (512 * 2 ** 1.5) / (2 * Math.PI);
    expect(globeRadiusPx(VIEW)).toBeGreaterThan(flat * 0.8);
    expect(globeRadiusPx(VIEW)).toBeLessThan(flat);
  });

  it('places the space camera so Earth fills the same pixels', () => {
    const r = globeRadiusPx(VIEW);
    const d = distanceForRadius(r, 800, 45, 6371);
    const f = 400 / Math.tan((22.5 * Math.PI) / 180);
    expect(Math.tan(Math.asin(6371 / d)) * f).toBeCloseTo(r, 6);
    expect(d).toBeGreaterThan(20_000);
    expect(d).toBeLessThan(60_000);
  });

  it('looks straight down on the centre without pitch, and from the south when pitched north-up', () => {
    expect(angleBetween(globeCameraDirection({ ...VIEW, lat: 40, lng: -74 }), bodyDirection(40, -74))).toBeLessThan(1e-9);
    const d = globeCameraDirection({ ...VIEW, pitch: 20 });
    expect(d[2]).toBeLessThan(0);
  });

  it("puts the map's camera over the point the centre offset names", () => {
    const v = { ...VIEW, lat: 20, pitch: 20 };
    const under = bodyDirection(20 - globeCentreOffsetDeg(v), 0);
    expect(angleBetween(globeCameraDirection(v), under)).toBeLessThan(1e-6);
  });

  it('drops the globe below centre only when pitched', () => {
    expect(globeCentreDropPx(VIEW)).toBe(0);
    const drop = globeCentreDropPx({ ...VIEW, pitch: 20 });
    expect(drop).toBeGreaterThan(30);
    expect(drop).toBeLessThan(globeRadiusPx({ ...VIEW, pitch: 20 }));
  });

  it('inverts the radius to a zoom', () => {
    const v = { ...VIEW, lat: 35, pitch: 20 };
    expect(zoomForRadius(globeRadiusPx({ ...v, zoom: 2.2 }), v)).toBeCloseTo(2.2, 6);
  });
});
