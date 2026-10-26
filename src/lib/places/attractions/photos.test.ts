import { describe, expect, it } from 'vitest';
import { authorOf, plainText } from './photos';

describe('authorOf', () => {
  it('credits the linked name Commons gives', () => {
    expect(authorOf('<a href="//commons.wikimedia.org/wiki/User:Benh" title="User:Benh">Benh LIEU SONG</a>')).toBe('Benh LIEU SONG');
  });

  it('keeps the first sentence of a note, and nothing for no author', () => {
    expect(authorOf('This Photo was taken by Wolfgang Moroder. Feel free to use my photos, but please mention me.')).toBe('This Photo was taken by Wolfgang Moroder.');
    expect(authorOf(undefined)).toBeNull();
  });
});

describe('plainText', () => {
  it('drops tags and entities', () => {
    expect(plainText('<span>CC BY-SA&nbsp;4.0 &amp; more</span>')).toBe('CC BY-SA 4.0 & more');
  });
});
