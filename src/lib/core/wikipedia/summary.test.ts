import { describe, expect, it } from 'vitest';
import { leadSentences, trimExtract } from './summary';

describe('trimExtract', () => {
  it('cuts at a sentence end', () => {
    expect(trimExtract('One sentence here. Another one that runs on and on.', 30)).toBe('One sentence here.');
  });
});

describe('leadSentences', () => {
  const salamis = 'The Battle of Salamis was a naval battle fought in 480 BC, between an alliance of Greek city-states under Themistocles, and the Achaemenid Empire under King Xerxes. It resulted in a victory for the outnumbered Greeks.';

  it('keeps whole sentences while they fit', () => {
    expect(leadSentences(salamis, 170)).toBe('The Battle of Salamis was a naval battle fought in 480 BC, between an alliance of Greek city-states under Themistocles, and the Achaemenid Empire under King Xerxes.');
    expect(leadSentences(salamis, 300)).toBe(salamis);
  });

  it('cuts a first sentence that is too long at a word', () => {
    const s = leadSentences(salamis, 60);
    expect(s).toBe('The Battle of Salamis was a naval battle fought in 480 BC…');
    expect([...s].length).toBeLessThanOrEqual(60);
  });

  it('splits Japanese at 。 and joins without a space', () => {
    expect(leadSentences('サラミスの海戦は海戦。ヘロドトスの『歴史』に詳しい。', 30)).toBe('サラミスの海戦は海戦。ヘロドトスの『歴史』に詳しい。');
    expect(leadSentences('サラミスの海戦は海戦。ヘロドトスの『歴史』に詳しい。', 12)).toBe('サラミスの海戦は海戦。');
  });

  it('doesn’t end a sentence at an initial', () => {
    expect(leadSentences('Built by J. Smith in 1900. Torn down later.', 30)).toBe('Built by J. Smith in 1900.');
    expect(leadSentences('Built by J. Smith in 1900. Torn down later.', 20)).toBe('Built by J. Smith…');
  });
});
