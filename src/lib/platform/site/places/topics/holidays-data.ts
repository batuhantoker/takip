import type { Locale } from '@/lib/core/i18n/locales';
import { topicTable } from '../tables';

/**
 * data/site/topics/holidays.json, from tools/site/topics/holidays.ts: for each country whose holidays checked out,
 * what was checked and what an official list corrects. The dates themselves are worked out from date-holidays' rules
 * when a page renders (holidays-rules.ts), so any year has them.
 */

/** A holiday's name in the country's own language (`local`), and in ours where the data has it. */
export type HolidayName = { local: string } & Partial<Record<Locale, string>>;

/** One holiday in a country's year. */
export interface HolidayEntry {
  /** The first day, YYYY-MM-DD. */
  d: string;
  /** Days it lasts, where more than one. */
  n?: number;
  name: HolidayName;
  /** p: a public holiday; b: banks and offices close, but it isn't one; w: a weekend day worked in exchange (China). */
  t: 'p' | 'b' | 'w';
  /** Starts at this local time, not midnight: a half day ("13:00"). */
  from?: string;
  /** The day off for a holiday that fell on a weekend. */
  sub?: 1;
  /** Kept only in these regions (keys of the row's regions); everywhere when absent. */
  r?: string[];
  /** Dated by the Islamic calendar as calculated, which a moon sighting can move by a day. */
  isl?: 1;
}

export interface HolidayYear {
  days: HolidayEntry[];
  /** China: the State Council hasn't published the year's arrangement, so these are the statutory days alone. */
  pending?: 1;
}

/** What an official list changes in a year of the rules, per region: days it adds, and weekdays off it doesn't have. */
export interface HolidayPatch {
  add?: { region: string; d: string; name: string }[];
  drop?: { region: string; d: string }[];
}

export interface HolidayRow {
  cc: string;
  /** The most populous city's zone, for "today". */
  tz: string;
  /** The weekend's ISO weekdays, 1 Monday to 7 Sunday (CLDR). */
  weekend: number[];
  /** Region code → name, where the regional holidays checked out. */
  regions?: Record<string, string>;
  /** The country has regional holidays, but they didn't check out, so they're left out. */
  regionsLeftOut?: 1;
  /** By year: GOV.UK's corrections to the rules. */
  patches?: Record<string, HolidayPatch>;
  /** Years where the rules disagree with the official list: no page. */
  skip?: number[];
  /** Fewer national holiday days than HOLIDAY_INDEX in a checked year: pages stay unindexed. */
  thin?: 1;
  /** What the dates were checked against: an official list (named), or Nager.Date's for the meta's years. */
  checked: { official?: string; url?: string; nager?: 1 };
}

export interface HolidayMeta {
  /** date-holidays' version the rules came from. */
  rules: string;
  /** The years checked against Nager.Date, first and last. */
  checked: [number, number];
}

export const holidayTable = () => topicTable<HolidayRow, HolidayMeta>('holidays');
