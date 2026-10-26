import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import AdSlot from '@/components/shell/ads/ad-slot';
import { OtherDates } from '@/components/site/dates/other-dates';
import { Section, SiteFrame, TEXT_LINK } from '@/components/site/pages/site-frame';
import { requestLocale } from '@/lib/core/i18n/request';
import { msg, type Translate } from '@/lib/core/i18n/translator';
import { AD_SLOTS } from '@/lib/platform/ads';
import { breadcrumbs, jsonLd } from '@/lib/platform/site/json-ld';
import { HOLIDAY_KEYS, jewishHolidays, SPAN, type Holiday, type HolidayKey, type JewishDates, type JewishLead, type JewishYear } from '@/lib/platform/site/jewish-holidays';
import { localePath } from '@/lib/platform/site/locale-path';
import { crawlRel, readingImage, readingMetadata } from '@/lib/platform/site/meta';
import { configuredOrigin, publicOrigin } from '@/lib/platform/site/origin';
import { countryName, nameOf } from '@/lib/platform/site/places/copy/format';
import { placeIndexed } from '@/lib/platform/site/places/pages';
import { placePath } from '@/lib/platform/site/places/paths';
import { jewishCommunity } from '@/lib/platform/site/places/topics/faith-reach';
import { dayMonth, fullDay, longDay, shortDate } from '@/lib/platform/site/places/topics/prayer-copy';
import { shabbatCities } from '@/lib/platform/site/places/topics/shabbat';
import { siteText } from '@/lib/platform/site/text';

const PATH = '/jewish-holidays';

const LABEL: Record<HolidayKey, string> = {
  purim: msg('Purim'), passover: msg('Passover'), shavuot: msg('Shavuot'), tishaBav: msg('Tisha B’Av'), roshHashanah: msg('Rosh Hashanah'),
  yomKippur: msg('Yom Kippur'), sukkot: msg('Sukkot'), simchatTorah: msg('Simchat Torah'), hanukkah: msg('Hanukkah'),
};

function answer(l: JewishLead, t: Translate): string {
  const vars = { year: String(l.roshHashanah.year), rh: longDay(l.roshHashanah.eve, t), yk: longDay(l.yomKippur.eve, t), passoverYear: String(l.passover.year), passover: longDay(l.passover.eve, t) };
  return l.begun
    ? t('Rosh Hashanah {year} began at sunset on {rh}; Yom Kippur begins at sunset on {yk}; Passover {passoverYear} begins at sunset on {passover}.', vars)
    : t('Rosh Hashanah {year} begins at sunset on {rh}; Yom Kippur at sunset on {yk}; Passover {passoverYear} begins at sunset on {passover}.', vars);
}

export async function jewishHolidaysMetadata(): Promise<Metadata> {
  const { t, locale } = await siteText((await requestLocale()).locale);
  const d = jewishHolidays();
  const l = d.lead;
  const vars = (t: Translate) => ({
    year: String(l.roshHashanah.year), rh: dayMonth(l.roshHashanah.eve, t), yk: dayMonth(l.yomKippur.eve, t),
    passoverYear: String(l.passover.year), passover: dayMonth(l.passover.eve, t), from: String(d.thisYear - SPAN), to: String(d.thisYear + SPAN),
  });
  return readingMetadata({
    locale, path: PATH, image: readingImage('jewish-holidays', locale),
    title: t('Jewish holidays {year}: Rosh Hashanah, Yom Kippur, Passover', vars(t)),
    description: t('Rosh Hashanah {year} begins at sunset on {rh}, Yom Kippur at sunset on {yk}, Passover {passoverYear} on {passover}. Every holiday from {from} to {to}.', vars(t)),
  });
}

const isNext = (h: Holiday, d: JewishDates) => h.key === d.next.key && h.first === d.next.first;

function Pill({ d, t }: { d: JewishDates; t: Translate }) {
  return <span className="ml-2 rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-normal text-ink-2">{d.now ? t('now') : t('next')}</span>;
}

