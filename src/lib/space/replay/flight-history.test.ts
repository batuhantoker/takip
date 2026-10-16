import { describe, expect, it } from 'vitest';
import { flightEnded, historyDue, type CraftHistory } from './flight-history';

const flight = (end: number, fetchedJd: number): CraftHistory =>
  ({ id: -1, name: 'Test', start: 0, end, fetchedJd, coarse: { t0: 0, step: 1, pos: [] }, encounters: [], phases: [], events: [] });

describe('stored flight freshness', () => {
  it('treats a flight whose ephemeris ended a year before the fetch as final', () => {
    expect(flightEnded(flight(100, 500))).toBe(true);
    expect(flightEnded(flight(2700, 500))).toBe(false);
    expect(historyDue(flight(100, 500), 10_000, 7)).toBe(false);
  });

  it('keeps refetching one that ended recently, since JPL may extend it', () => {
    expect(flightEnded(flight(300, 500))).toBe(false);
    expect(historyDue(flight(300, 500), 508, 7)).toBe(true);
  });

  it('refetches a live flight only once its prediction is older than the limit', () => {
    expect(historyDue(flight(2700, 500), 506, 7)).toBe(false);
    expect(historyDue(flight(2700, 500), 508, 7)).toBe(true);
  });
});
