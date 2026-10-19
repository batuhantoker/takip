import { LOCALE_COOKIE, type Locale } from './locales';

/** Saves the visitor's pick, or clears it so their country decides again, and reloads in that language. */
export function chooseLocale(locale: Locale | null) {
  const age = locale ? 60 * 60 * 24 * 400 : 0;
  document.cookie = `${LOCALE_COOKIE}=${locale ?? ''}; Path=/; Max-Age=${age}; SameSite=Lax`;
  window.location.reload();
}
