import Link from 'next/link';
import { cx, FOCUS_RING } from '@/components/ui/class-names';
import type { Translate } from '@/lib/core/i18n/translator';
import { localePath } from '@/lib/platform/site/locale-path';
import { crawlRel } from '@/lib/platform/site/meta';
import { feetFirst, heightShort, kindLabel } from '@/lib/platform/site/mountains/copy';
import { nameIn, type Mountain } from '@/lib/platform/site/mountains/data';
import { mountainMapPath, mountainPath } from '@/lib/platform/site/mountains/mountain-page';

/** The zoom a row's "On the map" lands at: close enough for the terrain to stand up. */
const JUMP_ZOOM = 12.5;

/**
 * Peaks as rows: the name leads to its page, the height and how far it is beside it. A row marks its peak on the
 * page's live map when pointed at (map-talk.ts), and "On the map" flies there. `current` is shown, not linked.
 */
export function PeakRows({ t, peaks, current, feet, columns = false }: {
  t: Translate;
  peaks: { mountain: Mountain; km?: number }[];
  current?: number;
  /** Heights in feet first, as the page's own peak gives them. */
  feet: boolean;
  columns?: boolean;
}) {
  return (
    <ol className={cx('grid gap-x-8', columns && 'sm:grid-cols-2')}>
      {peaks.map(({ mountain: p, km }) => {
        const name = nameIn(p.names, t.locale) ?? p.slug;
        const here = p.qid === current;
        const meta = [p.elev !== null ? heightShort(t, p.elev, feet || feetFirst(p)) : kindLabel(t, p), km !== undefined && t('{km, distance} away', { km })]
          .filter(Boolean).join(' · ');
        return (
          <li key={p.qid} data-map={`${p.lon},${p.lat}`} data-map-id={`Q${p.qid}`} data-map-label={name}
            className="flex items-baseline justify-between gap-3 border-b border-line py-2.5 last:border-0">
            <span className="min-w-0">
              {here
                ? <span className="font-semibold text-ink-1">{name}</span>
                : <Link href={localePath(t.locale, mountainPath(p.slug))} rel={crawlRel(p.indexed)}
                    className={cx('font-medium text-ink-1 hover:text-accent', FOCUS_RING)}>{name}</Link>}
              <span className="block text-[13px] text-ink-3 tabular-nums">{meta}</span>
            </span>
            <a href={mountainMapPath(p)} data-map-jump={JUMP_ZOOM} className={cx('shrink-0 text-[13px] text-ink-3 hover:text-ink-1', FOCUS_RING)}>{t('On the map')}</a>
          </li>
        );
      })}
    </ol>
  );
}
