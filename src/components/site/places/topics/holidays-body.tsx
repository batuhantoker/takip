import { CalendarDays } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Section, TEXT_LINK } from '@/components/site/pages/site-frame';
import { msg, type Translate } from '@/lib/core/i18n/translator';
import { localePath } from '@/lib/platform/site/locale-path';
import { crawlRel } from '@/lib/platform/site/meta';
import { listOf, nameOf } from '@/lib/platform/site/places/copy/format';
import { placeIndexed } from '@/lib/platform/site/places/pages';
import { placePath } from '@/lib/platform/site/places/paths';
import type { Place } from '@/lib/platform/site/places/place';
import { factsFor, HOLIDAYS, holidaySlug, inBreaks, todayIn, type HolidayData } from '@/lib/platform/site/places/topics/holidays';
import { chinaYear } from '@/lib/platform/site/places/topics/holidays-china';
import { entrySpan, holidayName, kindOf, localName, regionNames, shortDate, shortSpan, weekendNames } from '@/lib/platform/site/places/topics/holidays-copy';
import { holidayTable, type HolidayEntry, type HolidayRow, type HolidayYear } from '@/lib/platform/site/places/topics/holidays-data';
import type { DayRun } from '@/lib/platform/site/places/topics/holidays-facts';
import { holidayYear, isoDay } from '@/lib/platform/site/places/topics/holidays-rules';
import { Notes } from '../parts/notes';
import { HolidayCalendar } from './parts/holiday-calendar';
import type { TopicView } from './view';

const thisYearOf = (row: HolidayRow) => Number(todayIn(row).slice(0, 4));
const yearHref = (place: Place, year: number, t: Translate) => localePath(t.locale, placePath(place, holidaySlug(year)));
const yearRel = (place: Place, year: number) => crawlRel(placeIndexed(place, holidaySlug(year)));
const hasYear = (place: Place, year: number) => HOLIDAYS.pages(place).some(p => p.data.year === year);

/** The neighbouring years; on this year's page the next one says so. */
function YearNav({ place, row, year, t }: { place: Place; row: HolidayRow; year: number; t: Translate }) {
  const current = year === thisYearOf(row);
  return (
    <nav aria-label={t('Other years')} className="mb-10 flex flex-wrap justify-between gap-3 text-[14px]">
      {hasYear(place, year - 1) ? <Link href={yearHref(place, year - 1, t)} rel={yearRel(place, year - 1)} className={TEXT_LINK}>← {String(year - 1)}</Link> : <span />}
      {hasYear(place, year + 1) && (
        <Link href={yearHref(place, year + 1, t)} rel={yearRel(place, year + 1)} className={TEXT_LINK}>{current ? t('Next year ({year})', { year: String(year + 1) }) : String(year + 1)} →</Link>
      )}
    </nav>
  );
}

const runNames = (run: DayRun, t: Translate) => listOf(run.names.map(n => holidayName(n, t)), t);

