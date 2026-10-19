/**
 * The page's language for browser-only code: popups, hover tips, map layers, anything built outside React.
 * Components use useT() instead: on the server this is shared by every request, so it always answers in English.
 */
import { DEFAULT_LOCALE } from './locales';
import { createTranslator, type Translate, type Vars } from './translator';

let active: Translate = createTranslator(DEFAULT_LOCALE, {});
let warned = false;

/** Called by LocaleProvider in the browser, before anything below it renders. */
export function setActiveTranslator(next: Translate) {
  active = next;
}

export function t(source: string, vars?: Vars): string {
  if (!warned && typeof window === 'undefined' && process.env.NEXT_RUNTIME && process.env.NODE_ENV !== 'production') {
    warned = true;
    console.warn(`[i18n] t("${source}") ran on the server, where it is always English; render-time text needs useT().`);
  }
  return active(source, vars);
}

export const activeLocale = () => active.locale;
/** The tag for Intl formatters and toLocaleString. */
export const activeIntl = () => active.intl;
