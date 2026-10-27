import Link from 'next/link';
import type { ReactNode } from 'react';
import { LocalClock } from '@/components/site/pages/local-clock';
import { Section } from '@/components/site/pages/site-frame';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { msg, type Translate } from '@/lib/core/i18n/translator';
import { localePath } from '@/lib/platform/site/locale-path';
import { bigKm, bodyName } from '@/lib/platform/site/space/copy';
import type { SpaceNow } from '@/lib/platform/site/space/overview';
import { planetPath } from '@/lib/platform/site/space/planets';
import { lightTime } from '@/lib/space/format';

const UPDATED = msg('Updated {time}');

function Figure({ href, label, value, note }: { href: string; label: string; value: string; note: string }) {
  return (
    <li className="border-t border-line">
      <Link href={href} className={cx('group block py-4', FOCUS_RING)}>
        <span className={cx('block text-[13px] leading-5 text-ink-3 group-hover:text-ink-1', TRANSITION)}>{label}</span>
        <span className="mt-1 block font-mono text-[26px] leading-8 font-medium tracking-[-0.01em] text-ink-1 tabular-nums">{value}</span>
        <span className="mt-1 block text-[13px] leading-5 text-ink-2">{note}</span>
      </Link>
    </li>
  );
}

/** The farthest craft, Webb, and the nearest planet: three numbers that are only true today. */
export function SpaceFigures({ t, now }: { t: Translate; now: SpaceNow }) {
  const meta = t.parts(UPDATED, { time: <LocalClock key="t" at={now.at} intl={t.intl} className="font-mono tabular-nums" /> }) as ReactNode[];
  return (
    <Section title={t('Right now')} meta={<span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-green" aria-hidden />{meta}</span>}>
      <ul className="grid grid-cols-1 sm:grid-cols-3 sm:gap-x-10">
        {now.farthest && (
          <Figure href={localePath(t.locale, '/spacecraft/voyager-1')} label={t('Voyager 1, the farthest spacecraft')}
            value={bigKm(t, now.farthest.earthKm)} note={t('Its radio signal takes {light} to reach Earth.', { light: lightTime(now.farthest.lightSec, t) })} />
        )}
        {now.webb && (
          <Figure href={localePath(t.locale, '/spacecraft/james-webb-space-telescope')} label={t('The James Webb Space Telescope')}
            value={bigKm(t, now.webb.earthKm)} note={t('Four times farther than the Moon, on the night side of Earth.')} />
        )}
        {now.nearest && (
          <Figure href={localePath(t.locale, planetPath(now.nearest.card.planet))} label={t('Nearest planet today: {planet}', { planet: bodyName(t, now.nearest.card.planet.key) })}
            value={bigKm(t, now.nearest.now.earthKm)} note={t('Its light takes {light} to reach us.', { light: lightTime(now.nearest.now.lightSec, t) })} />
        )}
      </ul>
    </Section>
  );
}
