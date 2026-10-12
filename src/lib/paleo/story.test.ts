import { describe, expect, it } from 'vitest';
import { createReplayClock } from '@/lib/replay/clock';
import { atMa } from './deep-time';
import { type Chapter, createStory } from './story';

const chapters: Chapter[] = [
  { ma: 300, title: 'a', place: [0, 0], zoom: 2, body: 'one' },
  { ma: 100, title: 'b', place: [0, 0], zoom: 2, body: 'two' },
];

function setup() {
  let frame: ((ms: number) => void) | null = null;
  const clock = createReplayClock(atMa(500), { now: () => 0, frame: cb => { frame = cb; return 1; }, cancelFrame: () => { frame = null; } });
  const pending: (() => void)[] = [];
  let opened = 0;
  const story = createStory(clock, {
    chapters,
    onOpen: () => opened++,
    timers: { set: fn => pending.push(fn), clear: () => pending.splice(0) },
  });
  const tick = (ms: number) => frame?.(ms);
  return { clock, story, tick, pending, opened: () => opened };
}

describe('story', () => {
  it('runs the clock forward to a chapter and stops on it', () => {
    const { clock, story, tick, opened } = setup();
    story.go(0);
    expect(opened()).toBe(1);
    expect(story.arrived()).toBe(false);
    tick(0);
    tick(10_000);
    expect(story.arrived()).toBe(true);
    expect(clock.time()).toBe(atMa(300));
    expect(clock.playing()).toBe(false);
  });

  it('cuts back to an earlier chapter', () => {
    const { clock, story } = setup();
    clock.seek(atMa(50));
    story.go(1);
    story.prev();
    expect(story.arrived()).toBe(true);
    expect(clock.time()).toBe(atMa(300));
  });

  it('moves on by itself once read, and stops at the end', () => {
    const { story, tick, pending } = setup();
    story.setAuto(true);
    story.go(0);
    tick(0);
    tick(10_000);
    expect(pending).toHaveLength(1);
    pending.shift()!();
    expect(story.index()).toBe(1);
    tick(20_000);
    tick(30_000);
    pending.shift()!();
    expect(story.auto()).toBe(false);
  });

  it('gives the clock back with its speed when closed', () => {
    const { clock, story } = setup();
    clock.setSpeed(5000);
    story.go(0);
    story.close();
    expect(story.index()).toBeNull();
    expect(clock.speed()).toBe(5000);
  });
});
