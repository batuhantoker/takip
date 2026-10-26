import { describe, expect, it } from 'vitest';
import { DAY_STOPS, planDay, planDays, shortestPath, type PlanPoint } from './plan';

// About 111 m per 0.001° of latitude.
const at = (id: string, lat: number, l: number, lon = 2.35): PlanPoint => ({ id, at: [lon, 48.85 + lat], l });

describe('shortestPath', () => {
  it('walks a line end to end, from whichever end is shorter', () => {
    const points = [at('b', 0.002, 1), at('a', 0, 1), at('c', 0.004, 1)];
    expect(shortestPath(points).map(p => p.id).join('')).toMatch(/^(abc|cba)$/);
  });

  it('starts at the first point when asked', () => {
    const points = [at('b', 0.002, 1), at('a', 0, 1), at('c', 0.004, 1)];
    expect(shortestPath(points, true)[0].id).toBe('b');
  });
});

describe('planDay', () => {
  it('takes the best known within a short walk, up to a day of stops', () => {
    const pool = [at('top', 0, 90), ...Array.from({ length: 8 }, (_, i) => at(`n${i}`, 0.001 * (i + 1), 50 - i))];
    const day = planDay(pool)!;
    expect(day.stops).toHaveLength(DAY_STOPS);
    expect(day.stops.map(s => s.id)).toContain('top');
    expect(day.stops.map(s => s.id)).not.toContain('n7');
  });

  it('leaves out a famous place across town, and a lone minor one makes no day', () => {
    const pool = [at('top', 0, 90), at('far', 0.1, 80), at('near', 0.002, 10), at('next', 0.004, 9)];
    expect(planDay(pool)!.stops.map(s => s.id).sort()).toEqual(['near', 'next', 'top']);
    expect(planDay([at('alone', 0, 10)])).toBeNull();
  });

  it('gives a very well-known place a day to itself', () => {
    expect(planDay([at('versailles', 0, 120)])!.stops).toHaveLength(1);
  });
});

describe('planDays', () => {
  it('fills each day from what the days before left', () => {
    const west = Array.from({ length: 4 }, (_, i) => at(`w${i}`, 0.001 * i, 90 - i, 2.30));
    const east = Array.from({ length: 4 }, (_, i) => at(`e${i}`, 0.001 * i, 50 - i, 2.40));
    const days = planDays([...west, ...east], 7);
    expect(days).toHaveLength(2);
    expect(days[0].stops.every(s => s.id.startsWith('w'))).toBe(true);
    expect(days[1].stops.every(s => s.id.startsWith('e'))).toBe(true);
  });
});
