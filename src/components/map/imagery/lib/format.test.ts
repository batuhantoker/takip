import { describe, it, expect } from 'vitest';
import { countdown, daysAgo, kindLabel, utcStamp } from './format';

const NOW = Date.parse('2026-10-15T22:00:00Z');

describe('imagery format', () => {
  it('stamps in UTC', () => {
    expect(utcStamp(Date.parse('2026-10-12T08:46:30Z'))).toBe('12 Oct, 08:46 UTC');
  });

  it('counts whole UTC days back', () => {
    expect(daysAgo(Date.parse('2026-10-15T03:46:00Z'), NOW)).toBe('today');
    expect(daysAgo(Date.parse('2026-10-14T23:00:00Z'), NOW)).toBe('yesterday');
    expect(daysAgo(Date.parse('2026-10-12T08:46:00Z'), NOW)).toBe('3 days ago');
  });

  it('counts down to a pass', () => {
    expect(countdown(NOW + 40 * 60_000, NOW)).toBe('in 40 min');
    expect(countdown(NOW + 5 * 3_600_000, NOW)).toBe('in 5 h');
    expect(countdown(NOW + 52 * 3_600_000, NOW)).toBe('in 2 d 4 h');
  });

  it('names the kind of image', () => {
    expect(kindLabel({ kind: 'radar', resolution: '10 m' })).toBe('Radar · 10 m');
  });
});
