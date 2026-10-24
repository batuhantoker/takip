import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { permanentRedirect, redirect } from 'next/navigation';
import { cache } from 'react';
import { ArrowUpRight } from 'lucide-react';
import AdSlot from '@/components/shell/ads/ad-slot';
import { cx, FOCUS_RING } from '@/components/ui/class-names';
import { LINK_BUTTON, Section, SiteFrame } from '@/components/site/pages/site-frame';
import type { Locale } from '@/lib/core/i18n/locales';
import { requestLocale } from '@/lib/core/i18n/request';
import { AD_SLOTS } from '@/lib/platform/ads';
import { comparePath, pairMeasures, pairOpen, type PairMeasure } from '@/lib/platform/site/compare/compare';
import { groupCopy, groupSentence, pairHighlights, pairIndexed, pairMeasureCopy, pairMeasureIndexed, pairOverviewCopy } from '@/lib/platform/site/compare/compare-copy';
import { findCountry } from '@/lib/platform/site/compare/countries';
import { parsePairSlug, type CountryPair } from '@/lib/platform/site/compare/pairs';
import { addedView, extraSeries, isPlainView, MAX_COUNTRIES, parseView, viewQuery, withoutCountry, type CompareView } from '@/lib/platform/site/compare/view';
import { breadcrumbs, jsonLd } from '@/lib/platform/site/json-ld';
import { localePath } from '@/lib/platform/site/locale-path';
import { mapHref } from '@/lib/platform/site/map-link';
import { readingMetadata } from '@/lib/platform/site/meta';
import { configuredOrigin, publicOrigin } from '@/lib/platform/site/origin';
import { listOf, nameOf } from '@/lib/platform/site/places/copy/format';
import { HEADLINE } from '@/lib/platform/site/places/topics/indicators';
import { siteText } from '@/lib/platform/site/text';
import { ChartHeader } from './parts/chart-header';
import { CompareChart, type Entry } from './parts/compare-chart';
import { CountryBar } from './parts/country-bar';
import { MeasureNav } from './parts/measure-nav';
import { OverviewTable } from './parts/overview-table';
import { PairMeasureBody, PairOverviewBody } from './parts/pair-bodies';

/** The pair, measure and view a URL names, if any. Shared by the metadata and the page within one request. */
const load = cache(async (slug: string, measure: string | undefined, search: string) => {
  const parsed = parsePairSlug(slug);
  if (!parsed) return null;
  const { pair } = parsed;
  const measures = pairMeasures(pair);
  const current = measure === undefined ? undefined : measures.find(m => m.spec.slug === measure);
  if (!measures.length || (measure !== undefined && !current)) return null;
  const query = Object.fromEntries(new URLSearchParams(search));
  const view = parseView(query, pair);
  const text = await siteText((await requestLocale()).locale);
  const places = [pair.a, pair.b, ...view.with];
  const names = places.map(p => nameOf(p, text.t));
  const copy = current ? pairMeasureCopy(pair, current, text.t) : pairOverviewCopy(pair, measures, text.t);
  const group = view.with.length ? groupCopy(names, measures.length, text.t, current?.spec) : undefined;
  const index = isPlainView(view) && (current ? pairMeasureIndexed(pair, current) : pairIndexed(pair, measures));
  return { ...parsed, measures, current, query, view, places, names, text, copy, group, index, path: comparePath(pair, measure) };
});

export async function compareMetadata(slug: string, measure: string | undefined, search: string): Promise<Metadata> {
  const found = await load(slug, measure, search);
  if (!found?.canonical) return {};
  const { text, copy, group, index, path } = found;
  const meta = readingMetadata({
    locale: text.locale, path, title: group?.title ?? copy.title, description: copy.description, type: 'article',
    image: `/og?place=${encodeURIComponent(`compare/${slug}${measure ? `/${measure}` : ''}`)}&lang=${text.locale}`,
  });
  // Any two countries render; only a listed pair with enough in common, as it first opens, is put forward for search.
  return index ? meta : { ...meta, robots: { index: false, follow: true } };
}

/** Each country in the bar, with where its × leads: an added one goes, one of the pair gives way to the first added. */
function barCountries(pair: CountryPair, view: CompareView, names: string[], measure: string | undefined, locale: Locale) {
  return [pair.a, pair.b, ...view.with].map((place, slot) => {
    const next = withoutCountry(pair, view, place.id);
    const keeps = next && (measure === undefined || pairMeasures(next.pair).some(m => m.spec.slug === measure));
    return { place, label: names[slot], slot, remove: next && localePath(locale, comparePath(next.pair, keeps ? measure : undefined)) + viewQuery(next.view) };
  });
}

