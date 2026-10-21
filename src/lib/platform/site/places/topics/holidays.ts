import { msg, type Translate } from '@/lib/core/i18n/translator';
import { DESCRIPTION_RANGE, fit, listOf, nameOf, TITLE_MAX } from '../copy/format';
import type { Place } from '../place';
import type { PlaceCopy, PlaceTopic, TopicPage } from '../topic';
import { chinaYear } from './holidays-china';
import { holidayName, kindOf, longDate, plainDate } from './holidays-copy';
import { holidayTable, type HolidayRow } from './holidays-data';
import { nextHoliday, regionDaysOff, yearFacts, type DayRun, type YearFacts } from './holidays-facts';
import { holidayYear } from './holidays-rules';
import { localClock } from './sky-time';

/**
 * Public holidays at /country/<place>/public-holidays-<year>, worked out when the page renders from date-holidays'
 * rules for any of the ten years either side of the clock's, for the countries tools/site/topics/holidays.ts found
 * trustworthy. This year and the next two are indexed; the rest render unindexed and unlisted, so a link to one
 * never breaks. From October the coming year's page is the one the country's nav lists, when people start
 * searching for it.
 */

export interface HolidayData { row: HolidayRow; year: number }

export const HOLIDAY_YEARS = { back: 10, ahead: 10, indexed: 2 } as const;

export const holidaySlug = (year: number) => `public-holidays-${year}`;

/** China lists each break's days off and the weekend days worked for them, not single holidays. */
export const inBreaks = (row: HolidayRow) => row.cc === 'CN';

const NONE: YearFacts = { holidays: 0, onWeekdays: 0, substitutes: 0, halfDays: 0, regional: 0, multiDay: false, longWeekends: [], bridges: [] };
export const factsFor = ({ row, year }: HolidayData) => yearFacts(row, year) ?? NONE;

/** The country's date today, on its most populous city's clock. */
export const todayIn = (row: HolidayRow, at = Date.now()) => localClock(at, row.tz).date;

const built = new WeakMap<HolidayRow, { stamp: string; pages: TopicPage<HolidayData>[] }>();

function pagesOf(row: HolidayRow, now: Date): TopicPage<HolidayData>[] {
  const year = now.getUTCFullYear();
  const years: number[] = [];
  for (let y = year - HOLIDAY_YEARS.back; y <= year + HOLIDAY_YEARS.ahead; y++) {
    if (row.skip?.includes(y) || (inBreaks(row) && !chinaYear(y))) continue;
    years.push(y);
  }
  const indexed = (y: number) => y >= year && y <= year + HOLIDAY_YEARS.indexed && !row.thin && (!inBreaks(row) || chinaYear(y) === 'notice');
  // Next year's page only once it is worth a search result (China's waits for its notice).
  const wanted = now.getUTCMonth() >= 9 && indexed(year + 1) ? year + 1 : year;
  const listed = years.includes(wanted) ? wanted : years[0];
  return years.map(y => ({ slug: holidaySlug(y), data: { row, year: y }, index: indexed(y), ...(y !== listed && { listed: false as const }) }));
}

const runName = (run: DayRun, t: Translate) => listOf(run.names.slice(0, 2).map(n => holidayName(n, t)), t);

/** The page's first sentence on this year's page: the next holiday from today. */
function nextLine(place: Place, row: HolidayRow, t: Translate): string | null {
  const next = nextHoliday(row, todayIn(row));
  if (!next) return null;
  const vars = { country: nameOf(place, t), kind: kindOf(row.cc), name: holidayName(next.entry.name, t), date: longDate(next.entry.d, t), n: next.days, time: next.entry.from ?? '' };
  if (next.entry.from) {
    return next.days === 0
      ? t('Today is {name} in {country}, a half day: off from {time}.', vars)
      : t('The next {kind, select, bank {bank holiday} federal {federal holiday} other {public holiday}} in {country} is {name}, a half day from {time}, on {date}, {n, plural, one {tomorrow} other {in # days}}.', vars);
  }
  return next.days === 0
    ? t('Today is {name}, a {kind, select, bank {bank holiday} federal {federal holiday} other {public holiday}} in {country}.', vars)
    : t('The next {kind, select, bank {bank holiday} federal {federal holiday} other {public holiday}} in {country} is {name} on {date}, {n, plural, one {tomorrow} other {in # days}}.', vars);
}

