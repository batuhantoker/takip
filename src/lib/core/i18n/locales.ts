/** The languages the UI is translated into. English is the source: its strings are the catalog keys. */
export const LOCALES = ['en', 'tr', 'es', 'pt', 'fr', 'de', 'ru', 'ar', 'zh', 'ja'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

/** Set only by an explicit pick in Settings; without it the language follows the visitor's country. */
export const LOCALE_COOKIE = 'takip-lang';

/** Set by src/proxy.ts on the public reading pages, whose language is in their URL (/tr/map/…); it wins over the cookie. */
export const PATH_LOCALE_HEADER = 'x-takip-path-locale';

export const isLocale = (v: unknown): v is Locale => typeof v === 'string' && (LOCALES as readonly string[]).includes(v);

/** Each language in itself, for the picker. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  tr: 'Türkçe',
  es: 'Español',
  pt: 'Português (Brasil)',
  fr: 'Français',
  de: 'Deutsch',
  ru: 'Русский',
  ar: 'العربية',
  zh: '简体中文',
  ja: '日本語',
};

// Latin digits for Arabic: coordinates, callsigns and readings stay legible beside each other.
const INTL: Record<Locale, string> = {
  en: 'en', tr: 'tr', es: 'es', pt: 'pt-BR', fr: 'fr', de: 'de', ru: 'ru', ar: 'ar-u-nu-latn', zh: 'zh-CN', ja: 'ja',
};

/** The tag to hand Intl formatters. */
export const intlTag = (locale: Locale) => INTL[locale];

const OG: Record<Locale, string> = {
  en: 'en_US', tr: 'tr_TR', es: 'es_ES', pt: 'pt_BR', fr: 'fr_FR', de: 'de_DE', ru: 'ru_RU', ar: 'ar_AR', zh: 'zh_CN', ja: 'ja_JP',
};

export const ogLocale = (locale: Locale) => OG[locale];

/** Arabic text runs right to left; the shell stays left to right until it is mirrored (docs/design/README.md). */
export const isRtl = (locale: Locale) => locale === 'ar';
