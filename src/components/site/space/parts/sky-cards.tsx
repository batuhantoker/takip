import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import type { Translate } from '@/lib/core/i18n/translator';
import { localePath } from '@/lib/platform/site/locale-path';
import { bigKm, bodyName } from '@/lib/platform/site/space/copy';
import { deepSkyHref } from '@/lib/platform/site/space/journey';
import type { PlanetCard } from '@/lib/platform/site/space/overview';
import { planetPath } from '@/lib/platform/site/space/planets';
import { skyPath } from '@/lib/platform/site/space/sky-pages';
import { deepSkyImage, deepSkyUrl, type DeepSkyObject } from '@/lib/space/deep/deep-sky';
import { lightTime } from '@/lib/space/format';
import { lightYears } from './journey-ladder';
import { PictureCredit, SpaceImage } from './space-image';

const title = cx('mt-3 block text-[15px] leading-6 font-medium text-ink-1 group-hover:text-accent', TRANSITION);

/** Each planet's picture with how far it is from Earth today, leading to its page. */
export function PlanetCards({ t, cards }: { t: Translate; cards: PlanetCard[] }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-4">
      {cards.map(({ planet, now, picture }) => (
        <li key={planet.key}>
          <Link href={localePath(t.locale, planetPath(planet))} className={cx('group block', FOCUS_RING)}>
            <SpaceImage t={t} picture={picture} alt={bodyName(t, planet.key)} ratio="aspect-square" />
            <span className={title}>{bodyName(t, planet.key)}</span>
            {now && (
              <>
                <span className="mt-0.5 block font-mono text-[13px] leading-5 text-ink-2 tabular-nums">{bigKm(t, now.earthKm)}</span>
                <span className="block text-[12px] leading-5 text-ink-3">{t('{light} of light', { light: lightTime(now.lightSec, t) })}</span>
              </>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Deep-sky pictures leading to each object's page, with a way straight into the 3D view on the picture's corner. */
export function DeepSkyCards({ t, items, columns = 'sm:grid-cols-3' }: { t: Translate; items: DeepSkyObject[]; columns?: string }) {
  return (
    <ul className={cx('grid grid-cols-2 gap-x-4 gap-y-7', columns)}>
      {items.map(d => {
        const img = deepSkyImage(d.id);
        const picture = img ? { src: deepSkyUrl(d.id), contain: false, credit: img.credit, href: img.page } : null;
        return (
          <li key={d.id} className="relative">
            <Link href={localePath(t.locale, skyPath(d.id))} className={cx('group block', FOCUS_RING)}>
              <SpaceImage t={t} picture={picture} alt={t(d.name)} ratio="aspect-[4/3]" />
              <span className={title}>{t(d.name)}</span>
              <span className="mt-0.5 block text-[13px] leading-5 text-ink-3">
                {t(d.subtitle)} · <span className="font-mono whitespace-nowrap text-ink-2 tabular-nums">{lightYears(t, d.ly)}</span>
              </span>
            </Link>
            <a href={deepSkyHref(d)} aria-label={t('Fly to {name} in 3D', { name: t(d.name) })}
              className={cx('absolute top-2 right-2 inline-flex h-7 items-center gap-1 rounded-control bg-black/70 px-2 text-[12px] font-medium text-ink-1 backdrop-blur-sm hover:bg-accent hover:text-on-accent', FOCUS_RING, TRANSITION)}>
              3D<ArrowUpRight className="size-3.5" aria-hidden />
            </a>
            {picture && <PictureCredit t={t} picture={picture} />}
          </li>
        );
      })}
    </ul>
  );
}
