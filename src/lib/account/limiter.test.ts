import { describe, expect, it } from 'vitest';
import { createAccountLimiter } from './limiter';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const T0 = Date.UTC(2026, 9, 12, 12);

const limiter = () => createAccountLimiter({ breach: { limit: 3, windowMs: HOUR }, network: { limit: 20, windowMs: MINUTE } });
const takeTimes = (take: () => number, n: number) => Array.from({ length: n }, take);

describe('createAccountLimiter', () => {
  it('allows the limit, then names the wait until the next use', () => {
    const { take } = limiter();
    expect(takeTimes(() => take('breach', 'u1', T0), 3)).toEqual([0, 0, 0]);
    expect(take('breach', 'u1', T0)).toBe(20 * 60);
  });

  it('refills evenly over the window', () => {
    const { take } = limiter();
    takeTimes(() => take('breach', 'u1', T0), 3);
    expect(take('breach', 'u1', T0 + 19 * MINUTE)).toBe(60);
    expect(take('breach', 'u1', T0 + 20 * MINUTE)).toBe(0);
    expect(take('breach', 'u1', T0 + 20 * MINUTE)).toBe(20 * 60);
  });

  it('never refills past the limit', () => {
    const { take } = limiter();
    take('breach', 'u1', T0);
    expect(takeTimes(() => take('breach', 'u1', T0 + 24 * HOUR), 4)).toEqual([0, 0, 0, 20 * 60]);
  });

  it('counts each account and each family on its own', () => {
    const { take } = limiter();
    takeTimes(() => take('breach', 'u1', T0), 3);
    expect(take('breach', 'u1', T0)).toBeGreaterThan(0);
    expect(take('breach', 'u2', T0)).toBe(0);
    expect(takeTimes(() => take('network', 'u1', T0), 20).every(wait => wait === 0)).toBe(true);
    expect(take('network', 'u1', T0)).toBe(3);
  });
});
