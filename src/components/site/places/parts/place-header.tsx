import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { cx, FOCUS_RING } from '@/components/ui/class-names';
import { LiveWindow } from '@/components/site/pages/live-window';
import { WorldSketch } from '@/components/site/pages/world-sketch';
import { LINK_BUTTON } from '@/components/site/pages/site-frame';
import type { Translate } from '@/lib/core/i18n/translator';
import type { MapView } from '@/lib/platform/site/map-link';

/**
 * The top of a place page: where it belongs, the heading, the lede, a way onto the map, and what is true right now,
 * beside a close view of the place that turns into the live map there.
 */
export function PlaceHeader({ t, kicker, heading, lede, facts, open, embed, focus, image, live, secondary, hero, openLabel }: {
  t: Translate;
  kicker: { href: string; label: string };
  heading: string;
  lede: string;
  open: string;
  /** The live map the picture turns into, /embed?…. */
  embed: string;
  focus: MapView;
  image: string | null;
  /** The "right now" box; left out when nothing live came back. */
  live?: ReactNode;
  secondary?: { href: string; label: string };
  /** Shown instead of the live map, for a page the embed can't show (History's numbers). */
  hero?: ReactNode;
  /** Under the lede: the page's figures. */
  facts?: ReactNode;
  /** The map button's words, where "Open the live map" isn't what it does. */
  openLabel?: string;
}) {
  return (
    <header className="mt-8 grid grid-cols-1 items-center gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
      <div>
        <Link href={kicker.href} className={cx('text-[13px] font-medium text-ink-3 hover:text-ink-1', FOCUS_RING)}>{kicker.label}</Link>
        <h1 className="mt-3 text-4xl leading-[1.08] font-semibold tracking-[-0.02em] sm:text-5xl">{heading}</h1>
        <p className="mt-5 text-[17px] leading-relaxed text-ink-2">{lede}</p>
        {facts && <div className="mt-6">{facts}</div>}
        <div className="mt-8 flex flex-wrap gap-3">
          <a href={open} className={LINK_BUTTON.primary}>{openLabel ?? t('Open the live map')}<ArrowUpRight className="size-4" aria-hidden /></a>
          {secondary && <Link href={secondary.href} className={LINK_BUTTON.secondary}>{secondary.label}</Link>}
        </div>
        {live}
      </div>
      {hero ?? (
        <LiveWindow src={embed} href={open} image={image} alt={heading} cta={t('Open the live map')} explore={t('Explore it here')}
          badge={live ? t('Live') : undefined} fallback={<WorldSketch focus={{ ...focus, zoom: Math.min(focus.zoom, 9) }} />} />
      )}
    </header>
  );
}
