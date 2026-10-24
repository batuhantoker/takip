import { describe, expect, it } from 'vitest';
import { closed, estimateMs, isGrave, plainIfGrave, shortHold, TAGLINE, trimmed } from './loop';
import { LOOPS, opening } from './narrate/style';
import type { Scene } from './scene';

const scene = (body: number): Scene => ({
  id: 's', kind: 'story', path: '/', chrome: 'map-only', kicker: 'k', sources: [], post: { title: '', description: '', hashtags: [] },
  beats: [
    { id: 'hook', say: 'TAKIP has everything, and more. Today: the race to the Pole.', minMs: 2500 },
    ...Array.from({ length: body }, (_, i) => ({ id: `b${i}`, say: 'A line of about twelve words that the narrator says at an even pace.', minMs: 4000 })),
    { id: 'outro', say: "That's why I keep saying it:", enter: 'back()', minMs: 2200, credits: true, counterWithTitle: true },
  ],
});

describe('closed', () => {
  it('ends on the tagline and the end card, with no flight back', () => {
    const c = closed(scene(5));
    const last = c.beats[c.beats.length - 1];
    expect(c.loop).toBe(false);
    expect(last).toMatchObject({ id: 'outro', say: TAGLINE, card: 'end', counterWithTitle: true });
    expect(last.enter).not.toContain('back()');
    expect(last.credits).toBeUndefined();
  });
});

describe('trimmed', () => {
  it('keeps the hook, the opening beats that fit in 25 s, and the loop outro', () => {
    const t = trimmed(scene(5));
    expect(t.beats[0].id).toBe('hook');
    expect(t.beats[t.beats.length - 1].say).toBe("That's why I keep saying it:");
    expect(t.beats.slice(1, -1).map(b => b.id)).toEqual(['b0', 'b1', 'b2']);
    expect(t.beats.reduce((s, b) => s + estimateMs(b), 0)).toBeLessThanOrEqual(25_000);
  });
  it('keeps two beats at least', () => {
    const long = scene(4);
    long.beats.slice(1, -1).forEach(b => (b.minMs = 12_000));
    expect(trimmed(long).beats).toHaveLength(4);
  });
});

describe('shortHold', () => {
  it("fills a short's body, never under the floor", () => {
    expect(shortHold(3, 4000)).toBe(5333);
    expect(shortHold(5, 4000)).toBe(4000);
  });
});

describe('plainIfGrave', () => {
  const story = (kicker: string, title: string, variant: number): Scene => ({
    ...scene(1), kicker, post: { title, description: 'military flights, quakes', hashtags: [] },
    beats: [
      { id: 'hook', say: `${opening(LOOPS[variant].hype)} Today: every nuclear explosion on record.` },
      { id: 'b0', say: 'A line.' },
      { id: 'outro', say: LOOPS[variant].bridge },
    ],
  });
  it('gives a grave story a plain hook and its bridge, the variant taken among the plain loops', () => {
    const s = plainIfGrave(story('Nuclear age', 'Every nuclear explosion, 1945 to 1998', 7), 'x', '7');
    expect(s.beats[0].say).toBe(`${opening(LOOPS[2].hype)} Today: every nuclear explosion on record.`);
    expect(s.beats[2].say).toBe(LOOPS[2].bridge);
  });
  it('leaves a story that is not grave, whatever its description lists', () => {
    const s = story('Live flight tracker', 'Live flight tracker: planes on a map right now', 7);
    s.beats[0].say = `${opening(LOOPS[7].hype)} Today: who's over London.`;
    expect(isGrave(s)).toBe(false);
    expect(plainIfGrave(s, 'x', '7')).toBe(s);
  });
  it("takes a maker's word for it", () => {
    expect(isGrave({ ...story('Napoleon', 'Napoleon, from Toulon to Saint Helena', 7), grave: true })).toBe(true);
  });
});
