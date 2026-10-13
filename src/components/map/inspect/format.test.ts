import { describe, expect, it } from 'vitest';
import { ago, bearing, compass, coords, seaName } from './format';

describe('inspect format', () => {
  it('names the compass point', () => {
    expect(`${bearing(274)} ${compass(274)}`).toBe('274° W');
    expect(`${bearing(359.6)} ${compass(359.6)}`).toBe('0° N');
    expect(`${bearing(-90)} ${compass(-90)}`).toBe('270° W');
  });

  it('writes hemispheres instead of signs', () => {
    expect(coords(40.7128, -74.006)).toBe('40.7128° N, 74.0060° W');
  });

  it('says how long ago in plain words', () => {
    expect(ago(2000)).toBe('just now');
    expect(ago(40_000)).toBe('40 s ago');
    expect(ago(3 * 60_000)).toBe('3 min ago');
  });

  it('puts open water in the right ocean', () => {
    expect(seaName(38, -70)).toBe('North Atlantic Ocean');
    expect(seaName(30, -78)).toBe('North Atlantic Ocean');
    expect(seaName(10, -90)).toBe('North Pacific Ocean');
    expect(seaName(-30, -20)).toBe('South Atlantic Ocean');
    expect(seaName(-35, -80)).toBe('South Pacific Ocean');
    expect(seaName(-10, 80)).toBe('Indian Ocean');
    expect(seaName(35, 18)).toBe('Mediterranean Sea');
    expect(seaName(25, -90)).toBe('Gulf of Mexico');
    expect(seaName(35, 150)).toBe('North Pacific Ocean');
  });
});
