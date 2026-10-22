/**
 * Chrome's own language detector and translator, which run on the reader's device and send nothing anywhere
 * (Chrome 138 and later, on desktop). Other browsers have neither, and nothing is translated there. A language
 * pair's model may need downloading first, which Chrome starts only from a click.
 */

export type Availability = 'unavailable' | 'downloadable' | 'downloading' | 'available';

interface Pair { sourceLanguage: string; targetLanguage: string }
interface Translator { translate(text: string): Promise<string> }
interface Detector { detect(text: string): Promise<{ detectedLanguage: string; confidence: number }[]> }
interface Apis {
  Translator: { availability(pair: Pair): Promise<Availability>; create(pair: Pair): Promise<Translator> };
  LanguageDetector: { create(): Promise<Detector> };
}

function apis(): Apis | null {
  const g = globalThis as unknown as Partial<Apis>;
  return g.Translator && g.LanguageDetector ? (g as Apis) : null;
}

export const translatesOnDevice = () => apis() !== null;

/** The language a translator takes: 'pt-BR' → 'pt', 'zh-Hans' → 'zh'. */
export const baseLanguage = (tag: string) => tag.split('-')[0].toLowerCase();

// A short headline can fool the detector; below this it is left alone.
const MIN_CONFIDENCE = 0.6;

/** Headlines into `target`, one translator per source language, each headline translated once. */
export function createHeadlineTranslator(target: string) {
  const api = apis();
  const to = baseLanguage(target);
  let detector: Promise<Detector | null> | null = null;
  const languages = new Map<string, Promise<string | null>>();
  const translators = new Map<string, Translator>();
  const done = new Map<string, string>();

  return {
    target: to,

    /** The language `text` is in, or null where the detector can't tell. */
    languageOf(text: string): Promise<string | null> {
      if (!api) return Promise.resolve(null);
      let found = languages.get(text);
      if (!found) {
        detector ??= api.LanguageDetector.create().catch(() => null);
        found = detector
          .then(d => d?.detect(text))
          .then(r => (r?.[0] && r[0].confidence >= MIN_CONFIDENCE && r[0].detectedLanguage !== 'und' ? baseLanguage(r[0].detectedLanguage) : null))
          .catch(() => null);
        languages.set(text, found);
      }
      return found;
    },

    availability(from: string): Promise<Availability> {
      if (!api) return Promise.resolve('unavailable');
      if (translators.has(from)) return Promise.resolve('available');
      return api.Translator.availability({ sourceLanguage: from, targetLanguage: to }).catch(() => 'unavailable' as const);
    },

    /** Opens the translators from `from`; where a model must download, call it from a click. */
    async open(from: string[]): Promise<void> {
      if (!api) return;
      await Promise.all(from.filter(f => !translators.has(f)).map(f =>
        api.Translator.create({ sourceLanguage: f, targetLanguage: to }).then(tr => { translators.set(f, tr); }).catch(() => undefined)));
    },

    async translate(text: string, from: string): Promise<string | null> {
      const key = `${from}|${text}`;
      const known = done.get(key);
      if (known) return known;
      const out = await translators.get(from)?.translate(text).catch(() => null);
      if (out) done.set(key, out);
      return out ?? null;
    },
  };
}

export type HeadlineTranslator = ReturnType<typeof createHeadlineTranslator>;

/** The article itself, read through Google Translate in `target`; it opens in every browser. */
export const translatedPageUrl = (url: string, target: string) =>
  `https://translate.google.com/translate?sl=auto&tl=${encodeURIComponent(baseLanguage(target))}&u=${encodeURIComponent(url)}`;
