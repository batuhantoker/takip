import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { CatalogFilter } from '@/components/site/pages/catalog-filter';
import { LayerCatalog } from '@/components/site/pages/layer-catalog';
import { LiveWindow } from '@/components/site/pages/live-window';
import { PageTabs } from '@/components/site/pages/page-tabs';
import { RightNow } from '@/components/site/pages/right-now';
import { LINK_BUTTON, SiteFrame } from '@/components/site/pages/site-frame';
import { WorldSketch } from '@/components/site/pages/world-sketch';
import { requestLocale } from '@/lib/core/i18n/request';
import { embedPath } from '@/lib/platform/site/embed';
import { availablePages, SECTIONS } from '@/lib/platform/site/layer-pages';
import { localePath } from '@/lib/platform/site/locale-path';
import { readingImage, readingMetadata } from '@/lib/platform/site/meta';
import { shotUrl } from '@/lib/platform/site/shots';
import { pageIn, sectionIn, siteText } from '@/lib/platform/site/text';

/** The live map the index leads with: the busiest layer, whose embed flies to the visitor. */
const HERO = 'flight-tracker';

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await siteText((await requestLocale()).locale);
  return readingMetadata({
    locale, path: '/map', image: readingImage('map', locale),
    title: t('Everything on the map: flights, ships, satellites and more'),
    description: t('Every live layer on TAKIP, with what it shows, where the data comes from and how fresh it is: aircraft, ships, satellites, cameras, weather, quakes and more.'),
  });
}

export default async function MapIndexPage() {
  const text = await siteText((await requestLocale()).locale);
  const { t } = text;
  const pages = availablePages().map(p => pageIn(text, p));
  const sections = SECTIONS.map(({ id }) => ({ ...sectionIn(text, id), pages: pages.filter(p => p.section === id) })).filter(s => s.pages.length);
  const image = shotUrl(HERO);
  return (
    <SiteFrame t={t} path="/map">
      <PageTabs label={t('Sections')} tabs={sections.map(s => ({ href: `#${s.id}`, label: s.label }))} />
      <header className="mt-10 grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-14">
        <div>
          <h1 className="text-[36px] leading-[40px] font-semibold tracking-[-0.02em] sm:text-[48px] sm:leading-[52px]">{t('Everything on the map')}</h1>
          <p className="mt-4 max-w-[40rem] text-[17px] leading-[26px] text-ink-2">
            {t('Each layer is a stream of public data drawn where it happens. Switch on as many as you like and they share one map. Here is each one, with where its data comes from and what it can and can’t tell you.')}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/" className={LINK_BUTTON.primary}>{t('Open the live map')}<ArrowUpRight className="size-4" aria-hidden /></Link>
          </div>
          <Suspense fallback={null}><RightNow text={text} className="mt-8 max-w-[40rem]" /></Suspense>
        </div>
        <LiveWindow src={localePath(text.locale, embedPath(HERO))} href="/" image={image} alt={t('Everything on the map')}
          cta={t('Open the live map')} explore={t('Explore it here')} badge={t('Live')} fallback={image ? null : <WorldSketch />} />
      </header>
      <CatalogFilter total={pages.length} className="mt-14 max-w-[28rem]" />
      <LayerCatalog text={text} sections={sections} />
    </SiteFrame>
  );
}
