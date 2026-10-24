import { describe, expect, it } from 'vitest';
import { numberWords, retold } from './numbers';

describe('numberWords', () => {
  it('says counts as a narrator does', () => {
    expect(numberWords(18)).toBe('eighteen');
    expect(numberWords(70)).toBe('seventy');
    expect(numberWords(320)).toBe('three hundred twenty');
    expect(numberWords(2350)).toBe('two thousand three hundred fifty');
    expect(numberWords(1001)).toBe('one thousand one');
  });
});

describe('retold', () => {
  it('swaps the count and spells it out when nothing else needs words', () => {
    expect(retold('About 70 aircraft in view around Heathrow and Gatwick.', 70, 320)).toEqual({
      say: 'About 320 aircraft in view around Heathrow and Gatwick.',
      spoken: 'About three hundred twenty aircraft in view around Heathrow and Gatwick.',
    });
  });
  it('keeps a comma where the line had one', () => {
    expect(retold('About 2,350 aircraft over the Atlantic.', 2350, 1980)?.say).toBe('About 1,980 aircraft over the Atlantic.');
  });
  it('leaves the spelling to the model when another number is in the line', () => {
    expect(retold('Over the North Pacific, 427 km up, about 50 in view.', 50, 60)).toEqual({ say: 'Over the North Pacific, 427 km up, about 60 in view.' });
  });
  it("doesn't touch a line without the count, or a number it is part of", () => {
    expect(retold('About seventy aircraft in view.', 70, 320)).toBeNull();
    expect(retold('About 170 aircraft in view.', 70, 320)).toBeNull();
  });
});
