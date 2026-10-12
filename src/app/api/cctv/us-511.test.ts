import { describe, it, expect } from 'vitest';
import { STATE_FEEDS } from './us-511';

describe('STATE_FEEDS', () => {
  it('registers each region once', () => {
    const regions = STATE_FEEDS.map(f => f.region);
    expect(new Set(regions).size).toBe(regions.length);
  });

  it('prefixes ids per agency, so two states cannot collide on a numeric id', () => {
    // Includes the hand-written modules' prefixes.
    const prefixes = [...STATE_FEEDS.map(f => f.idPrefix), 'fdot', 'gdot', 'ncdot', 'adot', 'udot', 'ndot', 'ladotd', 'indot', 'nycdot'];
    expect(new Set(prefixes).size).toBe(prefixes.length);
  });

  it('gives every feed a real box, which is also where it loads', () => {
    for (const { region, bounds: b } of STATE_FEEDS) {
      expect(b.minLat, region).toBeLessThan(b.maxLat);
      expect(b.minLng, region).toBeLessThan(b.maxLng);
      expect(b.minLat, region).toBeGreaterThanOrEqual(-90);
      expect(b.maxLat, region).toBeLessThanOrEqual(90);
      expect(b.minLng, region).toBeGreaterThanOrEqual(-180);
      expect(b.maxLng, region).toBeLessThanOrEqual(180);
    }
  });
});
