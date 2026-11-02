import { describe, expect, it } from 'vitest';
import { closed, estimateMs, lengthProblem, shortHold, spokenWords, TAGLINE, trimmed, wordsFor } from './loop';
import type { Scene } from './scene';

const scene = (body: number): Scene => ({
  id: 's', kind: 'story', path: '/', chrome: 'map-only', kicker: 'k', sources: [], post: { title: '', description: '', hashtags: [] },
  beats: [
    { id: 'hook', say: 'In 1911, two teams raced for the South Pole.', minMs: 2500 },
    ...Array.from({ length: body }, (_, i) => ({ id: `b${i}`, say: 'A line of about twelve words that the narrator says at an even pace.', minMs: 4000 })),
    { id: 'outro', say: 'Follow both routes yourself on TAKIP.', enter: 'back()', minMs: 2200, credits: true, counterWithTitle: true },
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
    expect(t.beats[t.beats.length - 1].say).toBe('Follow both routes yourself on TAKIP.');
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

describe('wordsFor', () => {
  it("asks for enough words to fill a beat's picture at the narrator's pace", () => {
    expect(wordsFor(4000)).toEqual({ lo: 8, hi: 10 });
    expect(wordsFor(13_000)).toEqual({ lo: 26, hi: 35 });
    expect(wordsFor(500).hi).toBe(6);
  });
});

describe('spokenWords', () => {
  it('counts numbers as the narrator says them', () => {
    expect(spokenWords('In 1954, a Bikini test reaches about 15,000 kilotons.')).toBe(11);
    expect(spokenWords('2,051 explosions, magnitude 5.3.')).toBe(3 + 1 + 1 + 3);
  });
});

describe('lengthProblem', () => {
  const range = { lo: 8, hi: 10 };
  it('sends back a line too short for its picture, or too long counted as spoken', () => {
    expect(lengthProblem({ a: 'Patricia hit its peak.' }, range)).toMatch(/"a" says 4 words; write 8–10 words as spoken/);
    expect(lengthProblem({ a: 'In 1954 and 1961, tests reach 15,000 and 50,000 kilotons.' }, range)).toMatch(/says 14 words; keep it/);
  });
  it('lets a line a word or two either side through', () => {
    expect(lengthProblem({ a: Array(7).fill('word').join(' '), b: Array(12).fill('word').join(' ') }, range)).toBeNull();
  });
});
