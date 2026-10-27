import { afterEach, describe, expect, it } from 'vitest';
import { SPACE_STOPS, STOPS } from './lib/stops';
import { endTour, forgetStop, quitTour, resumeTour, setTourPart, startTour, stepTour, tourAt, tourHeading, tourName, tourPart, tourStopped, tourStops } from './tour-state';

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

  it('goes into a stop\'s panel and back out, and leaves it on the next stop', () => {
    startTour(2, 0);
    expect([tourAt(), tourPart()]).toEqual([2, 0]);
    setTourPart(3);
    expect(tourPart()).toBe(3);
    setTourPart(null);
    expect([tourAt(), tourPart()]).toEqual([2, null]);
    setTourPart(1);
    stepTour(1);
    expect([tourAt(), tourPart()]).toEqual([3, null]);
  });

  it('has no panel to go into with the tour off', () => {
    setTourPart(2);
    expect([tourAt(), tourPart()]).toEqual([null, null]);
  });

  it('remembers an early stop, picks it up again, and forgets it on a finish', () => {
    startTour(3, 2);
    endTour();
    expect(tourStopped()).toMatchObject({ at: 3, part: 2 });
    resumeTour();
    expect([tourAt(), tourPart(), tourStopped()]).toEqual([3, 2, null]);
    endTour();
    forgetStop();
    expect(tourStopped()).toBeNull();
    startTour(STOPS.length - 1);
    stepTour(1);
    expect(tourStopped()).toBeNull();
  });

  it('gives every stop something to ring', () => {
    for (const stop of STOPS) expect(stop.targets.length).toBeGreaterThan(0);
    expect(new Set(STOPS.map(s => s.id)).size).toBe(STOPS.length);
    expect(new Set(SPACE_STOPS.map(s => s.id)).size).toBe(SPACE_STOPS.length);
  });

  it('passes an unseen stop in the direction last moved', () => {
    startTour(2, null, 'space');
    expect(tourHeading()).toBe(1);
    stepTour(-1);
    expect(tourHeading()).toBe(-1);
    stepTour(1);
    expect(tourHeading()).toBe(1);
  });

  it('runs the space tour on its own stops, and ends it without offering to carry on', () => {
    startTour(99, null, 'space');
    expect([tourName(), tourAt(), tourStops()]).toEqual(['space', SPACE_STOPS.length - 1, SPACE_STOPS]);
    stepTour(1);
    expect(tourAt()).toBeNull();
    startTour(1, null, 'space');
    endTour();
    expect(tourStopped()).toBeNull();
  });

  it('quits only the tour it names, and goes back to the map tour to resume', () => {
    startTour(2, null, 'space');
    quitTour('map');
    expect(tourAt()).toBe(2);
    quitTour('space');
    expect(tourAt()).toBeNull();
    startTour(3);
    endTour();
    startTour(0, null, 'space');
    quitTour();
    resumeTour();
    expect([tourName(), tourAt()]).toEqual(['map', 3]);
  });
});
