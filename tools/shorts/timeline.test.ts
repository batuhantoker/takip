import { describe, expect, it } from 'vitest';
import type { Beat, Script } from './scene';
import { FRAME_MS, chunk, frameAt, layout, timeWords, tokens } from './timeline';

const beats: Beat[] = [
  { id: 'hook', say: 'Earth in a minute.', card: 'hook' },
  { id: 'a', say: 'One continent splits into many pieces over time.', title: 'Pangaea', minMs: 6000 },
  { id: 'outro', say: 'Explore it yourself.', card: 'end' },
];
const script: Script = {
  lang: 'en', kicker: 'Deep time', beats: beats.map(({ id, say, title }) => ({ id, say, ...(title ? { title } : {}) })),
  ui: { sources: 'Sources', explore: 'Explore it live', bce: 'BCE' }, post: { title: '', description: '', hashtags: [] },
};

describe('tokens', () => {
  it('splits spaced languages on spaces', () => {
    expect(tokens('  Two  hundred million ', 'en')).toEqual(['Two', 'hundred', 'million']);
  });
  it('cuts unspaced languages at word boundaries, keeping punctuation with the word before', () => {
    const parts = tokens('二億年前、すべての大陸はひとつでした。', 'ja');
    expect(parts.join('')).toBe('二億年前、すべての大陸はひとつでした。');
    expect(parts).toContain('大陸');
    expect(parts.some(p => p === '、' || p === '。')).toBe(false);
  });
});

describe('timeWords', () => {
  it('fills the speech span in order', () => {
    const words = timeWords('a bb ccc', 'en', 1000, 2000);
    expect(words[0].start).toBe(1000);
    expect(words[2].end).toBe(2000);
    for (let i = 1; i < words.length; i++) expect(words[i].start).toBe(words[i - 1].end);
  });
});

describe('chunk', () => {
  it('keeps cards short and in time order', () => {
    const words = timeWords('One continent splits into many pieces over a very long time, then drifts.', 'en', 0, 5000);
    const cards = chunk(words, 'en');
    expect(cards.length).toBeGreaterThan(1);
    for (const c of cards) expect(c.words.length).toBeLessThanOrEqual(5);
    for (let i = 1; i < cards.length; i++) expect(cards[i].start).toBe(cards[i - 1].end);
  });
});

describe('layout', () => {
  const voices = { hook: { ms: 1500 }, a: { ms: 3000, speech: [100, 2900] as [number, number] }, outro: { ms: 1200 } };
  const tl = layout(beats, script, voices);

  it('lets a camera leg outlast the voice, and holds the end card', () => {
    expect(tl.beats[1].end - tl.beats[1].start).toBeGreaterThanOrEqual(6000);
    expect(tl.beats[2].end - tl.beats[2].start).toBeGreaterThan(1200 + 1800);
    expect(tl.totalMs).toBe(tl.beats[2].end);
  });

  it('starts every beat on a frame', () => {
    for (const b of tl.beats) expect(Math.abs(b.start / FRAME_MS - Math.round(b.start / FRAME_MS))).toBeLessThan(1e-6);
  });

  it('refuses a beat without a voice', () => {
    expect(() => layout(beats, script, { hook: { ms: 1 } })).toThrow(/no voice/);
  });

  it('shows the hook card first, then the title and the word being said', () => {
    expect(frameAt(tl, script, 0).card).toBe('hook');
    const b = tl.beats[1];
    const mid = b.chunks[0].words[1];
    const f = frameAt(tl, script, (mid.start + mid.end) / 2);
    expect(f.title).toBe('Pangaea');
    expect(f.counter).toBe(true);
    expect(f.caption?.map(w => w.state)).toEqual([0, 1, ...Array(f.caption!.length - 2).fill(2)]);
    expect(frameAt(tl, script, tl.totalMs - 1).end?.explore).toBe('Explore it live');
  });
});
