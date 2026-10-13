import { describe, expect, it } from 'vitest';
import { rateLabel, replayDate, span } from './replay-format';

describe('replay formatting', () => {
  it('reads the date in UTC', () => {
    expect(replayDate(2444032.5)).toBe('1979-06-08 00:00 UTC');
  });

  it('reads spans at a useful precision', () => {
    expect(span(0.002)).toBe('3 min');
    expect(span(0.25)).toBe('6 h 0 min');
    expect(span(12.2)).toBe('12 d 5 h');
    expect(span(365.25 + 249)).toBe('1 y 249 d');
  });

  it('reads slowed rates', () => {
    expect(rateLabel(0.1)).toBe('2.4 hours/s');
    expect(rateLabel(5)).toBe('5 days/s');
  });
});
