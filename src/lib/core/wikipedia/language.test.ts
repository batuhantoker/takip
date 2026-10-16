import { describe, expect, it } from 'vitest';
import { getWikiLanguage, setWikiLanguage } from './language';

describe('wiki language', () => {
  it('keeps a valid choice for the session where storage is missing', () => {
    expect(getWikiLanguage()).toBe('en');
    setWikiLanguage('Not a code');
    expect(getWikiLanguage()).toBe('en');
    setWikiLanguage('de');
    expect(getWikiLanguage()).toBe('de');
  });
});
