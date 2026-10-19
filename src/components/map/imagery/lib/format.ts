import { DEFAULT_LOCALE } from '@/lib/core/i18n/locales';
import { createTranslator, msg, type Translate } from '@/lib/core/i18n/translator';

const ENGLISH = createTranslator(DEFAULT_LOCALE, {});

/** "12 Oct, 08:46" in UTC, for a list that says UTC once. */
export const utcTime = (ms: number, locale = 'en-GB') =>
  new Date(ms).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });

/** "12 Oct, 08:46 UTC" */
export const utcStamp = (ms: number, locale?: string) => `${utcTime(ms, locale)} UTC`;

/** "12 Oct" */
export const shortDate = (ms: number, locale = 'en-GB') => new Date(ms).toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** "today", "yesterday", "12 days ago", counted in whole UTC days. */
export function daysAgo(ms: number, now = Date.now(), t: Translate = ENGLISH): string {
  const days = Math.floor(now / 86_400_000) - Math.floor(ms / 86_400_000);
  if (days <= 0) return t('today');
  if (days === 1) return t('yesterday');
  return t('{n, plural, one {# day ago} other {# days ago}}', { n: days });
}

/** "in 40 min", "in 5 h", "in 2 d 4 h" */
export function countdown(ms: number, now = Date.now(), t: Translate = ENGLISH): string {
  const min = Math.max(0, Math.round((ms - now) / 60_000));
  if (min < 60) return t('in {n} min', { n: min });
  const h = Math.floor(min / 60);
  if (h < 24) return t('in {n} h', { n: h });
  return t('in {d} d {h} h', { d: Math.floor(h / 24), h: h % 24 });
}

const KIND = { optical: msg('True colour'), radar: msg('Radar') } as const;

/** "Colour · 10 m" */
export const kindLabel = (imager: { kind: keyof typeof KIND; resolution: string }, t: Translate = ENGLISH) => `${t(KIND[imager.kind])} · ${imager.resolution}`;
