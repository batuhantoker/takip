import type { Metadata } from 'next';
import { headers } from 'next/headers';
import AdSlot from '@/components/shell/ads/ad-slot';
import { OtherDates } from '@/components/site/dates/other-dates';
import { Section, SiteFrame } from '@/components/site/pages/site-frame';
import { requestLocale } from '@/lib/core/i18n/request';
import type { Translate } from '@/lib/core/i18n/translator';
import { AD_SLOTS } from '@/lib/platform/ads';
import { easterDates, SPAN, type EasterDates, type EasterYear } from '@/lib/platform/site/easter-dates';
import { breadcrumbs, jsonLd } from '@/lib/platform/site/json-ld';
import { localePath } from '@/lib/platform/site/locale-path';
import { readingImage, readingMetadata } from '@/lib/platform/site/meta';
import { configuredOrigin, publicOrigin } from '@/lib/platform/site/origin';
import { listOf } from '@/lib/platform/site/places/copy/format';
import { dayMonth, fullDay, longDay } from '@/lib/platform/site/places/topics/prayer-copy';
import { siteText } from '@/lib/platform/site/text';

const PATH = '/easter';
const WEEK_MS = 7 * 86_400_000;

function answer(e: EasterYear, today: string, t: Translate): string {
  const vars = { year: String(e.year), date: longDay(e.easter, t), orthodox: longDay(e.orthodoxEaster, t) };
  if (e.same) return t('Easter {year} is on {date}, for Western and Orthodox churches alike.', vars);
  return today > e.easter
    ? t('Easter {year} was on {date}; Orthodox Easter is on {orthodox}.', vars)
    : t('Easter {year} is on {date}; Orthodox Easter is on {orthodox}.', vars);
}

export async function easterDatesMetadata(): Promise<Metadata> {
  const { t, locale } = await siteText((await requestLocale()).locale);
  const d = easterDates();
  const e = d.nearest;
  const vars = (t: Translate) => ({ year: String(e.year), date: dayMonth(e.easter, t), orthodox: dayMonth(e.orthodoxEaster, t), from: String(d.thisYear - SPAN), to: String(d.thisYear + SPAN) });
  return readingMetadata({
    locale, path: PATH, image: readingImage('easter', locale),
    title: t('Easter {year} date: Western and Orthodox Easter', vars(t)),
    description: e.same
      ? t('Easter {year} falls on {date} for Western and Orthodox churches alike. Ash Wednesday, Good Friday, Ascension and Pentecost for every year from {from} to {to}.', vars(t))
      : t('Easter {year} falls on {date} and Orthodox Easter on {orthodox}. Ash Wednesday, Good Friday, Ascension and Pentecost for every year from {from} to {to}.', vars(t)),
  });
}

