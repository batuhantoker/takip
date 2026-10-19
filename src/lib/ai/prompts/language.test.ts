import { describe, expect, it } from 'vitest';
import { languageNote, replyLocale } from './language';

describe('replyLocale', () => {
  it('takes a shipped language other than English', () => {
    expect(replyLocale('tr')).toBe('tr');
    expect(replyLocale('en')).toBeUndefined();
    expect(replyLocale('xx')).toBeUndefined();
    expect(replyLocale(null)).toBeUndefined();
  });
});

describe('languageNote', () => {
  it('names the language and keeps what code parses', () => {
    expect(languageNote(undefined)).toBe('');
    const note = languageNote('ja');
    expect(note).toContain('Japanese');
    expect(note).toContain('JSON keys');
  });
});
