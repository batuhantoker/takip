import HolidaysPkg from 'date-holidays';
import { LOCALES, type Locale } from '@/lib/core/i18n/locales';
import { chinaDays } from './holidays-china';
import type { HolidayEntry, HolidayName, HolidayPatch, HolidayRow, HolidayYear } from './holidays-data';

/**
 * A country's holidays for any year, from date-holidays' rules (ISC; data CC BY 3.0), the way the pages show them:
 * what applies everywhere, what only some regions keep, and an official list's corrections from the table. Shared
 * with the builder that checks them (tools/site/topics/holidays.ts).
 */

// The package's ESM build exports the class as default; under some loaders it arrives wrapped.
const Holidays = ((HolidaysPkg as unknown as { default?: typeof HolidaysPkg }).default ?? HolidaysPkg) as typeof HolidaysPkg;
type Calendar = InstanceType<typeof Holidays>;
type DhHoliday = { date: string; name: string; type: string; rule: string; substitute?: boolean; note?: string };

const DAY = 86_400_000;
export const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * DAY).toISOString().slice(0, 10);
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / DAY);
/** 1 Monday to 7 Sunday. */
export const isoDay = (d: string) => new Date(`${d}T12:00:00Z`).getUTCDay() || 7;
export const lastDay = (e: HolidayEntry) => addDays(e.d, (e.n ?? 1) - 1);

// Our locales in date-holidays' codes: it writes Japanese as "jp".
const DH_LANG: Record<Locale, string> = { en: 'en', tr: 'tr', es: 'es', pt: 'pt', fr: 'fr', de: 'de', ru: 'ru', ar: 'ar', zh: 'zh', ja: 'jp' };
const ISLAMIC = /\b(Muharram|Safar|Rabi|Jumada|Rajab|Shaban|Ramadan|Shawwal|Dhu)/;
/** date-holidays' plain GB is England's list; the UK's own holidays are those all four nations keep. Alderney isn't the UK. */
export const GB_NATIONS = ['ENG', 'WLS', 'SCT', 'NIR'];

const calendars = new Map<string, Calendar>();
function calendar(cc: string, state?: string): Calendar {
  const key = `${cc}/${state ?? ''}`;
  let c = calendars.get(key);
  if (!c) calendars.set(key, (c = state ? new Holidays(cc, state) : new Holidays(cc)));
  return c;
}

/** Every country date-holidays has rules for, by ISO code. */
export const ruleCountries = () => Object.keys(new Holidays().getCountries());

/** The regions date-holidays has rules for, by code, in the country's language. */
export function stateNames(cc: string): Record<string, string> {
  const all = (new Holidays().getStates(cc) ?? {}) as Record<string, string>;
  return cc === 'GB' ? Object.fromEntries(GB_NATIONS.map(s => [s, all[s] ?? s])) : cc === 'CN' ? {} : all;
}

/** One calendar's holidays and bank closures for a year, named in the country's language and each of ours the data has. */
export function holidaysOf(cc: string, state: string | undefined, year: number): HolidayEntry[] {
  const hd = calendar(cc, state);
  // Most specific first: "de-at", "de", then "en".
  const langs = hd.getLanguages();
  // getHolidays(year, lang) falls back to another language where one is missing; the rule keeps only real names.
  const rules = (hd as unknown as { holidays: Record<string, { name?: string | Record<string, string> }> }).holidays;
  const out: HolidayEntry[] = [];
  for (const h of hd.getHolidays(year) as DhHoliday[]) {
    if (h.type !== 'public' && h.type !== 'bank') continue;
    // Holidays for one group (China's half day for women) aren't the country's.
    if (h.note) continue;
    const all = rules[h.rule]?.name;
    const names = typeof all === 'object' ? all : {};
    const name: HolidayName = { local: langs.map(l => names[l]).find(Boolean) ?? h.name };
    // The country's own variant first: "Labor Day" (en-us) in the US, not "Labour Day".
    for (const l of LOCALES) {
      const v = langs.filter(x => x.split('-')[0] === DH_LANG[l]).map(x => names[x]).find(Boolean) ?? names[DH_LANG[l]];
      if (v) name[l] = v;
    }
    const days = /P(\d+)D/.exec(h.rule);
    const time = h.date.slice(11, 16);
    out.push({
      d: h.date.slice(0, 10), ...(days && Number(days[1]) > 1 && { n: Number(days[1]) }), t: h.type === 'public' ? 'p' : 'b', name,
      ...(time && time !== '00:00' && { from: time }), ...(h.substitute && { sub: 1 as const }), ...(ISLAMIC.test(h.rule) && { isl: 1 as const }),
    });
  }
  return cc === 'TR' ? turkish(out) : out;
}

