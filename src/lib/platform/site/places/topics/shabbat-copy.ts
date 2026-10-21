import { msg, type Translate } from '@/lib/core/i18n/translator';
import type { Holiday, HolyDay } from './shabbat-times';

/** The Shabbat page's words: holidays and Hebrew dates. */

export const HOLIDAY_LABEL: Record<Holiday, string> = {
  'rosh-hashanah': msg('Rosh Hashanah'), 'yom-kippur': msg('Yom Kippur'), sukkot: msg('Sukkot'),
  'shemini-atzeret': msg('Shemini Atzeret'), 'simchat-torah': msg('Simchat Torah'), pesach: msg('Pesach'),
  'pesach-end': msg('Pesach, last days'), shavuot: msg('Shavuot'),
};

/** "Shabbat", "Pesach", "Pesach and Shabbat". */
export function holyDayName(h: HolyDay, t: Translate): string {
  if (!h.holiday) return t('Shabbat');
  return h.shabbat ? t('{holiday} and Shabbat', { holiday: t(HOLIDAY_LABEL[h.holiday]) }) : t(HOLIDAY_LABEL[h.holiday]);
}

/** "13 Heshvan 5787" in the reader's language, for a civil day's daytime. */
// Some locales add an era ("AM 13 Heşvan 5787"); the year alone is the Hebrew year.
export const hebrewDateIn = (date: string, t: Translate) =>
  new Intl.DateTimeFormat(t.locale === 'en' ? 'en-GB' : t.intl, { calendar: 'hebrew', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .formatToParts(Date.parse(`${date}T12:00:00Z`)).filter(p => p.type !== 'era').map(p => p.value).join('').trim().replace(/\s{2,}/g, ' ');
