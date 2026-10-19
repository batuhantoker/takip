import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import AdSlot from '@/components/shell/ads/ad-slot';
import { MapWindow } from '@/components/site/pages/map-window';
import { PageCard } from '@/components/site/pages/page-card';
import { SECTION_ICON } from '@/components/site/pages/section-icon';
import { LINK_BUTTON, SiteFrame } from '@/components/site/pages/site-frame';
import { requestLocale } from '@/lib/core/i18n/request';
import { AD_SLOTS } from '@/lib/platform/ads';
import { availablePages, pagePath, SECTIONS } from '@/lib/platform/site/layer-pages';
import { localePath } from '@/lib/platform/site/locale-path';
import { readingImage, readingMetadata } from '@/lib/platform/site/meta';
import { shotUrl } from '@/lib/platform/site/shots';
import { pageIn, sectionIn, siteText } from '@/lib/platform/site/text';

/** The picture the index leads with: the busiest live layer. */
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
  return (
    <SiteFrame t={t} path="/map">
      <header className="mt-8 grid items-center gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
        <div>
          <p className="text-[13px] font-medium text-ink-3">{t('On the map')}</p>
          <h1 className="mt-3 text-4xl leading-[1.08] font-semibold tracking-[-0.02em] sm:text-5xl">{t('Everything on the map')}</h1>
          <p className="mt-5 text-[17px] leading-relaxed text-ink-2">
            {t('Each layer is a stream of public data drawn where it happens. Switch on as many as you like and they share one map. Here is each one, with where its data comes from and what it can and can’t tell you.')}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/" className={LINK_BUTTON.primary}>{t('Open the live map')}<ArrowUpRight className="size-4" aria-hidden /></Link>
          </div>
          <nav aria-label={t('Sections')} className="mt-8 flex flex-wrap gap-2">
            {SECTIONS.filter(s => pages.some(p => p.section === s.id)).map(({ id }) => {
              const Icon = SECTION_ICON[id];
              return (
                <a key={id} href={`#${id}`} className="inline-flex h-8 items-center gap-1.5 rounded-control border border-line bg-surface-1 px-2.5 text-[13px] text-ink-2 hover:text-ink-1">
                  <Icon className="size-3.5" aria-hidden />{sectionIn(text, id).label}
                </a>
              );
            })}
          </nav>
        </div>
        <MapWindow href="/" image={shotUrl(HERO)} alt={t('Everything on the map')} cta={t('Open the live map')} badge={t('Live')} priority />
      </header>
      {SECTIONS.map(({ id }, i) => {
        const section = sectionIn(text, id);
        const Icon = SECTION_ICON[id];
        const inSection = pages.filter(p => p.section === id);
        if (!inSection.length) return null;
        return (
          <section key={id} id={id} className="mt-20 scroll-mt-8">
            <h2 className="flex items-center gap-2.5 text-[22px] font-semibold tracking-[-0.01em] text-ink-1">
              <Icon className="size-5 text-ink-3" aria-hidden />{section.label}
            </h2>
            <p className="mt-1.5 text-[15px] text-ink-3">{section.blurb}</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {inSection.map(p => (
                <PageCard key={p.slug} href={localePath(text.locale, pagePath(p))} image={shotUrl(p.slug)}
                  title={p.heading} description={p.description} points={(p.spots ?? []).map(s => s.view)} />
              ))}
            </div>
            {i === 2 && <AdSlot slot={AD_SLOTS.page} variant="page" className="mt-12" />}
          </section>
        );
      })}
    </SiteFrame>
  );
}
