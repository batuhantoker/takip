import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import AdSlot from '@/components/shell/ads/ad-slot';
import { OtherDates } from '@/components/site/dates/other-dates';
import { Section, SiteFrame, TEXT_LINK } from '@/components/site/pages/site-frame';
import { requestLocale } from '@/lib/core/i18n/request';
import type { Translate } from '@/lib/core/i18n/translator';
import { AD_SLOTS } from '@/lib/platform/ads';
import { breadcrumbs, jsonLd } from '@/lib/platform/site/json-ld';
import { localePath } from '@/lib/platform/site/locale-path';
import { crawlRel, readingImage, readingMetadata } from '@/lib/platform/site/meta';
import { configuredOrigin, publicOrigin } from '@/lib/platform/site/origin';
import { DESCRIPTION_RANGE, fit, nameOf, TITLE_MAX } from '@/lib/platform/site/places/copy/format';
import { placeBySlug } from '@/lib/platform/site/places/gazetteer';
import { findPlacePage, placeIndexed } from '@/lib/platform/site/places/pages';
import { KIND_LABEL, placePath } from '@/lib/platform/site/places/paths';
import { dayMonth, fullDay, shortDate } from '@/lib/platform/site/places/topics/prayer-copy';
import { ramadanLabel } from '@/lib/platform/site/places/topics/ramadan';
import { nearestRamadan, ramadanYears } from '@/lib/platform/site/places/topics/ramadan-calendar';
import { ramadanDates, SPAN, type RamadanDates, type RamadanFacts } from '@/lib/platform/site/ramadan-dates';
import { siteText } from '@/lib/platform/site/text';

const PATH = '/ramadan';

/** Large Muslim populations and diasporas, whose timetables the page links. */
const CITIES = ['makkah', 'madinah', 'istanbul', 'cairo', 'jakarta', 'karachi', 'lahore', 'dhaka', 'tehran', 'riyadh', 'dubai', 'kuala-lumpur', 'london', 'paris', 'berlin', 'new-york-city'];

const label = (r: RamadanFacts, t: Translate) => ramadanLabel(r, t);

function answer(r: RamadanFacts, day: number | null, t: Translate): string {
  return day !== null
    ? t('Ramadan {year} is under way: today is day {day}. It ends on {end}, and Eid al-Fitr is on {eid}.', { year: label(r, t), day, end: fullDay(r.end, t), eid: fullDay(r.eid, t) })
    : t('Ramadan {year} begins on {start} and ends on {end}; Eid al-Fitr is on {eid}.', { year: label(r, t), start: fullDay(r.start, t), end: fullDay(r.end, t), eid: fullDay(r.eid, t) });
}

export async function ramadanDatesMetadata(): Promise<Metadata> {
  const { t, locale } = await siteText((await requestLocale()).locale);
  const d = ramadanDates();
  const r = d.nearest;
  const vars = (t: Translate) => ({ year: label(r, t), start: dayMonth(r.start, t), end: dayMonth(r.end, t), eid: dayMonth(r.eid, t), from: String(d.thisYear - SPAN), to: String(d.thisYear + SPAN) });
  return readingMetadata({
    locale, path: PATH, image: readingImage('ramadan', locale),
    title: fit([
      t => t('Ramadan {year} dates: start, end and Eid', vars(t)),
      t => t('Ramadan {year} dates', vars(t)),
    ], t, TITLE_MAX),
    description: fit([
      t => t('Ramadan {year} begins on {start} and ends on {end}, with Eid al-Fitr on {eid}. Dates for every Ramadan from {from} to {to}, with Laylat al-Qadr and Eid al-Adha.', vars(t)),
      t => t('Ramadan {year} begins on {start} and ends on {end}; Eid al-Fitr is {eid}. Every Ramadan from {from} to {to}, with Laylat al-Qadr and Eid al-Adha.', vars(t)),
      t => t('Ramadan {year} begins on {start} and ends on {end}, with Eid al-Fitr on {eid}. Dates for every Ramadan from {from} to {to}.', vars(t)),
    ], t, DESCRIPTION_RANGE[1], DESCRIPTION_RANGE[0]),
  });
}

