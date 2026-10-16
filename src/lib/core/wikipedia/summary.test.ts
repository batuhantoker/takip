import { describe, expect, it } from 'vitest';
import { trimExtract } from './summary';

describe('trimExtract', () => {
  it('cuts at a sentence end', () => {
    expect(trimExtract('One sentence here. Another one that runs on and on.', 30)).toBe('One sentence here.');
  });
});