function breaksCopy(place: Place, data: HolidayData, t: Translate, current: boolean): PlaceCopy {
  const { row, year } = data;
  const f = factsFor(data);
  const days = holidayYear(row, year)?.days ?? [];
  const country = (t: Translate) => nameOf(place, t);
  const heading = t('Public holidays in {country} in {year}', { country: country(t), year: String(year) });
  if (chinaYear(year) === 'pending') {
    const vars = (t: Translate) => ({ country: country(t), year: String(year), days: f.holidays });
    return {
      title: fit([t => t('{country} public holidays {year}: statutory dates', vars(t)), t => t('{country} public holidays {year}', vars(t))], t, TITLE_MAX),
      description: fit([
        t => t('{country}’s {days} statutory holiday days in {year}, dated by the lunar calendar. The State Council hadn’t yet published its {year} schedule of days off.', vars(t)),
        t => t('{country}’s {days} statutory holiday days in {year}, before the State Council publishes the schedule of days off and make-up working days.', vars(t)),
      ], t, DESCRIPTION_RANGE[1], DESCRIPTION_RANGE[0]),
      heading,
      lede: t('{country} has {days} statutory holiday days in {year}, dated by the lunar calendar. The State Council sets the days off around them, and the weekend days worked in exchange, in a notice late in the year before; the {year} notice isn’t in this table yet.', vars(t)),
    };
  }
  const breaks = days.filter(e => e.t === 'p');
  const longest = breaks.reduce((a, b) => ((b.n ?? 1) > (a.n ?? 1) ? b : a), breaks[0]);
  const vars = (t: Translate) => ({
    country: country(t), year: String(year), breaks: breaks.length, days: f.holidays, work: days.filter(e => e.t === 'w').length,
    longest: longest ? holidayName(longest.name, t) : '', length: longest?.n ?? 1,
  });
  const next = current ? nextLine(place, row, t) : null;
  return {
    title: fit([
      t => t('{country} public holidays {year}: days off and make-up workdays', vars(t)),
      t => t('{country} public holidays {year}: days off', vars(t)),
      t => t('{country} public holidays {year}', vars(t)),
    ], t, TITLE_MAX),
    description: fit([
      t => t('{country}’s {year} holiday schedule from the State Council: {breaks} breaks with {days} days off, the longest {longest} for {length} days, and {work} make-up working days.', vars(t)),
      t => t('{country}’s {year} holidays: {breaks} breaks, {days} days off and {work} make-up working days, as the State Council set them, with every date and weekday.', vars(t)),
    ], t, DESCRIPTION_RANGE[1], DESCRIPTION_RANGE[0]),
    heading,
    lede: [
      ...(next ? [next] : []),
      t('{country} has {breaks} holiday breaks in {year} with {days} days off in all, weekends included, and {work, plural, one {one weekend day} other {# weekend days}} worked in exchange, as the State Council set them.', vars(t)),
    ].join(' '),
  };
}

