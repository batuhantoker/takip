import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowUpRight, Clock } from 'lucide-react';
import AdSlot from '@/components/shell/ads/ad-slot';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { msg, type Translate } from '@/lib/core/i18n/translator';
import { AD_SLOTS } from '@/lib/platform/ads';
import { embedPath, hasEmbed } from '@/lib/platform/site/embed';
import { openPath, pagePath, type LayerPage } from '@/lib/platform/site/layer-pages';
import type { LiveLine } from '@/lib/platform/site/live/lines';
import { LIVE_IMAGES, liveImagePath, type LiveImageId } from '@/lib/platform/site/live-images';
import { localePath } from '@/lib/platform/site/locale-path';
import { sectionIn, type SiteText } from '@/lib/platform/site/text';
import { TopicPlaces } from '@/components/site/places/topic-places';
import { FlightFinder } from './flight-finder';
import { LiveWindow } from './live-window';
import { LocalClock, SpokenText } from './local-clock';
import { MapWindow } from './map-window';
import { NearForecast, NearNow, NearProvider } from './near-now';
import { PageCard } from './page-card';
import { SECTION_ICON } from './section-icon';
import { LINK_BUTTON, Section } from './site-frame';
import { SpotLand, SpotSketch } from './spot-sketch';
import { WorldSketch } from './world-sketch';

const AS_OF = msg('Right now · as of {time}');

type Related = { page: LayerPage; image: string | null };

/** The page's latest picture of the Sun or the Earth, and when it was taken. */
export type LiveShot = { id: LiveImageId; taken: number | null };

function LiveImage({ t, shot }: { t: Translate; shot: LiveShot }) {
  const spec = LIVE_IMAGES[shot.id];
  return (
    <Section title={t('The latest image')}>
      <figure>
        {/* eslint-disable-next-line @next/next/no-img-element -- served from TAKIP's own address for image search */}
        <img src={liveImagePath(shot.id)} alt={t(spec.alt)} width={spec.size} height={spec.size} loading="lazy" decoding="async"
          className="aspect-square h-auto w-full max-w-[36rem] rounded-card border border-line bg-black" />
        <figcaption className="mt-3 max-w-[36rem] text-[13px] leading-relaxed text-ink-3">
          {shot.taken !== null
            ? t.parts(spec.taken, { time: <LocalClock key="t" at={shot.taken} intl={t.intl} className="font-mono tabular-nums" /> }) as ReactNode[]
            : t(spec.latest)}
        </figcaption>
      </figure>
    </Section>
  );
}

/**
 * A layer's public page: the picture of it on the map (a way into the full map), what it shows, where the data
 * comes from, what it can't tell you, places to start, and pages that go with it. Copy arrives already in the
 * reader's language.
 */
