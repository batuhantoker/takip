import type { Translate } from '@/lib/core/i18n/translator';
import { listOf } from '../copy/format';
import type { HolidayEntry, HolidayName, HolidayRow } from './holidays-data';
import { lastDay } from './holidays-rules';

/** What people in the country call them, and search for: "bank holidays" in the UK and Ireland, "federal holidays" in the US. */
export type HolidayKind = 'bank' | 'federal' | 'public';
export const kindOf = (cc: string): HolidayKind => (cc === 'GB' || cc === 'IE' ? 'bank' : cc === 'US' ? 'federal' : 'public');

// English dates read "Friday 25 December", as the rest of the site's.
const intlOf = (t: Translate) => (t.locale === 'en' ? 'en-GB' : t.intl);
const formats = new Map<string, Intl.DateTimeFormat>();
function format(t: Translate, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${t.intl}|${JSON.stringify(opts)}`;
  let f = formats.get(key);
  if (!f) formats.set(key, (f = new Intl.DateTimeFormat(intlOf(t), { ...opts, timeZone: 'UTC' })));
  return f;
}
const at = (d: string) => Date.parse(`${d}T12:00:00Z`);

const SHORT: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' };
const LONG: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
const PLAIN: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' };

/** "Fri 26 Mar". */
export const shortDate = (d: string, t: Translate) => format(t, SHORT).format(at(d));
/** "Friday 26 March 2027". */
export const longDate = (d: string, t: Translate) => format(t, LONG).format(at(d));
/** "26 March". */
export const plainDate = (d: string, t: Translate) => format(t, PLAIN).format(at(d));
/** "Fri 26 – Mon 29 Mar", or one day. */
export const shortSpan = (from: string, to: string, t: Translate) => (from === to ? shortDate(from, t) : format(t, SHORT).formatRange(at(from), at(to)));
/** "26–29 March". */
export const plainSpan = (from: string, to: string, t: Translate) => (from === to ? plainDate(from, t) : format(t, PLAIN).formatRange(at(from), at(to)));
export const entrySpan = (e: HolidayEntry, t: Translate) => shortSpan(e.d, lastDay(e), t);

/** The holiday's name in the reader's language where the data has it, else English, else the country's own. */
export const holidayName = (n: HolidayName, t: Translate): string => n[t.locale] ?? n.en ?? n.local;

/** The country's own name for it, where that isn't what the reader already sees. */
export const localName = (n: HolidayName, t: Translate): string | null => (n.local !== holidayName(n, t) ? n.local : null);

/** "Saturday and Sunday", from the country's weekend. */
export function weekendNames(row: HolidayRow, t: Translate): string {
  const day = format(t, { weekday: 'long' });
  // 2024-01-01 was a Monday.
  return listOf(row.weekend.map(i => day.format(at(`2024-01-0${i}`))), t);
}

export const regionNames = (row: HolidayRow, e: HolidayEntry) => (e.r ?? []).map(r => row.regions?.[r] ?? r);
