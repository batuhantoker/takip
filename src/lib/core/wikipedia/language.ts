/* The reader's Wikipedia, picked in Settings: popups show its article when one exists, else the one the data names. */

import { activeLocale } from '@/lib/core/i18n/active';

const KEY = 'takip.wiki-language';
export const DEFAULT_WIKI_LANGUAGE = 'en';

/** The Wikipedias Settings offers, roughly by size. */
export const WIKI_LANGUAGES = ['en', 'de', 'fr', 'es', 'ja', 'ru', 'it', 'pt', 'zh', 'pl', 'nl', 'uk', 'ar', 'fa', 'tr', 'ko', 'sv', 'id', 'vi', 'he'] as const;

const isCode = (v: string | null): v is string => !!v && /^[a-z][a-z0-9-]{1,15}$/.test(v);

/** Where storage is blocked, the choice lasts until the page reloads. */
let session: string | null = null;

export function getWikiLanguage(): string {
  let v = session;
  try {
    v = window.localStorage.getItem(KEY) ?? v;
  } catch {
    // Storage blocked.
  }
  if (isCode(v)) return v;
  const ui = activeLocale();
  return (WIKI_LANGUAGES as readonly string[]).includes(ui) ? ui : DEFAULT_WIKI_LANGUAGE;
}

export function setWikiLanguage(lang: string) {
  if (!isCode(lang)) return;
  session = lang;
  try {
    window.localStorage.setItem(KEY, lang);
  } catch {
    // Storage blocked.
  }
}

/** "French" for fr, in the language `intl` names; the code itself where the browser has no name for it. */
export function languageName(lang: string, intl = 'en'): string {
  try {
    return new Intl.DisplayNames([intl], { type: 'language' }).of(lang) ?? lang;
  } catch {
    return lang;
  }
}
