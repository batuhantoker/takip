import { afterEach, describe, expect, it, vi } from 'vitest';
import { baseLanguage, createHeadlineTranslator, translatedPageUrl, translatesOnDevice } from './on-device';

/** Chrome's two APIs, faked: German is ready, Greek has to download, and every translation is counted. */
function fakeChrome() {
  const calls = { translate: 0, create: [] as string[] };
  const g = globalThis as Record<string, unknown>;
  g.LanguageDetector = {
    create: async () => ({
      detect: async (text: string) => (text.startsWith('Der') ? [{ detectedLanguage: 'de', confidence: 0.97 }]
        : text.startsWith('Η') ? [{ detectedLanguage: 'el', confidence: 0.9 }]
          : [{ detectedLanguage: 'it', confidence: 0.3 }]),
    }),
  };
  g.Translator = {
    availability: async ({ sourceLanguage }: { sourceLanguage: string }) => (sourceLanguage === 'de' ? 'available' : 'downloadable'),
    create: async ({ sourceLanguage }: { sourceLanguage: string }) => {
      calls.create.push(sourceLanguage);
      return { translate: async (text: string) => { calls.translate++; return `[en] ${text}`; } };
    },
  };
  return calls;
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>).Translator;
  delete (globalThis as Record<string, unknown>).LanguageDetector;
  vi.restoreAllMocks();
});

describe('headlines translated on the device', () => {
  it('does nothing where the browser has no translator', async () => {
    expect(translatesOnDevice()).toBe(false);
    expect(await createHeadlineTranslator('en').languageOf('Der Kanzler')).toBeNull();
  });

  it('names a language only when the detector is sure of it', async () => {
    fakeChrome();
    const tr = createHeadlineTranslator('en-US');
    expect([tr.target, await tr.languageOf('Der Kanzler tritt zurück'), await tr.languageOf('Ciao')]).toEqual(['en', 'de', null]);
  });

  it('translates once a language is open, and each headline once', async () => {
    const calls = fakeChrome();
    const tr = createHeadlineTranslator('en');
    expect([await tr.availability('de'), await tr.availability('el')]).toEqual(['available', 'downloadable']);
    expect(await tr.translate('Η κυβέρνηση', 'el')).toBeNull();
    await tr.open(['de']);
    expect(await tr.translate('Der Kanzler', 'de')).toBe('[en] Der Kanzler');
    expect(await tr.translate('Der Kanzler', 'de')).toBe('[en] Der Kanzler');
    expect(calls).toEqual({ translate: 1, create: ['de'] });
  });

  it('opens the article through Google Translate in the reader’s language', () => {
    expect(translatedPageUrl('https://example.gr/a?b=1', 'pt-BR')).toBe('https://translate.google.com/translate?sl=auto&tl=pt&u=https%3A%2F%2Fexample.gr%2Fa%3Fb%3D1');
    expect(baseLanguage('zh-Hans')).toBe('zh');
  });
});
