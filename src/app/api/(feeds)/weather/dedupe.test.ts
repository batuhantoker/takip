import { describe, expect, it } from 'vitest';
import { distanceKm, dropNearDuplicates } from './dedupe';

describe('distanceKm', () => {
  it('measures great-circle distance', () => {
    expect(distanceKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(111.2, 0);
  });
});

describe('dropNearDuplicates', () => {
  const kanlaonGdacs = { id: 'gdacs', src: 'GDACS', lat: 10.412, lng: 123.132 };
  const kanlaonEonet = { id: 'eonet', src: 'EONET', lat: 10.41, lng: 123.13 };
  const etnaEonet = { id: 'etna', src: 'EONET', lat: 37.75, lng: 14.99 };

  it('keeps the stronger source of a pair and leaves unmatched events alone', () => {
    const out = dropNearDuplicates([kanlaonEonet, kanlaonGdacs, etnaEonet], e => e.src === 'EONET', e => e.src === 'GDACS', 100);
    expect(out.map(e => e.id)).toEqual(['gdacs', 'etna']);
  });
});
