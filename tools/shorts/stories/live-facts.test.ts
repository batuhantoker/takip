import { describe, expect, it } from 'vitest';
import { busiestViews } from './live-facts';

describe('busiestViews', () => {
  const at = (lat: number, lng: number, n: number) => [...Array(n)].map((_, i) => ({ lat: lat + i * 0.001, lng }));
  const name = ([w, s, e, n]: number[]) => (s < 33 && n > 33 && w < -97 && e > -97 ? 'Dallas' : s < 26 && n > 26 && w < -80 && e > -80 ? 'Miami' : null);
  const teterboro = { label: 'Teterboro', view: { lat: 40.85, lon: -74.06, zoom: 7.5 } };
  const points = [...at(40.9, -74, 50), ...at(32.9, -97, 30), ...at(25.8, -80.2, 20), ...at(45, -40, 40), ...at(25.8, -80.1, 5)];
  it('takes the busiest views away from the page\'s spots, named for a city in them', () => {
    expect(busiestViews(points, [teterboro], 7.5, 3, name).map(s => s.label)).toEqual(['Around Dallas', 'Around Miami']);
  });
  it('stops at n and skips views with too few', () => {
    expect(busiestViews(points, [teterboro], 7.5, 1, name).map(s => s.label)).toEqual(['Around Dallas']);
    expect(busiestViews(points, [teterboro], 7.5, 3, name, 26).map(s => s.label)).toEqual(['Around Dallas']);
  });
});
