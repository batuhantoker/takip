import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { atMa } from '@/lib/paleo/deep-time';
import { createHistorySession } from './session';

describe('history session deep time', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });
  afterEach(() => vi.unstubAllGlobals());

  const never = (() => new Promise(() => {})) as unknown as typeof fetch;

  it('sets the calendar aside and puts it back', () => {
    const s = createHistorySession(Date.UTC(1940, 0, 1), never);
    s.setLayer('ww2-europe', true);
    s.clock.play();
    s.setDeep(true);
    expect(s.layers()).toEqual([]);
    expect(s.clock.playing()).toBe(false);
    s.setDeep(false);
    expect(s.layers()).toEqual(['ww2-europe']);
    expect(s.clock.playing()).toBe(true);
    s.dispose();
  });

  it('shows one set of borders at a time', () => {
    const s = createHistorySession(Date.UTC(1940, 0, 1), never);
    s.setLayer('ww2-europe', true);
    s.setLayer('world-borders', true);
    expect(s.layers()).toEqual(['world-borders']);
    s.setLayer('ww2-europe', false);
    expect(s.layers()).toEqual(['world-borders']);
    s.dispose();
  });

  it('opens deep time with the story and closes the story on leaving', () => {
    const s = createHistorySession(Date.UTC(1940, 0, 1), never);
    s.story.go(0);
    expect(s.deep()).toBe(true);
    expect(s.deepClock.time()).toBe(atMa(1800));
    s.setDeep(false);
    expect(s.story.index()).toBeNull();
    s.dispose();
  });
});