function when(h: Holiday, t: Translate): string {
  return h.last === h.first ? fullDay(h.first, t) : t('{start} to {end}', { start: longDay(h.first, t), end: fullDay(h.last, t) });
}

function note(h: Holiday, y: JewishYear, t: Translate): string {
  const eve = longDay(h.eve, t);
  switch (h.key) {
    case 'passover': return t('from sunset on {eve}; seven days in Israel, to {israel}', { eve, israel: longDay(h.israel!, t) });
    case 'shavuot': return t('from sunset on {eve}; one day in Israel', { eve });
    case 'tishaBav': return h.moved ? t('from sunset on {eve}; put off from Shabbat to Sunday', { eve }) : t('from sunset on {eve}', { eve });
    case 'roshHashanah': return t('from sunset on {eve}; the Jewish year {hebrew} begins', { eve, hebrew: String(y.hebrewYear) });
    case 'simchatTorah': return t('from sunset on {eve}; in Israel a day earlier, on {israel}, with Shemini Atzeret', { eve, israel: longDay(h.israel!, t) });
    case 'hanukkah': return t('eight nights, the first candle at sunset on {eve}', { eve });
    default: return t('from sunset on {eve}', { eve });
  }
}

function YearSection({ title, y, d, t }: { title: string; y: JewishYear; d: JewishDates; t: Translate }) {
  return (
    <Section title={title}>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-3 text-[14px]">
        {HOLIDAY_KEYS.map(k => {
          const h = y.holidays[k];
          return (
            <div key={k} className="contents">
              <dt className="text-ink-3">{t(LABEL[k])}</dt>
              <dd>
                <span className="text-ink-1">{when(h, t)}</span>
                {isNext(h, d) && <Pill d={d} t={t} />}
                <span className="block text-[13px] text-ink-3">{note(h, y, t)}</span>
              </dd>
            </div>
          );
        })}
      </dl>
    </Section>
  );
}

