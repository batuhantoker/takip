import { isLocale, type Locale } from '@/lib/core/i18n/locales';

const NAMES: Record<Locale, string> = {
  en: 'English', tr: 'Turkish', es: 'Spanish', pt: 'Brazilian Portuguese', fr: 'French', de: 'German', ru: 'Russian',
  ar: 'Arabic', zh: 'Simplified Chinese', ja: 'Japanese',
};

/** The reader's language from X-AI-Lang (the web app sends its own); English, the prompts' language, needs no note. */
export const replyLocale = (v: string | null | undefined): Locale | undefined => (isLocale(v) && v !== 'en' ? v : undefined);

/** Added to a prompt whose answer people read: only their prose changes language, never what code parses. */
export function languageNote(locale: Locale | undefined): string {
  if (!locale) return '';
  const name = NAMES[locale];
  return `\n\nLANGUAGE: The reader reads ${name}. Write every sentence meant for them in ${name}. Keep JSON keys, enumerated values, action and tool names, ids, codes, numbers and quoted source text exactly as specified; names of people, places and sources may stay as their sources give them.`;
}