function yearCopy(place: Place, data: HolidayData, t: Translate): PlaceCopy {
  const { row, year } = data;
  const thisYear = Number(todayIn(row).slice(0, 4));
  if (inBreaks(row)) return breaksCopy(place, data, t, year === thisYear);
  const f = factsFor(data);
  const kind = kindOf(row.cc);
  // Where every long weekend is three days, none is the longest.
  const longest = f.longest && f.longest.days > 3 ? f.longest : undefined;
  const vars = (t: Translate) => ({
    country: nameOf(place, t), year: String(year), kind, days: f.holidays, weekdays: f.onWeekdays, weekends: f.longWeekends.length,
    regional: f.regional, tense: year < thisYear ? 'past' : 'other',
    count: f.multiDay
      ? t('{days, plural, one {# day} other {# days}} of {kind, select, bank {bank holidays} federal {federal holidays} other {public holidays}}', { days: f.holidays, kind })
      : t('{days, plural, one {# {kind, select, bank {bank holiday} federal {federal holiday} other {public holiday}}} other {# {kind, select, bank {bank holidays} federal {federal holidays} other {public holidays}}}}', { days: f.holidays, kind }),
    ...(row.cc === 'GB' && { ew: regionDaysOff(row, year, 'ENG'), sct: regionDaysOff(row, year, 'SCT'), nir: regionDaysOff(row, year, 'NIR') }),
    ...(longest && { longest: runName(longest, t), length: longest.days, from: plainDate(longest.from, t) }),
  });
  const next = year === thisYear ? nextLine(place, row, t) : null;
  return {
    title: fit([
      t => t('{country} {kind, select, bank {bank holidays} federal {federal holidays} other {public holidays}} {year}: dates and long weekends', vars(t)),
      t => t('{country} {kind, select, bank {bank holidays} federal {federal holidays} other {public holidays}} {year}: every date', vars(t)),
      t => t('{country} {kind, select, bank {bank holidays} federal {federal holidays} other {public holidays}} {year}', vars(t)),
    ], t, TITLE_MAX),
    description: row.cc === 'GB'
      ? fit([
        t => t('{ew} bank holidays in England and Wales in {year}, {sct} in Scotland and {nir} in Northern Ireland, with the substitute days, long weekends and every date.', vars(t)),
        t => t('UK bank holidays in {year}: {ew} in England and Wales, {sct} in Scotland and {nir} in Northern Ireland, with every date and weekday.', vars(t)),
      ], t, DESCRIPTION_RANGE[1], DESCRIPTION_RANGE[0])
      : fit([
        ...(longest && f.regional ? [
          (t: Translate) => t('{count} across {country} in {year}, {weekdays} on weekdays, and {regional} more in some regions. The longest break: {longest}, {length} days from {from}.', vars(t)),
        ] : []),
        ...(longest ? [
          (t: Translate) => t('{count} in {country} in {year}, {weekdays} of them on weekdays, and {weekends, plural, one {one long weekend} other {# long weekends}}; the longest is {longest}, {length} days from {from}.', vars(t)),
          (t: Translate) => t('{count} in {country} in {year}, {weekdays} on weekdays; the longest break is {longest}, {length} days from {from}.', vars(t)),
        ] : []),
        ...(f.longWeekends.length ? [
          (t: Translate) => t('{count} in {country} in {year}, {weekdays} of them on weekdays, making {weekends, plural, one {one three-day weekend} other {# three-day weekends}}, with every date and weekday.', vars(t)),
        ] : []),
        t => t('{count} in {country} in {year}, {weekdays} of them on weekdays, with every date and weekday, the long weekends and the bridge days.', vars(t)),
        t => t('Every one of {country}’s {kind, select, bank {bank holidays} federal {federal holidays} other {public holidays}} in {year}, with its date and weekday, {weekdays} of them on weekdays, and the long weekends they make.', vars(t)),
      ], t, DESCRIPTION_RANGE[1], DESCRIPTION_RANGE[0]),
    heading: t('{kind, select, bank {Bank holidays} federal {Federal holidays} other {Public holidays}} in {country} in {year}', vars(t)),
    lede: [
      ...(next ? [next] : []),
      row.cc === 'GB'
        ? t('England and Wales {tense, select, past {had} other {have}} {ew} bank holidays in {year}, Scotland {sct} and Northern Ireland {nir}, counting the substitute days for those that fall on a weekend.', vars(t))
        : t('{country} {tense, select, past {had} other {has}} {count} in {year}; {weekdays, plural, =0 {none falls on a weekday} one {one falls on a weekday} other {# fall on weekdays}}.', vars(t)),
      ...(f.substitutes && row.cc !== 'GB' ? [t('{n, plural, one {One more weekday is a day off} other {# more weekdays are days off}} in place of holidays that fall on a weekend.', { n: f.substitutes })] : []),
      ...(f.halfDays ? [t('{n, plural, one {One working day is a half day} other {# working days are half days}}.', { n: f.halfDays })] : []),
      ...(f.regional && row.cc !== 'GB' ? [t('{n, plural, one {One more holiday is kept} other {# more holidays are kept}} only in some regions.', { n: f.regional })] : []),
    ].join(' '),
  };
}

export const HOLIDAYS: PlaceTopic<HolidayData> = {
  id: 'holidays',
  label: msg('Public holidays'),
  inline: msg('public holidays'),
  kinds: ['country'],
  openLabel: msg('Open the map'),

  pages(place) {
    const row = holidayTable().rows[String(place.id)];
    if (!row) return [];
    const now = new Date();
    const stamp = `${now.getUTCFullYear()}-${now.getUTCMonth()}`;
    const held = built.get(row);
    if (held?.stamp === stamp) return held.pages;
    const pages = pagesOf(row, now);
    built.set(row, { stamp, pages });
    return pages;
  },

  header: (place, { data }, t) => yearCopy(place, data, t),

  summary(_place, { data }, t) {
    const { row, year } = data;
    if (inBreaks(row)) {
      return chinaYear(year) === 'pending'
        ? t('The statutory holiday days of {year}, before the State Council sets the days off.', { year: String(year) })
        : t('Every break in {year}, its days off and the weekend days worked in exchange.', { year: String(year) });
    }
    const f = factsFor(data);
    return t('{days, plural, one {# day} other {# days}} of {kind, select, bank {bank holidays} federal {federal holidays} other {public holidays}} in {year}, {weekdays} on weekdays, with the long weekends they make.', {
      kind: kindOf(row.cc), days: f.holidays, weekdays: f.onWeekdays, year: String(year),
    });
  },

  open: () => ({ zoom: 4 }),
};

export type HolidayPage = TopicPage<HolidayData>;