function LongWeekends({ place, row, data, year, t }: { place: Place; row: HolidayRow; data: HolidayData; year: number; t: Translate }) {
  const f = factsFor(data);
  const country = nameOf(place, t);
  return (
    <Section title={t('Long weekends and bridge days in {year}', { year: String(year) })}>
      {f.longWeekends.length ? (
        <ul className="divide-y divide-line border-y border-line">
          {f.longWeekends.map(r => (
            <li key={r.from} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5 text-[14px]">
              <span className="font-medium text-ink-1">{shortSpan(r.from, r.to, t)}</span>
              <span className="text-ink-2">{t('{n} days off', { n: r.days })} · {runNames(r, t)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[15px] text-ink-2">{t('No holiday that applies everywhere joins a weekend in {year}.', { year: String(year) })}</p>
      )}
      {f.bridges.length > 0 && (
        <ul className="mt-5 flex flex-col gap-2 text-[14px] leading-relaxed text-ink-2">
          {f.bridges.map(b => (
            <li key={b.day}>
              {(b.half
                ? t('Bridge day: {day} is a half day; with the morning off, {span} is {n} days off in a row ({names}).', { day: shortDate(b.day, t), span: shortSpan(b.run.from, b.run.to, t), n: b.run.days, names: runNames(b.run, t) })
                : t('Bridge day: take {day} off, and {span} is {n} days off in a row ({names}).', { day: shortDate(b.day, t), span: shortSpan(b.run.from, b.run.to, t), n: b.run.days, names: runNames(b.run, t) }))}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-[13px] text-ink-3">
        {t('Counted with the weekend in {country} ({weekend}) and the holidays that apply everywhere: a long weekend is three or more days off in a row, and a bridge day is a single working day between a holiday and a weekend or another holiday.', {
          country, weekend: weekendNames(row, t),
        })}
      </p>
    </Section>
  );
}

function typeOf(row: HolidayRow, e: HolidayEntry, t: Translate): string {
  if (e.t === 'w') return t('Working day');
  if (e.t === 'b') return e.from ? t('Banks and offices close at {time}', { time: e.from }) : t('Banks and offices closed');
  if (e.from) return t('Half day, from {time}', { time: e.from });
  if (inBreaks(row)) return t('Days off');
  return t('{kind, select, bank {Bank holiday} federal {Federal holiday} other {Public holiday}}', { kind: kindOf(row.cc) });
}

function DatesTable({ row, days, t }: { row: HolidayRow; days: HolidayEntry[]; t: Translate }) {
  const regional = days.some(e => e.r);
  const weekend = new Set(row.weekend);
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface-1">
      <table className="w-full text-[14px]">
        <thead className="bg-surface-2 text-[13px] text-ink-3">
          <tr>
            <th scope="col" className="px-4 py-2 text-left font-medium">{t('Date')}</th>
            <th scope="col" className="px-4 py-2 text-left font-medium">{t('Holiday')}</th>
            {/* Their own keys: "Type" and "Where" elsewhere mean a typeface and a map position. */}
            <th scope="col" className="px-4 py-2 text-left font-medium">{t('holidays|Type')}</th>
            {regional && <th scope="col" className="px-4 py-2 text-left font-medium">{t('holidays|Where')}</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {days.map(e => {
            const name = holidayName(e.name, t);
            const local = localName(e.name, t);
            const onWeekend = !e.n && e.t === 'p' && weekend.has(isoDay(e.d));
            return (
              <tr key={`${e.d}|${e.name.local}|${e.t}|${(e.r ?? []).join()}`} className={e.t === 'p' ? '' : 'text-ink-2'}>
                <td className="px-4 py-2 align-top whitespace-nowrap text-ink-1">
                  {entrySpan(e, t)}
                  {e.n && <span className="block text-[12px] text-ink-3">{t('{n} days', { n: e.n })}</span>}
                  {onWeekend && <span className="block text-[12px] text-ink-3">{t('on a weekend')}</span>}
                </td>
                <td className="px-4 py-2 align-top">
                  <span className="text-ink-1">{e.sub ? t('{name} (substitute day)', { name }) : name}</span>
                  {local && <span className="block text-[12px] text-ink-3">{local}</span>}
                </td>
                <td className="px-4 py-2 align-top text-ink-2">{typeOf(row, e, t)}</td>
                {regional && <td className="px-4 py-2 align-top text-ink-2">{e.r ? listOf(regionNames(row, e), t) : t('Nationwide')}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function notes(place: Place, row: HolidayRow, year: number, data: HolidayYear, t: Translate): ReactNode[] {
  const { meta } = holidayTable();
  const country = nameOf(place, t);
  const days = data.days;
  const checked = row.checked;
  const china = inBreaks(row) && chinaYear(year);
  const version = meta?.rules ?? '';
  let source: ReactNode;
  if (china === 'notice') source = t('Days off and the weekend days worked in exchange as the State Council’s notice for {year} sets them.', { year: String(year) });
  else if (china === 'pending') source = t('The statutory days of the 2024 holiday regulation, dated by the lunar calendar with the date-holidays rules, version {version}.', { version });
  else if (checked.official && checked.url) {
    source = t.parts(msg('Dates worked out from the date-holidays rules, version {version}, and checked against the official list from {source}.'), {
      version, source: <a key="s" href={checked.url} className={TEXT_LINK} rel="noopener">{checked.official}</a>,
    }) as ReactNode[];
  } else {
    source = t('Dates worked out from the date-holidays rules, version {version}, and checked day by day against Nager.Date’s for {from} to {to}.', {
      version, from: String(meta?.checked[0] ?? ''), to: String(meta?.checked[1] ?? ''),
    });
  }
  const outside = meta && !checked.official && (year < meta.checked[0] || year > meta.checked[1]);
  return [
    <>{source}</>,
    ...(outside ? [t('{year} wasn’t among the years checked; its dates follow the same rules.', { year: String(year) })] : []),
    ...(inBreaks(row) ? [t('The State Council publishes each year’s days off, and the weekend days worked in exchange, in a notice late in the year before.')] : []),
    ...(days.some(e => e.sub) ? [t('Where a holiday falls on a weekend and the law gives the day off on another day, that day is listed as a substitute day.')] : []),
    ...(days.some(e => e.isl) ? [row.cc === 'TR'
      ? t('Diyanet sets the bayram dates in advance by calculation, so they don’t wait for a sighting of the new moon.')
      : t('Holidays dated by the Islamic calendar are worked out in advance; where the authorities wait to sight the new moon, they can fall a day later.')] : []),
    ...(days.some(e => e.t === 'p' && e.from) ? [t('A half day starts at the time shown; the morning is a working day.')] : []),
    ...(days.some(e => e.t === 'b') ? [t('Days marked “banks and offices closed” aren’t public holidays, but banks and many offices close.')] : []),
    ...(row.regionsLeftOut ? [t('Holidays kept only in some regions of {country} aren’t listed here: date-holidays and Nager.Date disagree on where they apply.', { country })] : []),
    ...(row.cc === 'US' ? [t('Federal holidays are the days off for federal employees; each state, and each employer, sets its own.')] : []),
    t('A holiday declared at short notice, for an event or an election, may be missing.'),
  ];
}

export const HOLIDAYS_VIEW: TopicView<HolidayData> = {
  icon: CalendarDays,

  Hero({ text: { t }, page: { data } }) {
    const year = holidayYear(data.row, data.year);
    return year ? <HolidayCalendar row={data.row} year={data.year} data={year} today={todayIn(data.row)} t={t} /> : null;
  },

  Body({ text, place, page: { data } }) {
    const { t } = text;
    const { row, year } = data;
    const days = holidayYear(row, year);
    if (!days) return null;
    const pending = inBreaks(row) && chinaYear(year) === 'pending';
    return (
      <>
        <YearNav place={place} row={row} year={year} t={t} />
        {!pending && <LongWeekends place={place} row={row} data={data} year={year} t={t} />}
        <Section title={t('All {kind, select, bank {bank holidays} federal {federal holidays} other {public holidays}} in {country} in {year}', {
          kind: kindOf(row.cc), country: nameOf(place, t), year: String(year),
        })}>
          <DatesTable row={row} days={days.days} t={t} />
        </Section>
        <Notes text={text} notes={notes(place, row, year, days, t)} layers={[]} />
      </>
    );
  },

  Aside({ text: { t }, place, page: { data } }) {
    const now = thisYearOf(data.row);
    const years = [now - 1, now, now + 1, now + 2].filter(y => hasYear(place, y));
    return (
      <section>
        <h2 className="text-[15px] font-semibold text-ink-1">{t('Other years')}</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {years.map(y => (
            <li key={y}>
              {y === data.year
                ? <span aria-current="page" className="inline-flex h-8 items-center rounded-control border border-line-strong bg-surface-3 px-2.5 text-[13px] text-ink-1">{String(y)}</span>
                : <Link href={yearHref(place, y, t)} rel={yearRel(place, y)} className="inline-flex h-8 items-center rounded-control border border-line bg-surface-1 px-2.5 text-[13px] text-ink-2 hover:text-ink-1">{String(y)}</Link>}
            </li>
          ))}
        </ul>
      </section>
    );
  },
};
