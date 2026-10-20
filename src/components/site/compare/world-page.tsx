import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { cache } from 'react';
import AdSlot from '@/components/shell/ads/ad-slot';
import { Section, SiteFrame, TEXT_LINK } from '@/components/site/pages/site-frame';
import { Notes } from '@/components/site/places/parts/notes';
import { indicatorNotes } from '@/components/site/places/topics/lib/indicator-notes';
import { MeasureChartCard } from '@/components/site/places/topics/parts/measure-chart';
import { requestLocale } from '@/lib/core/i18n/request';
import { AD_SLOTS } from '@/lib/platform/ads';
import { worldCopy, worldMeasure, worldOpen, worldPath, type WorldMeasure } from '@/lib/platform/site/compare/world';
import { breadcrumbs, jsonLd } from '@/lib/platform/site/json-ld';
import { localePath } from '@/lib/platform/site/locale-path';
import { mapHref } from '@/lib/platform/site/map-link';
import { readingMetadata } from '@/lib/platform/site/meta';
import { configuredOrigin, publicOrigin } from '@/lib/platform/site/origin';
import { nameOf } from '@/lib/platform/site/places/copy/format';
import { placePath } from '@/lib/platform/site/places/paths';
import { basisOf, formatValue } from '@/lib/platform/site/places/topics/indicators-facts';
import { siteText, type SiteText } from '@/lib/platform/site/text';
import { ChartHeader } from './parts/chart-header';

/** Whether /map/<slug> is a measure around the world rather than a layer's page. */
export const isWorldSlug = (slug: string) => worldMeasure(slug) !== null;

const load = cache(async (slug: string) => {
  const w = worldMeasure(slug);
  if (!w) return null;
  const text = await siteText((await requestLocale()).locale);
  return { w, text, copy: worldCopy(w, text.t) };
});

export async function worldMetadata(slug: string): Promise<Metadata> {
  const found = await load(slug);
  if (!found) return {};
  const { text, copy } = found;
  return readingMetadata({
    locale: text.locale, path: worldPath(slug), title: copy.title, description: copy.description, type: 'article',
    image: `/og?place=${encodeURIComponent(`world/${slug}`)}&lang=${text.locale}`,
  });
}

/** Every country's latest value, highest first, each leading to its own page for the measure. */
function Ranking({ w, text }: { w: WorldMeasure; text: SiteText }) {
  const { t } = text;
  const modelled = basisOf(w.spec) === 'modelled';
  return (
    <div className="max-h-[640px] overflow-auto rounded-card border border-line bg-surface-1">
      <table className="w-full text-left text-[13px]">
        <thead className="sticky top-0 bg-surface-2 text-ink-3">
          <tr>
            <th scope="col" className="px-4 py-2 font-medium">#</th>
            <th scope="col" className="px-4 py-2 font-medium">{t('Country')}</th>
            <th scope="col" className="px-4 py-2 font-medium">{modelled ? t('Latest, modelled') : t('Latest')}</th>
            <th scope="col" className="px-4 py-2 font-medium">{t('Year')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line text-ink-2">
          {w.ranked.map((r, i) => (
            <tr key={r.place.id}>
              <td className="px-4 py-1.5 font-mono text-ink-3 tabular-nums">{i + 1}</td>
              <th scope="row" className="px-4 py-1.5 font-normal">
                <Link href={localePath(t.locale, placePath(r.place, w.spec.slug))} className="text-ink-1 hover:text-accent">{nameOf(r.place, t)}</Link>
              </th>
              <td className="px-4 py-1.5 font-mono tabular-nums">{formatValue(w.spec, r.v, t)}</td>
              <td className="px-4 py-1.5 font-mono text-ink-3 tabular-nums">{r.year}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A History measure around the world, at /map/<measure>: null when the slug is no measure. */
export async function WorldPage({ slug }: { slug: string }) {
  const found = await load(slug);
  if (!found) return null;
  const { w, text, copy } = found;
  const { t } = text;
  const origin = configuredOrigin() ?? publicOrigin(await headers());
  const index = localePath(text.locale, '/map');
  const path = worldPath(slug);
  const mode = worldOpen(w).mode;
  const places = w.biggest.map((r, i) => ({ label: nameOf(r.place, t), series: r.series, slot: i }));
  return (
    <SiteFrame t={t} path={path} trail={[{ href: index, label: t('On the map') }]}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs(origin, [
        { name: 'TAKIP', path: '/' },
        { name: t('On the map'), path: index },
        { name: copy.heading, path: localePath(text.locale, path) },
      ])) }} />
      <article>
        <ChartHeader kicker={{ href: localePath(text.locale, '/compare'), label: t('Compare countries') }} heading={copy.heading} lede={copy.lede}
          open={mode && mapHref({ layers: [], mode })} openLabel={t('Watch it change on the map')}
          hero={<MeasureChartCard id={`world-${slug}`} spec={w.spec} places={places} world={w.meta?.world} t={t} bands={false} worldStrong title={copy.heading} desc={copy.lede} />} />
        <div className="mt-16 grid gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:gap-16">
          <div>
            <Section title={t('Every country, by its latest figure')}>
              <Ranking w={w} text={text} />
            </Section>
            <Section title={t('Compare two countries')}>
              <Link href={localePath(t.locale, '/compare')} className={TEXT_LINK}>{t('Put any two countries side by side')}</Link>
            </Section>
            <Notes text={text} layers={['country-data-over-time']} notes={[
              ...indicatorNotes(w.spec, w.biggest.map(r => r.series), w.meta && { ...w.meta, world: undefined, rankYear: undefined }, t),
              t('The chart shows the {n} most populous countries with figures; the table ranks every country by its own latest year.', { n: w.biggest.length }),
            ]} />
          </div>
          <aside className="flex flex-col gap-10">
            <AdSlot slot={AD_SLOTS.page} variant="page" />
          </aside>
        </div>
      </article>
    </SiteFrame>
  );
}
