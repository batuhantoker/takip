import { describe, expect, it } from 'vitest';
import { queueDelayMs } from './nominatim';

describe('queueDelayMs', () => {
  it('is nothing once a gap has passed since the last request and none wait', () => {
    expect(queueDelayMs(1_000, 0, 2_000, 3_000)).toBe(0);
    expect(queueDelayMs(1_000, 0, 2_000, 9_000)).toBe(0);
  });

  it('is the rest of the gap, and a gap more for each request still waiting', () => {
    expect(queueDelayMs(1_000, 0, 2_000, 1_500)).toBe(1_500);
    expect(queueDelayMs(1_000, 2, 2_000, 1_500)).toBe(5_500);
  });
});
