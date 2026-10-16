import { describe, expect, it } from 'vitest';
import { WIKI_LANGUAGES } from '@/lib/core/wikipedia/language';
import { settingsTab } from './tabs';
import { wikiLanguageOptions } from './wiki-language-options';

describe('settingsTab', () => {
  it('opens account settings when no tab is named', () => {
    expect(settingsTab({})).toBe('account');
    expect(settingsTab({ tab: undefined })).toBe('account');
  });

  it('keeps a named tab', () => {
    expect(settingsTab({ tab: 'map' })).toBe('map');
  });
});

describe('wikiLanguageOptions', () => {
  it('names every offered Wikipedia, in the offered order', () => {
    const options = wikiLanguageOptions('en');
    expect(options.map(o => o.value)).toEqual([...WIKI_LANGUAGES]);
    expect(options[0]).toEqual({ value: 'en', label: 'English' });
    expect(options.find(o => o.value === 'de')?.label).toBe('German');
  });

  it('keeps a current language the list does not offer, so the select can show it', () => {
    const options = wikiLanguageOptions('eo', ['en', 'de']);
    expect(options.map(o => o.value)).toEqual(['en', 'de', 'eo']);
    expect(options[2].label).toBe('Esperanto');
  });
});
