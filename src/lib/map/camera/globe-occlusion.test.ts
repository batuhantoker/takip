import { describe, expect, it } from 'vitest';
import { globeCamera, inFrontOfGlobe } from './globe-occlusion';

const camera = { lng: 0, lat: 0, radius: 4 };

describe('inFrontOfGlobe', () => {
  it('sees a satellite over the near side', () => {
    expect(inFrontOfGlobe({ lng: 10, lat: 5, radius: 1.1 }, camera)).toBe(true);
  });

  it('hides one over the far side', () => {
    expect(inFrontOfGlobe({ lng: 180, lat: 0, radius: 1.1 }, camera)).toBe(false);
    expect(inFrontOfGlobe({ lng: 160.7, lat: 0.4, radius: 1.08 }, { lng: -30, lat: 30, radius: 4 })).toBe(false);
  });

  it('sees a high one peeking over the limb but not a low one at the same longitude', () => {
    expect(inFrontOfGlobe({ lng: 100, lat: 0, radius: 2 }, camera)).toBe(true);
    expect(inFrontOfGlobe({ lng: 100, lat: 0, radius: 1.05 }, camera)).toBe(false);
  });
});

describe('globeCamera', () => {
  it('sits straight above the centre with no pitch, a few radii out at world zoom', () => {
    const cam = globeCamera({ lng: -30, lat: 30, zoom: 2.3, pitch: 0, bearing: 0, fovDeg: 36.87, heightPx: 900 });
    expect(cam.lng).toBeCloseTo(-30, 5);
    expect(cam.lat).toBeCloseTo(30, 5);
    expect(cam.radius).toBeGreaterThan(3);
    expect(cam.radius).toBeLessThan(5);
  });

  it('moves south of the centre when pitched with north up', () => {
    const cam = globeCamera({ lng: 0, lat: 0, zoom: 3, pitch: 40, bearing: 0, fovDeg: 36.87, heightPx: 900 });
    expect(cam.lat).toBeLessThan(0);
  });
});