function Table({ d, t }: { d: JewishDates; t: Translate }) {
  const cell = 'px-3 py-1.5 whitespace-nowrap';
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface-1">
      <table className="w-full text-[13px]">
        <thead className="bg-surface-2 text-left text-ink-3">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">{t('Year')}</th>
            {HOLIDAY_KEYS.map(k => <th key={k} scope="col" className="px-3 py-2 font-medium">{t(LABEL[k])}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {d.rows.map(r => {
            const here = r.year === d.next.year;
            return (
              <tr key={r.year} aria-current={here ? 'date' : undefined} className={here ? 'bg-surface-2' : undefined}>
                <th scope="row" className={`${cell} text-left font-medium text-ink-1`}>{String(r.year)}</th>
                {HOLIDAY_KEYS.map(k => {
                  const h = r.holidays[k];
                  return (
                    <td key={k} className={`${cell} ${isNext(h, d) ? 'font-medium text-ink-1' : 'text-ink-2'}`}>
                      {shortDate(h.first, t, r.year)}{h.moved && '*'}
                      {isNext(h, d) && <Pill d={d} t={t} />}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** The indexed Shabbat-times pages, Israel's first, then by the size of each country's listed communities. */
function ShabbatCities({ t }: { t: Translate }) {
  const by = new Map<string, { cities: ReturnType<typeof shabbatCities>; jews: number }>();
  for (const c of shabbatCities()) {
    if (!c.index) continue;
    const g = by.get(c.place.cc) ?? by.set(c.place.cc, { cities: [], jews: 0 }).get(c.place.cc)!;
    g.cities.push(c);
    g.jews += jewishCommunity(c.place)?.jews ?? 0;
  }
  const groups = [...by].sort(([a, x], [b, y]) => Number(b === 'IL') - Number(a === 'IL') || y.jews - x.jews);
  if (!groups.length) return null;
  return (
    <Section title={t('Shabbat times by city')}>
      <p className="text-[14px] text-ink-2">{t('Candle lighting and havdalah for this Shabbat and the next 12 weeks, with the holidays among them:')}</p>
      <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-5 gap-y-2 text-[14px]">
        {groups.map(([cc, g]) => (
          <div key={cc} className="contents">
            <dt className="text-ink-3">{countryName(cc, t)}</dt>
            <dd className="flex flex-wrap gap-x-4 gap-y-1">
              {(cc === 'IL' ? g.cities : [...g.cities].sort((a, b) => (jewishCommunity(b.place)?.jews ?? 0) - (jewishCommunity(a.place)?.jews ?? 0)))
                .map(c => <Link key={c.place.id} href={localePath(t.locale, placePath(c.place, c.slug))} rel={crawlRel(placeIndexed(c.place, c.slug))} className={TEXT_LINK}>{nameOf(c.place, t)}</Link>)}
            </dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

/** /jewish-holidays: when each holiday falls this year and next, and every year from ten back to ten ahead. */
export async function JewishHolidaysPage() {
  const { t, locale } = await siteText((await requestLocale()).locale);
  const d = jewishHolidays();
  const origin = configuredOrigin() ?? publicOrigin(await headers());
  const here = localePath(locale, PATH);
  return (
    <SiteFrame t={t} path={PATH} trail={[{ href: here, label: t('Jewish holidays') }]}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs(origin, [{ name: 'TAKIP', path: '/' }, { name: t('Jewish holidays'), path: here }])) }} />
      <header className="mt-8 max-w-[44rem]">
        <p className="text-[13px] font-medium text-ink-3">{t('Hebrew calendar')}</p>
        <h1 className="mt-3 text-4xl leading-[1.08] font-semibold tracking-[-0.02em] sm:text-5xl">{t('Jewish holidays')}</h1>
        <p className="mt-5 text-[17px] leading-relaxed text-ink-1">{answer(d.lead, t)}</p>
        <p className="mt-3 text-[17px] leading-relaxed text-ink-2">{answer(d.following, t)}</p>
      </header>

      <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:gap-16">
        <div className="max-w-[44rem]">
          <YearSection title={t('Jewish holidays this year ({year})', { year: String(d.thisYear) })} y={d.rows[SPAN]} d={d} t={t} />
          <YearSection title={t('Jewish holidays next year ({year})', { year: String(d.thisYear + 1) })} y={d.rows[SPAN + 1]} d={d} t={t} />
          <ShabbatCities t={t} />
          <Section title={t('About these dates')}>
            <ul className="flex flex-col gap-3 border-l-2 border-amber/50 pl-4 text-[14px] leading-relaxed">
              <li>{t('The dates follow the fixed Hebrew calendar, worked out by rule rather than by sighting the moon, so communities everywhere keep the same days.')}</li>
              <li>{t('Jewish days begin at sunset: each holiday begins on the evening before the first date shown and ends at nightfall on its last.')}</li>
              <li>{t('Outside Israel, Passover lasts eight days and Shavuot two, and Simchat Torah is the day after Shemini Atzeret; in Israel Passover lasts seven days and Shavuot one, and Simchat Torah falls on Shemini Atzeret.')}</li>
              <li>{t('Purim is on the 14th of Adar, of Adar II in a leap year; Jerusalem keeps it a day later, as Shushan Purim.')}</li>
              <li>{t('When the 9th of Av falls on Shabbat, the Tisha B’Av fast is put off to Sunday.')}</li>
            </ul>
          </Section>
        </div>
        <aside className="flex flex-col gap-10">
          <AdSlot slot={AD_SLOTS.page} variant="page" />
        </aside>
      </div>

      <Section title={t('Jewish holidays from {from} to {to}', { from: String(d.thisYear - SPAN), to: String(d.thisYear + SPAN) })} className="mt-16">
        <p className="mb-3 text-[14px] text-ink-2">{t('Each date is the holiday’s first day, as kept outside Israel; it begins at sunset the evening before.')}</p>
        <Table d={d} t={t} />
        <p className="mt-2 text-[13px] text-ink-3">{t('* Put off from Shabbat to Sunday. Simchat Torah is a day earlier in Israel.')}</p>
        <OtherDates t={t} path={PATH} className="mt-6" />
      </Section>
    </SiteFrame>
  );
}