// A subgrid, so the three groups' labels share one column.
function Group({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <>
      <h3 className="col-span-2 mt-5 mb-2 text-[13px] font-medium text-ink-2 first:mt-0">{title}</h3>
      <dl className="col-span-2 grid grid-cols-subgrid gap-y-2 text-[14px]">
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

function YearSection({ title, e, t }: { title: string; e: EasterYear; t: Translate }) {
  const weeks = Math.round((Date.parse(e.orthodoxEaster) - Date.parse(e.easter)) / WEEK_MS);
  return (
    <Section title={title}>
      <p className="mb-4 text-[15px] text-ink-1">
        {e.same
          ? t('In {year} Western and Orthodox Easter fall on the same day.', { year: String(e.year) })
          : t('Orthodox Easter is {n, plural, one {# week} other {# weeks}} after Western Easter.', { n: weeks })}
      </p>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6">
        <Group title={t('Western churches')} rows={[
          [t('Ash Wednesday'), fullDay(e.ashWednesday, t)],
          [t('Palm Sunday'), fullDay(e.palmSunday, t)],
          [t('Good Friday'), fullDay(e.goodFriday, t)],
          [t('Easter Sunday'), fullDay(e.easter, t)],
          [t('Easter Monday'), fullDay(e.easterMonday, t)],
          [t('Ascension Day'), fullDay(e.ascension, t)],
          [t('Pentecost'), fullDay(e.pentecost, t)],
        ]} />
        <Group title={t('Orthodox churches')} rows={[
          [t('Good Friday'), fullDay(e.orthodoxGoodFriday, t)],
          [t('Easter Sunday'), fullDay(e.orthodoxEaster, t)],
          [t('Pentecost'), fullDay(e.orthodoxPentecost, t)],
        ]} />
        <Group title={t('Christmas')} rows={[
          [t('Most churches'), fullDay(e.christmas, t)],
          [t('Julian calendar'), fullDay(e.julianChristmas, t)],
        ]} />
      </div>
    </Section>
  );
}

function Table({ d, t }: { d: EasterDates; t: Translate }) {
  const cell = 'px-3 py-1.5 whitespace-nowrap';
  // The column names the weekday, so a cell needs only the day and month.
  const day = new Intl.DateTimeFormat(t.locale === 'en' ? 'en-GB' : t.intl, { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const date = (x: string) => day.format(Date.parse(`${x}T12:00:00Z`));
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface-1">
      <table className="w-full text-[13px]">
        <thead className="bg-surface-2 text-left text-ink-3">
          <tr>
            {[t('Year'), t('Ash Wednesday'), t('Good Friday'), t('Easter'), t('Ascension Day'), t('Pentecost'), t('Orthodox Easter'), t('Orthodox Pentecost')].map(h => <th key={h} scope="col" className="px-3 py-2 font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {d.rows.map(r => {
            const here = r.year === d.nearest.year;
            return (
              <tr key={r.year} aria-current={here ? 'date' : undefined} className={here ? 'bg-surface-2' : undefined}>
                <th scope="row" className={`${cell} text-left font-medium text-ink-1`}>
                  {String(r.year)}
                  {here && <span className="ml-2 rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-normal text-ink-2">{t('next')}</span>}
                </th>
                <td className={`${cell} text-ink-2`}>{date(r.ashWednesday)}</td>
                <td className={`${cell} text-ink-2`}>{date(r.goodFriday)}</td>
                <td className={`${cell} text-ink-1`}>{date(r.easter)}</td>
                <td className={`${cell} text-ink-2`}>{date(r.ascension)}</td>
                <td className={`${cell} text-ink-2`}>{date(r.pentecost)}</td>
                <td className={`${cell} text-ink-1`}>
                  {date(r.orthodoxEaster)}
                  {r.same && <span className="ml-2 text-[11px] text-ink-3">{t('same day')}</span>}
                </td>
                <td className={`${cell} text-ink-2`}>{date(r.orthodoxPentecost)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** /easter: when Western and Orthodox Easter fall this year and next, and every year from ten back to ten ahead. */
export async function EasterDatesPage() {
  const { t, locale } = await siteText((await requestLocale()).locale);
  const d = easterDates();
  const origin = configuredOrigin() ?? publicOrigin(await headers());
  const here = localePath(locale, PATH);
  const same = listOf(d.rows.filter(r => r.same).map(r => String(r.year)), t);
  return (
    <SiteFrame t={t} path={PATH} trail={[{ href: here, label: t('Easter dates') }]}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs(origin, [{ name: 'TAKIP', path: '/' }, { name: t('Easter dates'), path: here }])) }} />
      <header className="mt-8 max-w-[44rem]">
        <p className="text-[13px] font-medium text-ink-3">{t('Western and Orthodox churches')}</p>
        <h1 className="mt-3 text-4xl leading-[1.08] font-semibold tracking-[-0.02em] sm:text-5xl">{t('Easter dates')}</h1>
        <p className="mt-5 text-[17px] leading-relaxed text-ink-1">{answer(d.nearest, d.today, t)}</p>
        <p className="mt-3 text-[17px] leading-relaxed text-ink-2">{answer(d.following, d.today, t)}</p>
      </header>

      <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:gap-16">
        <div className="max-w-[44rem]">
          <YearSection title={t('Easter this year ({year})', { year: String(d.thisYear) })} e={d.rows[SPAN]} t={t} />
          <YearSection title={t('Easter next year ({year})', { year: String(d.thisYear + 1) })} e={d.rows[SPAN + 1]} t={t} />
          <Section title={t('About these dates')}>
            <ul className="flex flex-col gap-3 border-l-2 border-amber/50 pl-4 text-[14px] leading-relaxed">
              <li>{t('Western Easter, kept by the Catholic and Protestant churches, is the Sunday after the church’s full moon on or after 21 March on the Gregorian calendar, so it falls between 22 March and 25 April.')}</li>
              <li>{t('Orthodox Easter is worked out the same way on the Julian calendar and given here as its Gregorian date, between 4 April and 8 May. In {years} both fall on the same day.', { years: same })}</li>
              <li>{t('Ascension is 39 days after Easter, on a Thursday, though some Catholic dioceses keep it on the following Sunday; Pentecost is seven weeks after Easter.')}</li>
              <li>{t('The Russian, Serbian, Georgian and Jerusalem churches keep Christmas on the Julian calendar, on 7 January; the Greek, Romanian and Bulgarian churches keep it on 25 December and Easter on the Orthodox date.')}</li>
            </ul>
          </Section>
        </div>
        <aside className="flex flex-col gap-10">
          <AdSlot slot={AD_SLOTS.page} variant="page" />
        </aside>
      </div>

      <Section title={t('Easter dates from {from} to {to}', { from: String(d.thisYear - SPAN), to: String(d.thisYear + SPAN) })} className="mt-16">
        <Table d={d} t={t} />
        <p className="mt-2 text-[13px] text-ink-3">{t('Palm Sunday is the Sunday before Easter and Easter Monday the day after; Orthodox Good Friday is two days before Orthodox Easter.')}</p>
        <OtherDates t={t} path={PATH} className="mt-6" />
      </Section>
    </SiteFrame>
  );
}
