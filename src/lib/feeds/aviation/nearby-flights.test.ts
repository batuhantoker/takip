import { describe, expect, it } from 'vitest';
import { bucketFor, mergeNearby } from './nearby-flights';

describe('mergeNearby', () => {
  const global = {
    commercial_flights: [{ icao24: 'a', category: 'commercial', lat: 1 }, { icao24: 'b', category: 'commercial', lat: 1 }],
    private_jets: [{ icao24: 'old', category: 'jet', near: true }],
  };

  it('replaces the same aircraft with its fresher row and adds new ones, in their category\'s bucket', () => {
    const out = mergeNearby(global, [{ icao24: 'a', category: 'commercial', lat: 2 }, { icao24: 'm', category: 'military', lat: 3 }]);
    expect(out.commercial_flights).toEqual([{ icao24: 'b', category: 'commercial', lat: 1 }, { icao24: 'a', category: 'commercial', lat: 2, near: true }]);
    expect(out.military_flights).toEqual([{ icao24: 'm', category: 'military', lat: 3, near: true }]);
  });

  it('drops nearby rows from an earlier merge', () => {
    expect(mergeNearby(global, []).private_jets).toEqual([]);
  });

  it('splits as /api/flights does', () => {
    expect(['military', 'jet', 'private', 'commercial', undefined].map(bucketFor))
      .toEqual(['military_flights', 'private_jets', 'private_flights', 'commercial_flights', 'commercial_flights']);
  });
});
