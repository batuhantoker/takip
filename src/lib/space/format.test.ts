import { describe, expect, it } from 'vitest';
import { age, distance, latLng, lightTime, speed } from './format';

describe('distance', () => {
  it('switches from kilometres to astronomical units', () => {
    expect(distance(6_800)).toBe('6,800 km');
    expect(distance(384_399)).toBe('384,400 km');
    expect(distance(1_500_000)).toBe('1,500,000 km');
    expect(distance(227_900_000)).toBe('1.523 AU');
    expect(distance(25_000_000_000)).toBe('167.1 AU');
    expect(distance(NaN)).toBe('—');
  });
});

describe('lightTime', () => {
  it('reads seconds, minutes and hours', () => {
    expect(lightTime(1.28)).toBe('1.3 s');
    expect(lightTime(499)).toBe('8 min 19 s');
    expect(lightTime(83_640)).toBe('23 h 14 min');
  });
});

describe('speed and latLng', () => {
  it('formats with sensible precision', () => {
    expect(speed(1.6562)).toBe('1.66 km/s');
    expect(speed(16.98)).toBe('17.0 km/s');
    expect(latLng(-4.8246, 137.3878)).toBe('4.82°S 137.39°E');
  });
});

describe('age', () => {
  it('describes how old a timestamp is', () => {
    const now = Date.parse('2026-10-12T20:00:00Z');
    expect(age('2026-10-12T19:59:00Z', now)).toBe('just now');
    expect(age('2026-10-12T19:02:00Z', now)).toBe('58 min ago');
    expect(age('2026-09-29T15:12:00Z', now)).toBe('13 d ago');
    expect(age(null, now)).toBe('time unknown');
  });
});
