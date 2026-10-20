import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { permanentRedirect } from 'next/navigation';
import { cache } from 'react';
import AdSlot from '@/components/shell/ads/ad-slot';
import { SiteFrame } from '@/components/site/pages/site-frame';
import { MeasureChartCard } from '@/components/site/places/topics/parts/measure-chart';
import { requestLocale } from '@/lib/core/i18n/request';
import { AD_SLOTS } from '@/lib/platform/ads';
import { comparePath, pairMeasures, pairOpen } from '@/lib/platform/site/compare/compare';
import { pairIndexed, pairMeasureCopy, pairMeasureIndexed, pairOverviewCopy, pairSentences } from '@/lib/platform/site/compare/compare-copy';
import { parsePairSlug } from '@/lib/platform/site/compare/pairs';
import { breadcrumbs, jsonLd } from '@/lib/platform/site/json-ld';
import { localePath } from '@/lib/platform/site/locale-path';
import { mapHref } from '@/lib/platform/site/map-link';
import { readingMetadata } from '@/lib/platform/site/meta';
import { configuredOrigin, publicOrigin } from '@/lib/platform/site/origin';
import { nameOf } from '@/lib/platform/site/places/copy/format';
import { siteText } from '@/lib/platform/site/text';
import { ChartHeader } from './parts/chart-header';
import { PairMeasureBody, PairOverviewBody, PairOverviewHero } from './parts/pair-bodies';

/** The pair and measure a URL names, if any. Shared by the metadata and the page within one request. */
const load = cache(async (slug: string, measure?: string) => {
  const parsed = parsePairSlug(slug);
  if (!parsed) return null;
  const { pair } = parsed;
  const measures = pairMeasures(pair);
  const current = measure === undefined ? undefined : measures.find(m => m.spec.slug === measure);
  if (!measures.length || (measure !== undefined && !current)) return null;
  const text = await siteText((await requestLocale()).locale);
  const copy = current ? pairMeasureCopy(pair, current, text.t) : pairOverviewCopy(pair, measures, text.t);
  const index = current ? pairMeasureIndexed(pair, current) : pairIndexed(pair, measures);
  return { ...parsed, measures, current, text, copy, index, path: comparePath(pair, measure) };
});

export async function compareMetadata(slug: string, measure?: string): Promise<Metadata> {
  const found = await load(slug, measure);
  if (!found?.canonical) return {};
  const { text, copy, index, path } = found;
  const meta = readingMetadata({
    locale: text.locale, path, title: copy.title, description: copy.description, type: 'article',
    image: `/og?place=${encodeURIComponent(`compare/${slug}${measure ? `/${measure}` : ''}`)}&lang=${text.locale}`,
  });
  // Any two countries render; only a listed pair with enough in common is put forward for search.
  return index ? meta : { ...meta, robots: { index: false, follow: true } };
}

/** Null when the URL names no comparison, for the route to answer 404; a reversed pair is sent to its own address. */
export async function ComparePage({ slug, measure }: { slug: string; measure?: string }) {
  const found = await load(slug, measure);
  if (!found) return null;
  const { pair, measures, current, text, copy, canonical, path } = found;
  if (!canonical) permanentRedirect(localePath(text.locale, path));
  const { t } = text;
  const origin = configuredOrigin() ?? publicOrigin(await headers());
  const index = localePath(text.locale, '/compare');
  const overview = localePath(text.locale, comparePath(pair));
  const names: [string, string] = [nameOf(pair.a, t), nameOf(pair.b, t)];
  const trail = [{ href: index, label: t('Compare') }, ...(current ? [{ href: overview, label: t('{a} vs {b}', { a: names[0], b: names[1] }) }] : [])];
  const link = pairOpen(pair, measures, current);
  const open = link?.mode && mapHref({ layers: [], mode: link.mode });
  const hero = current
    ? (
      <MeasureChartCard id={`compare-${current.spec.slug}`} spec={current.spec} t={t} world={current.meta?.world}
        places={[{ label: names[0], series: current.a, slot: 0 }, { label: names[1], series: current.b, slot: 1 }]}
        title={copy.heading} desc={pairSentences(pair, current, t).slice(0, 2).join(' ')} />
    )
    : <PairOverviewHero pair={pair} names={names} measures={measures} t={t} />;
  return (
    <SiteFrame t={t} path={path} trail={trail}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs(origin, [
        { name: 'TAKIP', path: '/' },
        ...trail.map(c => ({ name: c.label, path: c.href })),
        { name: copy.heading, path: localePath(text.locale, path) },
      ])) }} />
      <article>
        <ChartHeader kicker={trail[trail.length - 1]} heading={copy.heading} lede={copy.lede} open={open} openLabel={t('Watch it change on the map')} hero={hero} />
        <div className="mt-16 grid gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:gap-16">
          <div>
            {current
              ? <PairMeasureBody text={text} pair={pair} names={names} m={current} measures={measures} />
              : <PairOverviewBody text={text} pair={pair} names={names} measures={measures} />}
          </div>
          <aside className="flex flex-col gap-10">
            <AdSlot slot={AD_SLOTS.page} variant="page" />
          </aside>
        </div>
      </article>
    </SiteFrame>
  );
}