/** Kanun 2429: Ramazan Bayramı three and a half days, Kurban Bayramı four and a half, each from 13:00 on the eve (arife), and 29 Ekim from 13:00 on the 28th. */
function turkish(list: HolidayEntry[]): HolidayEntry[] {
  const eve = (e: HolidayEntry, local: string, en: string): HolidayEntry => ({ d: addDays(e.d, -1), t: 'p', from: '13:00', name: { local, tr: local, en }, ...(e.isl && { isl: 1 }) });
  return list.flatMap(e => {
    if (/^Ramazan Bayram/.test(e.name.local)) return [eve(e, 'Ramazan Bayramı Arifesi', 'Eid al-Fitr eve'), { ...e, n: 3 }];
    if (/^Kurban Bayram/.test(e.name.local)) return [eve(e, 'Kurban Bayramı Arifesi', 'Eid al-Adha eve'), { ...e, n: 4 }];
    if (/^Cumhuriyet Bayram/.test(e.name.local)) return [eve(e, 'Cumhuriyet Bayramı Arifesi', 'Republic Day eve'), e];
    return [e];
  }).sort((a, b) => a.d.localeCompare(b.d));
}

const keyOf = (e: HolidayEntry) => `${e.d}|${e.n ?? 1}|${e.t}|${e.from ?? ''}|${e.name.local}`;

/** An official list's corrections to one region's year. */
function patched(list: HolidayEntry[], region: string, patch?: HolidayPatch): HolidayEntry[] {
  if (!patch) return list;
  const drop = new Set(patch.drop?.filter(p => p.region === region).map(p => p.d));
  const add = (patch.add ?? []).filter(p => p.region === region).map((p): HolidayEntry => ({ d: p.d, t: 'p', name: { local: p.name, en: p.name } }));
  return [...list.filter(e => !(e.t === 'p' && !e.from && !e.n && drop.has(e.d))), ...add].sort((a, b) => a.d.localeCompare(b.d));
}

export interface BuiltYear { national: HolidayEntry[]; regional: { e: HolidayEntry; regions: Set<string> }[] }

/** A country's year from the rules: what applies everywhere, and what only some regions keep. */
export function buildYear(cc: string, year: number, patch?: HolidayPatch): BuiltYear {
  const states = Object.keys(stateNames(cc));
  const perState = new Map(states.map(s => [s, patched(holidaysOf(cc, s, year), s, patch)]));
  const national = cc === 'GB'
    ? perState.get(states[0])!.filter(e => states.every(s => perState.get(s)!.some(x => keyOf(x) === keyOf(e))))
    : holidaysOf(cc, undefined, year);
  const nationalKeys = new Set(national.map(keyOf));
  const regional = new Map<string, { e: HolidayEntry; regions: Set<string> }>();
  for (const [s, list] of perState) {
    for (const e of list) {
      const k = keyOf(e);
      if (nationalKeys.has(k)) continue;
      const held = regional.get(k) ?? { e, regions: new Set<string>() };
      held.regions.add(s);
      regional.set(k, held);
    }
  }
  return { national, regional: [...regional.values()] };
}

/** China's lunar festivals' first days, from the rules: 除夕 starts 春节. */
function lunarOf(year: number) {
  const list = holidaysOf('CN', undefined, year).filter(e => e.t === 'p');
  const first = (zh: string) => list.filter(e => e.name.local.startsWith(zh)).map(e => e.d).sort()[0];
  return { 春节: first('春节'), 清明: first('清明'), 端午: first('端午'), 中秋: first('中秋') };
}

// Years are worked out on demand and kept per row, which a rebuilt table replaces.
const memo = new WeakMap<HolidayRow, Map<number, HolidayYear | null>>();

/** A country's year as its page shows it, or null where it has none. */
export function holidayYear(row: HolidayRow, year: number): HolidayYear | null {
  let years = memo.get(row);
  if (!years) memo.set(row, (years = new Map()));
  if (years.has(year)) return years.get(year)!;
  let out: HolidayYear | null;
  if (row.skip?.includes(year)) out = null;
  else if (row.cc === 'CN') out = chinaDays(year, () => lunarOf(year));
  else {
    const b = buildYear(row.cc, year, row.patches?.[year]);
    const days = [...b.national, ...(row.regions ? b.regional.map(({ e, regions }) => ({ ...e, r: [...regions].sort() })) : [])]
      .filter(e => e.d.startsWith(String(year)))
      .sort((a, b) => a.d.localeCompare(b.d) || (a.r ? 1 : 0) - (b.r ? 1 : 0));
    out = days.length ? { days } : null;
  }
  years.set(year, out);
  return out;
}
