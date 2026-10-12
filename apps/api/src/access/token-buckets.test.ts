import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTokenBuckets } from './token-buckets';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-12T12:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('token buckets', () => {
  it('hold one second of burst and refill continuously', () => {
    const buckets = createTokenBuckets();
    for (let i = 9; i >= 0; i--) expect(buckets.take('a', 10)).toMatchObject({ allowed: true, limit: 10, remaining: i });
    expect(buckets.take('a', 10)).toMatchObject({ allowed: false, remaining: 0, retryAfterS: 1 });

    vi.advanceTimersByTime(100);
    expect(buckets.take('a', 10)).toMatchObject({ allowed: true, remaining: 0 });
    expect(buckets.take('a', 10).allowed).toBe(false);

    vi.advanceTimersByTime(5_000);
    expect(buckets.take('a', 10)).toMatchObject({ allowed: true, remaining: 9 });
  });

  it('follow a plan change at once, never holding more than the new rate', () => {
    const buckets = createTokenBuckets();
    buckets.take('a', 50);
    expect(buckets.take('a', 2)).toMatchObject({ allowed: true, limit: 2, remaining: 1 });
  });

  it('refuse everything at a rate of zero', () => {
    expect(createTokenBuckets().take('a', 0)).toMatchObject({ allowed: false, limit: 0, retryAfterS: 60 });
  });

  it('forget idle buckets and stay under their cap', () => {
    const buckets = createTokenBuckets({ maxBuckets: 3 });
    for (const key of ['a', 'b', 'c', 'd']) buckets.take(key, 10);
    expect(buckets.size()).toBe(3);

    vi.advanceTimersByTime(10_000);
    buckets.take('e', 10);
    expect(buckets.size()).toBe(1);
  });
});