export function LayerArticle({ text, page, image, live, shot, related, more }: {
  text: SiteText;
  page: LayerPage;
  image: string | null;
  live: LiveLine | null;
  shot?: LiveShot | null;
  related: Related[];
  /** The page's own subjects, under the article: a History topic's events, a Space page's spacecraft. */
  more?: ReactNode;
}) {
  const t: Translate = text.t;
  const section = sectionIn(text, page.section);
  const Icon = SECTION_ICON[page.section];
  const open = openPath(page);
  const article = (
    <article>
      <header className="mt-8 grid grid-cols-1 items-center gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
        <div>
          <Link href={`${localePath(text.locale, '/map')}#${page.section}`}
            className={cx('inline-flex items-center gap-2 text-[13px] font-medium text-ink-3 hover:text-ink-1', FOCUS_RING)}>
            <Icon className="size-4" aria-hidden />{section.label}
          </Link>
          <h1 className="mt-3 text-4xl leading-[1.08] font-semibold tracking-[-0.02em] sm:text-5xl">{page.heading}</h1>
          <p className="mt-5 text-[17px] leading-relaxed text-ink-2">{page.lede}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={open} className={LINK_BUTTON.primary}>{t('Open the live map')}<ArrowUpRight className="size-4" aria-hidden /></a>
            {/* On a phone it would take a row of its own; the trail's "On the map" goes there too. */}
            <Link href={localePath(text.locale, '/map')} className={cx(LINK_BUTTON.secondary, 'max-sm:hidden')}>{t('Everything on the map')}</Link>
          </div>
          {page.findFlights && <FlightFinder className="mt-8" />}
          {page.nearNow && <NearNow className="mt-8" />}
          {live && (
            <div className="mt-8 rounded-card border border-line bg-surface-1 p-4">
              <p className="flex items-center gap-2 text-[12px] font-medium text-ink-3">
                <span className="size-1.5 rounded-full bg-green" aria-hidden />
                <span>{t.parts(AS_OF, { time: <LocalClock key="t" at={live.at} intl={t.intl} className="font-mono tabular-nums" /> }) as ReactNode[]}</span>
              </p>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-1"><SpokenText parts={live.text} intl={t.intl} /></p>
            </div>
          )}
        </div>
        {hasEmbed(page)
          // A client component's props travel with the page, so the sketch goes only where it is drawn.
          ? <LiveWindow src={localePath(text.locale, embedPath(page.slug))} href={open} image={image} alt={page.heading}
              cta={t('Open the live map')} explore={t('Explore it here')} badge={live ? t('Live') : undefined}
              fallback={image ? null : <WorldSketch points={(page.spots ?? []).map(s => s.view)} />} />
          : <MapWindow href={open} image={image} alt={page.heading} cta={t('Open the live map')} badge={live ? t('Live') : undefined}
              points={(page.spots ?? []).map(s => s.view)} priority />}
      </header>

      <div className="mt-20 grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:gap-16">
        <div>
          {shot && <LiveImage t={t} shot={shot} />}
          {page.nearNow === 'weather' && <NearForecast />}

          <Section title={t('What you see')}>
            <ul className="grid gap-3 sm:grid-cols-2">
              {page.shows.map(item => (
                <li key={item} className="rounded-card border border-line bg-surface-1 p-4 text-[14px] leading-relaxed text-ink-2">{item}</li>
              ))}
            </ul>
          </Section>

          <Section title={t('Where the data comes from')}>
            <ul className="divide-y divide-line rounded-card border border-line bg-surface-1">
              {page.sources.map((s, i) => (
                <li key={`${s.name}-${i}`} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:gap-6">
                  <span className="text-[14px] font-medium text-ink-1 sm:w-48 sm:flex-shrink-0">{s.name}</span>
                  <span className="text-[14px] leading-relaxed text-ink-2">{s.detail}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 flex gap-2.5 text-[14px]">
              <Clock className="mt-1 size-4 flex-shrink-0 text-ink-3" aria-hidden />
              <span>{page.freshness}</span>
            </p>
          </Section>

          {page.limits.length > 0 && (
            <Section title={t('Good to know')}>
              <ul className="flex flex-col gap-3 border-l-2 border-amber/50 pl-4">
                {page.limits.map(item => <li key={item} className="text-[14px] leading-relaxed">{item}</li>)}
              </ul>
            </Section>
          )}

          {page.places && <TopicPlaces text={text} topicId={page.places} />}
        </div>

        <aside className="flex flex-col gap-10">
          {page.spots && page.spots.length > 0 && (
            <section>
              <SpotLand />
              <h2 className="text-[15px] font-semibold text-ink-1">{t('Places to start')}</h2>
              <ul className="mt-4 flex flex-col gap-2">
                {page.spots.map(s => (
                  <li key={s.label}>
                    <a href={openPath(page, s.view)}
                      className={cx('group flex items-center gap-3 rounded-card border border-line bg-surface-1 p-2 pr-3 hover:border-line-strong', FOCUS_RING, TRANSITION)}>
                      <span className="block h-12 w-20 flex-shrink-0 overflow-hidden rounded-control border border-line">
                        <SpotSketch view={s.view} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-medium text-ink-1">{s.label}</span>
                        {s.note && <span className="block text-[12px] leading-snug text-ink-3">{s.note}</span>}
                      </span>
                      <ArrowUpRight className="size-4 flex-shrink-0 text-ink-3 group-hover:text-ink-1" aria-hidden />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <AdSlot slot={AD_SLOTS.page} variant="page" />
        </aside>
      </div>

      {more}

      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-ink-1">{t('Goes well with')}</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {related.map(r => (
              <PageCard key={r.page.slug} href={localePath(text.locale, pagePath(r.page))} image={r.image}
                title={r.page.heading} description={r.page.description} points={(r.page.spots ?? []).map(s => s.view)} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
  return page.nearNow ? <NearProvider kind={page.nearNow}>{article}</NearProvider> : article;
}
