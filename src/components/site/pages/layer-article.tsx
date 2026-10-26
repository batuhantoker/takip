import type { ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import AdSlot from '@/components/shell/ads/ad-slot';
import { cx } from '@/components/ui/class-names';
import { TopicPlaces } from '@/components/site/places/topic-places';
import { AD_SLOTS } from '@/lib/platform/ads';
import { embedPath, hasEmbed } from '@/lib/platform/site/embed';
import { availablePages, openPath, pagePath, type LayerPage } from '@/lib/platform/site/layer-pages';
import type { LiveLine } from '@/lib/platform/site/live/lines';
import { localePath } from '@/lib/platform/site/locale-path';
import { shotUrl } from '@/lib/platform/site/shots';
import { pageIn, sectionIn, type SiteText } from '@/lib/platform/site/text';
import { FlightFinder } from './flight-finder';
import { LayerRows } from './layer-rows';
import { LiveWindow } from './live-window';
import { MapWindow } from './map-window';
import { NearForecast, NearNow, NearProvider } from './near-now';
import { PageTabs } from './page-tabs';
import { GoodToKnow, LiveImage, LiveNow, SpotRows, type LiveShot } from './parts/layer-parts';
import { NextPage } from './parts/next-page';
import { Bullets, LINK_BUTTON, Section } from './site-frame';
import { WorldSketch } from './world-sketch';

export type { LiveShot } from './parts/layer-parts';

/**
 * A layer's public page: its section's other layers as tabs, the heading with what the feed says now, and beside them
 * on a wide screen the live map, which the places to start mark and fly. Then what it shows, the section's next page
 * and the pages that go with it, closed by what it can't tell you; the footer credits its sources. A layer the small
 * map can't show (another view, a panel) leads with its picture instead. Copy arrives already in the reader's language.
 */
export function LayerArticle({ text, page, image, live, shot, related, more }: {
  text: SiteText;
  page: LayerPage;
  image: string | null;
  live: LiveLine | null;
  shot?: LiveShot | null;
  related: LayerPage[];
  /** The page's own subjects, under the article: a History topic's events, a Space page's spacecraft. */
  more?: ReactNode;
}) {
  const { t } = text;
  const open = openPath(page);
  const beside = hasEmbed(page);
  const badge = live ? t('Live') : undefined;
  const points = (page.spots ?? []).map(s => s.view);
  const section = sectionIn(text, page.section).label;
  const siblings = availablePages().filter(p => p.section === page.section).map(p => pageIn(text, p));
  const next = siblings.length > 1 ? siblings[(siblings.findIndex(p => p.slug === page.slug) + 1) % siblings.length] : undefined;
  const map = (mode: 'phone' | 'beside') => (
    <LiveWindow src={localePath(text.locale, embedPath(page.slug))} href={open} image={image} alt={page.heading} mode={mode}
      cta={t('Open the live map')} explore={t('Explore it here')} badge={badge}
      // A client component's props travel with the page, so the sketch goes only where it is drawn.
      fallback={image ? null : <WorldSketch points={points} />} />
  );

  const header = (
    <header className={cx('mt-10', !beside && 'grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-14')}>
      <div className="max-w-[46rem]">
        <h1 className="text-[36px] leading-[40px] font-semibold tracking-[-0.02em] sm:text-[48px] sm:leading-[52px]">{page.heading}</h1>
        <p className="mt-4 max-w-[40rem] text-[17px] leading-[26px] text-ink-2">{page.lede}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href={open} className={LINK_BUTTON.primary}>{t('Open the live map')}<ArrowUpRight className="size-4" aria-hidden /></a>
        </div>
        {page.findFlights && <FlightFinder className="mt-8" />}
        {page.nearNow && <NearNow className="mt-8" />}
        {live && <LiveNow t={t} live={live} />}
      </div>
      {!beside && <MapWindow href={open} image={image} alt={page.heading} cta={t('Open the live map')} badge={badge} points={points} priority />}
    </header>
  );

  const body = (
    <>
      <SpotRows t={t} page={page} />
      {shot && <LiveImage t={t} shot={shot} />}
      {page.nearNow === 'weather' && <NearForecast />}
      <Section title={t('What you see')}>
        <div className="max-w-[46rem]"><Bullets items={page.shows} /></div>
      </Section>
      {page.places && <TopicPlaces text={text} topicId={page.places} />}
    </>
  );

  const article = (
    <article>
      <PageTabs label={section} tabs={siblings.map(p => ({
        href: localePath(text.locale, pagePath(p)), label: p.heading, here: p.slug === page.slug,
      }))} />
      {beside ? (
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:gap-16">
          <div>
            {header}
            <div className="mt-8 lg:hidden">{map('phone')}</div>
            <div className="mt-14">{body}</div>
          </div>
          <aside className="flex flex-col gap-10 lg:pt-10">
            {/* Fills the column down to the ad, so the map stays in view beside the whole body. */}
            <div className="hidden flex-1 lg:block">
              <div className="sticky top-14">{map('beside')}</div>
            </div>
            <AdSlot slot={AD_SLOTS.page} variant="page" />
          </aside>
        </div>
      ) : (
        <>
          {header}
          <div className="mt-14">{body}</div>
          <AdSlot slot={AD_SLOTS.page} variant="page" className="mt-14 block" />
        </>
      )}

      {more}

      {next && <NextPage t={t} page={next} section={section} image={shotUrl(next.slug)} />}
      {related.length > 0 && (
        <Section title={t('Goes well with')}>
          <LayerRows t={t} pages={related} />
        </Section>
      )}
      <GoodToKnow t={t} page={page} />
    </article>
  );
  return page.nearNow ? <NearProvider kind={page.nearNow}>{article}</NearProvider> : article;
}
