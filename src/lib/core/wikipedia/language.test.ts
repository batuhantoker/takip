import { describe, expect, it, vi } from 'vitest';
import { getWikiLanguage, setWikiLanguage, subscribeWikiLanguage } from './language';

describe('wiki language', () => {
  it('keeps a valid choice for the session where storage is missing', () => {
    expect(getWikiLanguage()).toBe('en');
    setWikiLanguage('Not a code');
    expect(getWikiLanguage()).toBe('en');
    setWikiLanguage('de');
    expect(getWikiLanguage()).toBe('de');
  });

  it('tells subscribers about a valid choice, until they leave', () => {
    const heard = vi.fn();
    const leave = subscribeWikiLanguage(heard);
    setWikiLanguage('Not a code');
    expect(heard).not.toHaveBeenCalled();
    setWikiLanguage('tr');
    expect(heard).toHaveBeenCalledTimes(1);
    leave();
    setWikiLanguage('fr');
    expect(heard).toHaveBeenCalledTimes(1);
    expect(getWikiLanguage()).toBe('fr');
  });
});