/** Null when the URL names no comparison, for the route to answer 404; a reversed pair is sent to its own address. */
export async function ComparePage({ slug, measure, search }: { slug: string; measure?: string; search: string }) {
  const found = await load(slug, measure, search);
  if (!found) return null;
  const { pair, measures, current, query, view, places, names, text, copy, group, canonical, path } = found;
  const { t, locale } = text;
  const here = localePath(locale, path);
  if (query.add !== undefined) redirect(here + viewQuery(addedView(findCountry(query.add, t), pair, view) ?? view));
  if (!canonical) permanentRedirect(here + viewQuery(view));
  const origin = configuredOrigin() ?? publicOrigin(await headers());
  const qs = viewQuery(view);
  const index = localePath(locale, '/compare');
  const overview = localePath(locale, comparePath(pair));
  const together = view.with.length ? listOf(names, t) : t('{a} vs {b}', { a: names[0], b: names[1] });
  const trail = [{ href: index, label: t('Compare') }, ...(current ? [{ href: overview + qs, label: together }] : [])];
  const link = pairOpen(pair, measures, current, view.with);
  const open = link?.mode && mapHref({ layers: [], mode: link.mode });
  const to = (v: CompareView, slugOf = measure) => localePath(locale, comparePath(pair, slugOf)) + viewQuery(v);
  const entriesOf = (m: PairMeasure): Entry[] => [m.a, m.b, ...extraSeries(view, m.spec.slug)].map((series, slot) => ({ label: names[slot], series, slot }));
  const bar = (
    <CountryBar countries={barCountries(pair, view, names, measure, locale)} t={t}
      add={places.length < MAX_COUNTRIES ? { action: here, keep: [...new URLSearchParams(qs)] } : undefined} />
  );
  const heading = group?.heading ?? copy.heading;
  const ld = (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs(origin, [
      { name: 'TAKIP', path: '/' },
      { name: t('Compare'), path: index },
      ...(current ? [{ name: t('{a} vs {b}', { a: names[0], b: names[1] }), path: overview }] : []),
      { name: copy.heading, path: here },
    ])) }} />
  );
  const mapButton = open && (
    <a href={open} className={LINK_BUTTON.primary}>{t('Watch it change on the map')}<ArrowUpRight className="size-4" aria-hidden /></a>
  );

  if (current) {
    const entries = entriesOf(current);
    const lede = group ? groupSentence(current.spec, entries.map(e => ({ name: e.label, series: e.series })), t) ?? '' : copy.lede;
    return (
      <SiteFrame t={t} path={path} trail={trail}>
        {ld}
        <article>
          <header className="mt-8 max-w-[48rem]">
            <Link href={trail[1].href} className={cx('text-[13px] font-medium text-ink-3 hover:text-ink-1', FOCUS_RING)}>{trail[1].label}</Link>
            <h1 className="mt-3 text-4xl leading-[1.08] font-semibold tracking-[-0.02em] sm:text-5xl">{heading}</h1>
            <p className="mt-5 text-[17px] leading-relaxed text-ink-2">{lede}</p>
          </header>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
            {bar}
            {mapButton}
          </div>
          <div className="mt-4">
            <CompareChart id={`compare-${current.spec.slug}`} spec={current.spec} entries={entries} world={current.meta?.world}
              view={view} title={heading} desc={lede} t={t} href={v => to(v)} />
          </div>
          <div className="mt-14 grid gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:gap-16">
            <div>
              <PairMeasureBody text={text} pair={pair} places={places} entries={entries} m={current} />
            </div>
            <aside className="flex flex-col gap-10">
              <MeasureNav title={t('Other measures')} overview={{ href: overview + qs, label: t('Every measure at a glance') }}
                specs={measures.map(m => m.spec)} current={current.spec.slug} href={s => to(view, s)} t={t} />
              <AdSlot slot={AD_SLOTS.page} variant="page" />
            </aside>
          </div>
        </article>
      </SiteFrame>
    );
  }

  const hero = HEADLINE.flatMap(s => measures.filter(m => m.spec.slug === s))[0] ?? measures[0];
  return (
    <SiteFrame t={t} path={path} trail={trail}>
      {ld}
      <article>
        <ChartHeader kicker={trail[0]} heading={heading} lede={group?.lede ?? copy.lede}
          points={group ? undefined : pairHighlights(pair, measures, t)} open={open} openLabel={t('Watch it change on the map')}
          hero={(
            <CompareChart id={`compare-${hero.spec.slug}`} spec={hero.spec} entries={entriesOf(hero)} world={hero.meta?.world} view={view}
              title={t(hero.spec.label)} desc={heading} t={t} size="hero" heading={{ label: t(hero.spec.label), href: to(view, hero.spec.slug) }} />
          )} />
        <Section title={t('Every measure')} className="mt-16">
          <div className="flex flex-col gap-4">
            {bar}
            <OverviewTable countries={names.map((label, slot) => ({ label, slot }))} t={t}
              rows={measures.map(m => ({ spec: m.spec, series: entriesOf(m).map(e => e.series), href: to(view, m.spec.slug) }))} />
          </div>
        </Section>
        <div className="mt-16 grid gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:gap-16">
          <div>
            <PairOverviewBody text={text} places={places} names={names} measures={measures} />
          </div>
          <aside className="flex flex-col gap-10">
            <AdSlot slot={AD_SLOTS.page} variant="page" />
          </aside>
        </div>
      </article>
    </SiteFrame>
  );
}
