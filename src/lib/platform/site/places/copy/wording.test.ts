import { describe, expect, it } from 'vitest';
import { wordingFor } from './wording';

describe('a page’s wording', () => {
  it('stays the same for a page, and spreads across pages', () => {
    expect(wordingFor('2790869:outlook', 3)).toBe(wordingFor('2790869:outlook', 3));
    const picks = Array.from({ length: 3000 }, (_, i) => wordingFor(`${1_000_000 + i}:outlook`, 3));
    for (const n of [0, 1, 2]) expect(picks.filter(p => p === n).length).toBeGreaterThan(800);
  });

  it('lets one page’s sentences pick apart', () => {
    const same = Array.from({ length: 300 }, (_, i) => wordingFor(`${i}:rise`, 3) === wordingFor(`${i}:nearest`, 3)).filter(Boolean).length;
    expect(same).toBeLessThan(150);
  });
});
