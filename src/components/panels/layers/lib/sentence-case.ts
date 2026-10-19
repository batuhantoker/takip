import type { Translate } from '@/lib/core/i18n/translator';

/**
 * "Private Jets" → "Private jets", "NET & EVENT INTEL" → "Net & event intel".
 * Mixed-case text keeps acronyms (GPS, CCTV, 3D) and only lowers later capitalised words.
 */
export function sentenceCase(text: string): string {
  if (!/[a-z]/.test(text)) return text.charAt(0) + text.slice(1).toLowerCase();
  return text.replace(/\b[A-Z][a-z]+\b/g, (word, at: number) => (at === 0 ? word : word.toLowerCase()));
}

/** A label from the layer tables in the reader's language; one without a translation reads as sentence-cased English. */
export function localLabel(text: string, t: Translate): string {
  const translated = t(text);
  return translated === text ? sentenceCase(text) : translated;
}

/** A name set inside a sentence: lowered, except in German, which capitalises nouns. */
export const inSentence = (name: string, t: Translate) => (t.locale === 'de' ? name : name.toLocaleLowerCase(t.intl));
