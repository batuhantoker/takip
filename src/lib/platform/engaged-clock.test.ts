import { describe, expect, it } from 'vitest';
import { engagedClock, IDLE_MS } from './engaged-clock';

const S = 1_000;

describe('engaged time', () => {
  it('counts a reader who keeps scrolling', () => {
    const clock = engagedClock(0, true);
    for (let at = 10 * S; at <= 120 * S; at += 10 * S) clock.input(at);
    expect(clock.total(120 * S)).toBe(120 * S);
  });

  it('counts half a minute past the last input, and the opening as one', () => {
    const clock = engagedClock(0, true);
    expect(clock.total(100 * S)).toBe(IDLE_MS);
    clock.input(200 * S);
    expect(clock.total(210 * S)).toBe(IDLE_MS + 10 * S);
    expect(clock.total(400 * S)).toBe(2 * IDLE_MS);
  });

  it('stops while the tab is hidden and starts again when it comes back', () => {
    const clock = engagedClock(0, true);
    clock.input(20 * S);
    clock.shown(25 * S, false);
    clock.input(30 * S);
    expect(clock.total(300 * S)).toBe(25 * S);
    clock.shown(300 * S, true);
    expect(clock.total(310 * S)).toBe(35 * S);
  });

  it('counts nothing for a tab opened in the background until it is shown', () => {
    const clock = engagedClock(0, false);
    expect(clock.total(60 * S)).toBe(0);
    clock.shown(60 * S, true);
    expect(clock.total(65 * S)).toBe(5 * S);
  });

  it('is not restarted by a visible tab saying it is visible again', () => {
    const clock = engagedClock(0, true);
    clock.shown(50 * S, true);
    expect(clock.total(70 * S)).toBe(IDLE_MS);
  });
});
