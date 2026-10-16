import { afterEach, describe, expect, it, vi } from 'vitest';
import { coalesceTrackingMoves, TRACKING_MOVE } from './tracking-moves';

afterEach(() => vi.useRealTimers());

describe('coalesceTrackingMoves', () => {
  it('reports ordinary moves at once and a run of tracking moves once per window', () => {
    vi.useFakeTimers();
    const report = vi.fn();
    const { handler } = coalesceTrackingMoves(report, 500);
    handler({});
    expect(report).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 30; i++) handler({ ...TRACKING_MOVE });
    expect(report).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(500);
    expect(report).toHaveBeenCalledTimes(2);
    // A drag after the ride reports straight away and drops the pending one.
    handler({ ...TRACKING_MOVE });
    handler({});
    vi.advanceTimersByTime(500);
    expect(report).toHaveBeenCalledTimes(3);
  });
});
