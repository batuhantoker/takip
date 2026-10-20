import type { Metadata } from 'next';
import Link from 'next/link';
import { cx, FOCUS_RING } from '@/components/ui/class-names';
import { LINK_BUTTON, Section, SiteFrame, TEXT_LINK } from '@/components/site/pages/site-frame';
import { requestLocale } from '@/lib/core/i18n/request';
import type { Translate } from '@/lib/core/i18n/translator';
import { comparePath } from '@/lib/platform/site/compare/compare';
import { comparedWith } from '@/lib/platform/site/compare/pairs';
import { worldPath } from '@/lib/platform/site/compare/world';
import { localePath } from '@/lib/platform/site/locale-path';
import { readingMetadata } from '@/lib/platform/site/meta';
import { nameOf } from '@/lib/platform/site/places/copy/format';
import { placeById } from '@/lib/platform/site/places/gazetteer';
import type { Place } from '@/lib/platform/site/places/place';
import { INDICATOR_GROUPS, INDICATORS } from '@/lib/platform/site/places/topics/indicators-data';
import { indicatorTable } from '@/lib/platform/site/places/topics/indicators-table';
import { siteText } from '@/lib/platform/site/text';

/** Every country with numbers, by name in the reader's language. */
function countries(t: Translate): { place: Place; name: string }[] {
  const collator = new Intl.Collator(t.intl);
  return Object.keys(indicatorTable().rows).flatMap(id => {
    const place = placeById(Number(id));
    return place ? [{ place, name: nameOf(place, t) }] : [];
  }).sort((x, y) => collator.compare(x.name, y.name));
}

export async function compareIndexMetadata(): Promise<Metadata> {
  const { t, locale } = await siteText((await requestLocale()).locale);
  return readingMetadata({
    locale, path: '/compare', image: '/og',
    title: t('Compare countries: {n} measures side by side', { n: INDICATORS.length }),
    description: t('Any two countries side by side on {n} measures, from life expectancy and population to the economy and military spending, each charted year by year from its source.', { n: INDICATORS.length }),
  });
}

const SELECT = cx('h-10 min-w-0 flex-1 rounded-control border border-line-strong bg-surface-2 px-3 text-[14px] text-ink-1', FOCUS_RING);

/** /compare: pick any two countries, or follow the pairs people compare and each measure's world page. */
export async function CompareIndex() {
  const text = await siteText((await requestLocale()).locale);
  const { t } = text;
  const all = countries(t);
  const listed = all.map(c => ({ ...c, partners: comparedWith(c.place) })).filter(c => c.partners.length);
  return (
    <SiteFrame t={t} path="/compare">
      <header className="mt-8 max-w-[44rem]">
        <p className="text-[13px] font-medium text-ink-3">{t('Compare')}</p>
        <h1 className="mt-3 text-4xl leading-[1.08] font-semibold tracking-[-0.02em] sm:text-5xl">{t('Compare countries')}</h1>
        <p className="mt-5 text-[17px] leading-relaxed text-ink-2">
          {t('Put two countries side by side on any of {n} measures, from life expectancy to military spending, each charted year by year with its source.', { n: INDICATORS.length })}
        </p>
        <form action={localePath(t.locale, '/compare')} method="get" className="mt-8 flex flex-col gap-3 sm:flex-row">
          {(['a', 'b'] as const).map((field, i) => (
            <label key={field} className="flex min-w-0 flex-1 flex-col gap-1.5 text-[12px] text-ink-3">
              {i ? t('Second country') : t('First country')}
              <select name={field} required defaultValue="" className={SELECT}>
                <option value="" disabled>{t('Choose a country')}</option>
                {all.map(c => <option key={c.place.id} value={c.place.slug}>{c.name}</option>)}
              </select>
            </label>
          ))}
          <button type="submit" className={cx(LINK_BUTTON.primary, 'self-end')}>{t('Compare')}</button>
        </form>
      </header>

      <Section title={t('Each measure around the world')} className="mt-16">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {INDICATOR_GROUPS.map(g => (
            <div key={g.id}>
              <h3 className="text-[14px] font-semibold text-ink-1">{t(g.label)}</h3>
              <ul className="mt-2 flex flex-col gap-1 text-[14px]">
                {INDICATORS.filter(s => s.group === g.id).map(s => (
                  <li key={s.slug}><Link href={localePath(t.locale, worldPath(s.slug))} className={TEXT_LINK}>{t(s.label)}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section title={t('Countries and the ones they are compared with')}>
        <ul className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {listed.map(({ place, name, partners }) => (
            <li key={place.id} className="text-[14px] leading-relaxed">
              <span className="font-medium text-ink-1">{name}</span>
              <span className="text-ink-3"> · </span>
              {partners.map((p, i) => (
                <span key={p.id}>
                  {i > 0 && <span className="text-ink-4">, </span>}
                  <Link href={localePath(t.locale, comparePath({ a: place, b: p }))} className="text-ink-2 hover:text-ink-1">{nameOf(p, t)}</Link>
                </span>
              ))}
            </li>
          ))}
        </ul>
      </Section>
    </SiteFrame>
  );
}
