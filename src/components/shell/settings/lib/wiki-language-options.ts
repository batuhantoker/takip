import { languageName, WIKI_LANGUAGES } from '@/lib/core/wikipedia/language';

/** The offered Wikipedias, plus the current one if it was picked somewhere that offers more. */
export function wikiLanguageOptions(current: string, codes: readonly string[] = WIKI_LANGUAGES) {
  const all = codes.includes(current) ? codes : [...codes, current];
  return all.map(code => ({ value: code, label: languageName(code) }));
}
