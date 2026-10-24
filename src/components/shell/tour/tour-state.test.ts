import { afterEach, describe, expect, it } from 'vitest';
import { STOPS } from './lib/stops';
import { endTour, startTour, stepTour, tourAt } from './tour-state';

afterEach(endTour);

describe('tour state', () => {
  it('starts on the stop asked for, kept within the tour', () => {
    startTour(2);
    expect(tourAt()).toBe(2);
    startTour(99);
    expect(tourAt()).toBe(STOPS.length - 1);
    startTour(-3);
    expect(tourAt()).toBe(0);
  });

  it('goes on and back, never before the first stop', () => {
    startTour();
    stepTour(1);
    expect(tourAt()).toBe(1);
    stepTour(-1);
    stepTour(-1);
    expect(tourAt()).toBe(0);
  });

  it('ends past the last stop', () => {
    startTour(STOPS.length - 1);
    stepTour(1);
    expect(tourAt()).toBeNull();
    stepTour(1);
    expect(tourAt()).toBeNull();
  });

  it('gives every stop something to ring', () => {
    for (const stop of STOPS) expect(stop.targets.length).toBeGreaterThan(0);
    expect(new Set(STOPS.map(s => s.id)).size).toBe(STOPS.length);
  });
});
