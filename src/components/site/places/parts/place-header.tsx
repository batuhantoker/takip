import type { ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { cx } from '@/components/ui/class-names';
import { LiveWindow } from '@/components/site/pages/live-window';
import { WorldSketch } from '@/components/site/pages/world-sketch';
import { LINK_BUTTON } from '@/components/site/pages/site-frame';
import type { Translate } from '@/lib/core/i18n/translator';
import type { MapView } from '@/lib/platform/site/map-link';

/** The close view of the place that turns into the live map there; `mode` as LiveWindow takes it. */
export function PlaceMap({ t, heading, open, embed, focus, image, live, mode }: {
  t: Translate;
  heading: string;
  open: string;
  embed: string;
  focus: MapView;
  image: string | null;
  live: boolean;
  mode?: 'header' | 'phone' | 'beside';
}) {
  return (
    <LiveWindow src={embed} href={open} image={image} alt={heading} cta={t('Open the live map')} explore={t('Explore it here')} mode={mode}
      badge={live ? t('Live') : undefined} fallback={<WorldSketch focus={{ ...focus, zoom: Math.min(focus.zoom, 9) }} />} />
  );
}

/**
 * The top of a place page, under its tabs: the heading, a short lede, the figures it leads with, a way onto the map, and
 * what is true right now in words, beside a close view of the place that turns into the live map there. With
 * `mapBeside`, a wide screen has the map by the body instead, and the header is its text alone.
 */
export function PlaceHeader({ t, heading, lede, facts, figures, open, embed, focus, image, live, hero, openLabel, mapBeside }: {
  t: Translate;
  heading: string;
  lede: string;
  open: string;
  /** The live map the picture turns into, /embed?…. */
  embed: string;
  focus: MapView;
  image: string | null;
  /** The "right now" sentences; left out when nothing live came back. */
  live?: ReactNode;
  /** Shown instead of the live map, for a page the embed can't show (History's numbers). */
  hero?: ReactNode;
  /** Under the lede: the page's own facts. */
  facts?: ReactNode;
  /** The figures the page leads with. */
  figures?: ReactNode;
  /** The map button's words, where "Open the live map" isn't what it does. */
  openLabel?: string;
  mapBeside?: boolean;
}) {
  const beside = mapBeside && !hero;
  return (
    <header className={cx('mt-10 grid grid-cols-1 items-start gap-10', !beside && 'lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-14')}>
      <div className={beside ? 'max-w-[46rem]' : undefined}>
        <h1 className="text-[36px] leading-[40px] font-semibold tracking-[-0.02em] sm:text-[48px] sm:leading-[52px]">{heading}</h1>
        <p className="mt-4 max-w-[40rem] text-[17px] leading-[26px] text-ink-2">{lede}</p>
        {figures}
        {facts && <div className="mt-6">{facts}</div>}
        <div className="mt-8 flex flex-wrap gap-3">
          <a href={open} className={LINK_BUTTON.primary}>{openLabel ?? t('Open the live map')}<ArrowUpRight className="size-4" aria-hidden /></a>
        </div>
        {live}
      </div>
      {hero ?? (beside
        ? <div className="lg:hidden"><PlaceMap t={t} heading={heading} open={open} embed={embed} focus={focus} image={image} live={!!live} mode="phone" /></div>
        : <PlaceMap t={t} heading={heading} open={open} embed={embed} focus={focus} image={image} live={!!live} />)}
    </header>
  );
}