function Facts({ r, d, t }: { r: RamadanFacts; d: RamadanDates; t: Translate }) {
  const days = Math.round((Date.parse(r.start) - Date.parse(d.today)) / 86_400_000);
  const status = r.hijriYear === d.nearest.hijriYear && d.day !== null
    ? t('Under way: today is day {day} of {days}.', { day: d.day, days: r.days })
    : days > 0 ? t('Begins in {n} days.', { n: days }) : null;
  const rows: [string, string][] = [
    [t('First fast'), fullDay(r.start, t)],
    [t('Last fast'), fullDay(r.end, t)],
    [t('Days of fasting'), String(r.days)],
    [t('First tarawih'), t('the evening of {date}', { date: fullDay(r.tarawih, t) })],
    [t('Laylat al-Qadr'), t('the night before the 27th, from the evening of {date}', { date: fullDay(r.qadr, t) })],
    [t('Eid al-Fitr'), fullDay(r.eid, t)],
    [t('Eid al-Adha'), fullDay(r.eidAlAdha, t)],
  ];
  return (
    <>
      {status && <p className="mb-3 text-[15px] text-ink-1">{status}</p>}
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2 text-[14px]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-ink-3">{k}</dt>
            <dd className="text-ink-1">{v}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}

function YearSection({ title, list, d, t }: { title: string; list: RamadanFacts[]; d: RamadanDates; t: Translate }) {
  return (
    <Section title={title}>
      {list.map(r => (
        <div key={r.hijriYear} className="mt-6 first:mt-0">
          {list.length > 1 && <h3 className="mb-3 text-[15px] font-semibold text-ink-1">{t('Ramadan {hijri} AH', { hijri: String(r.hijriYear) })}</h3>}
          <Facts r={r} d={d} t={t} />
        </div>
      ))}
    </Section>
  );
}

function Table({ d, t }: { d: RamadanDates; t: Translate }) {
  const cell = 'px-3 py-1.5 whitespace-nowrap';
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface-1">
      <table className="w-full text-[13px]">
        <thead className="bg-surface-2 text-left text-ink-3">
          <tr>
            {[t('Year'), t('Begins'), t('Ends'), t('Days'), t('Laylat al-Qadr'), t('Eid al-Fitr'), t('Eid al-Adha')].map(h => <th key={h} scope="col" className="px-3 py-2 font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {d.rows.map(r => {
            const here = r.hijriYear === d.nearest.hijriYear;
            const date = (x: string) => shortDate(x, t, r.year);
            return (
              <tr key={r.hijriYear} aria-current={here ? 'date' : undefined} className={here ? 'bg-surface-2' : undefined}>
                <th scope="row" className={`${cell} text-left font-normal`}>
                  <span className="font-medium text-ink-1">{String(r.year)}</span>{' '}
                  <span className="text-ink-3">{t('{hijri} AH', { hijri: String(r.hijriYear) })}</span>
                  {here && <span className="ml-2 rounded-full bg-surface-3 px-2 py-0.5 text-[11px] text-ink-2">{d.day !== null ? t('now') : t('next')}</span>}
                </th>
                <td className={`${cell} text-ink-1`}>{date(r.start)}</td>
                <td className={`${cell} text-ink-1`}>{date(r.end)}</td>
                <td className={`${cell} text-ink-2 tabular-nums`}>{r.days}</td>
                <td className={`${cell} text-ink-2`}>{date(r.qadr)}</td>
                <td className={`${cell} text-ink-1`}>{date(r.eid)}</td>
                <td className={`${cell} text-ink-2`}>{date(r.eidAlAdha)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** /ramadan: when Ramadan begins and ends this year and next, and every year from ten back to ten ahead. */
export async function RamadanDatesPage() {
  const text = await siteText((await requestLocale()).locale);
  const { t, locale } = text;
  const d = ramadanDates();
  const origin = configuredOrigin() ?? publicOrigin(await headers());
  const here = localePath(locale, PATH);
  // The Ramadan this page answers for, even on Eid day, when the city pages still lead with the one just ended.
  const near = ramadanYears().find(y => y.hijriYear === d.nearest.hijriYear) ?? nearestRamadan();
  const cities = CITIES.map(slug => placeBySlug('city', slug)).filter(p => !!p && findPlacePage(p, near.slug)?.page.index);
  return (
    <SiteFrame t={t} path={PATH} trail={[{ href: here, label: t('Ramadan dates') }]}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs(origin, [{ name: 'TAKIP', path: '/' }, { name: t('Ramadan dates'), path: here }])) }} />
      <header className="mt-8 max-w-[44rem]">
        <p className="text-[13px] font-medium text-ink-3">{t('Umm al-Qura calendar')}</p>
        <h1 className="mt-3 text-4xl leading-[1.08] font-semibold tracking-[-0.02em] sm:text-5xl">{t('Ramadan dates')}</h1>
        <p className="mt-5 text-[17px] leading-relaxed text-ink-1">{answer(d.nearest, d.day, t)}</p>
        <p className="mt-3 text-[17px] leading-relaxed text-ink-2">{answer(d.following, null, t)}</p>
      </header>

      <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:gap-16">
        <div className="max-w-[44rem]">
          <YearSection title={t('Ramadan this year ({year})', { year: String(d.thisYear) })} list={d.thisYears} d={d} t={t} />
          <YearSection title={t('Ramadan next year ({year})', { year: String(d.thisYear + 1) })} list={d.nextYears} d={d} t={t} />
          <Section title={t('Timetables for your city')}>
            <p className="text-[14px] text-ink-2">{t('Sehri and iftar times for each day of Ramadan {year}:', { year: ramadanLabel(near, t) })}</p>
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[14px]">
              {cities.map(p => <li key={p!.id}><Link href={localePath(locale, placePath(p!, near.slug))} rel={crawlRel(placeIndexed(p!, near.slug))} className={TEXT_LINK}>{nameOf(p!, t)}</Link></li>)}
            </ul>
            <p className="mt-4 text-[14px] text-ink-2">
              {t('Every other city:')} <Link href={localePath(locale, '/city')} className={TEXT_LINK}>{t(KIND_LABEL.city)}</Link>
            </p>
          </Section>
          <Section title={t('About these dates')}>
            <ul className="flex flex-col gap-3 border-l-2 border-amber/50 pl-4 text-[14px] leading-relaxed">
              <li>{t('The dates are the Umm al-Qura calendar’s, Saudi Arabia’s official calendar, worked out in advance.')}</li>
              <li>{t('Countries that begin the month when the new moon is sighted may start or end Ramadan a day earlier or later; the national authority or your local mosque announces the day.')}</li>
              <li>{t('Turkey’s Diyanet publishes its Hijri calendar a year ahead.')}</li>
            </ul>
          </Section>
        </div>
        <aside className="flex flex-col gap-10">
          <AdSlot slot={AD_SLOTS.page} variant="page" />
        </aside>
      </div>

      <Section title={t('Ramadan dates from {from} to {to}', { from: String(d.thisYear - SPAN), to: String(d.thisYear + SPAN) })} className="mt-16">
        <Table d={d} t={t} />
        <p className="mt-2 text-[13px] text-ink-3">{t('Laylat al-Qadr is the night before the 27th, from the evening of the date shown, as most observe it.')}</p>
        <OtherDates t={t} path={PATH} className="mt-6" />
      </Section>
    </SiteFrame>
  );
}
