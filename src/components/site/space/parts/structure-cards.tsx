import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import type { Translate } from '@/lib/core/i18n/translator';
import { localePath } from '@/lib/platform/site/locale-path';
import { skyPath } from '@/lib/platform/site/space/sky-pages';
import { structureHref, type StructurePage } from '@/lib/platform/site/space/structure-pages';
import { lightYears } from './journey-ladder';

/** Structures have no telescope picture of their own: each is its name, what it is and how far, leading to its page. */
export function StructureCards({ t, items }: { t: Translate; items: StructurePage[] }) {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(p => (
        <li key={p.id} className="relative">
          <Link href={localePath(t.locale, skyPath(p.id))}
            className={cx('group block rounded-card border border-line bg-surface-1 px-4 py-3.5 pr-16 hover:border-line-strong', FOCUS_RING, TRANSITION)}>
            <span className={cx('block text-[15px] leading-6 font-medium text-ink-1 group-hover:text-accent', TRANSITION)}>{t(p.feature.name)}</span>
            <span className="mt-0.5 block text-[13px] leading-5 text-ink-3">
              {t(p.feature.subtitle, p.feature.subtitleVars)} · <span className="font-mono whitespace-nowrap text-ink-2 tabular-nums">{lightYears(t, p.ly)}</span>
            </span>
          </Link>
          <a href={structureHref(p)} aria-label={t('Fly to {name} in 3D', { name: t(p.feature.name) })}
            className={cx('absolute top-3 right-3 inline-flex h-7 items-center gap-1 rounded-control bg-surface-3 px-2 text-[12px] font-medium text-ink-1 hover:bg-accent hover:text-on-accent', FOCUS_RING, TRANSITION)}>
            3D<ArrowUpRight className="size-3.5" aria-hidden />
          </a>
        </li>
      ))}
    </ul>
  );
}
