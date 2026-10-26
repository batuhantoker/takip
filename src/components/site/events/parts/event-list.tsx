import Link from 'next/link';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import type { Translate } from '@/lib/core/i18n/translator';
import { eventName, kindLabel, magnitudeRow, refWhen } from '@/lib/platform/site/events/copy';
import type { EventRef } from '@/lib/platform/site/events/event-page';
import { eventPath } from '@/lib/platform/site/events/sitemap';
import { localePath } from '@/lib/platform/site/locale-path';
import { crawlRel } from '@/lib/platform/site/meta';

/** Other events as links to their pages: name, then date, kind and the source's count where it has one. */
export function EventList({ t, events, more = 0, columns = false }: { t: Translate; events: EventRef[]; more?: number; columns?: boolean }) {
  return (
    <>
      <ul className={cx('grid grid-cols-1 border-t border-line', columns && 'sm:grid-cols-2 sm:gap-x-10')}>
        {events.map(r => {
          const mag = magnitudeRow(t, r);
          return (
            <li key={r.slug} className="border-b border-line">
              <Link href={localePath(t.locale, eventPath(r.slug))} rel={crawlRel(r.indexed)} className={cx('group block py-2.5', FOCUS_RING)}>
                <span className={cx('block text-[15px] leading-6 font-medium text-ink-1 group-hover:text-accent', TRANSITION)}>{eventName(t, r)}</span>
                <span className="mt-0.5 block text-[13px] leading-5 text-ink-3">
                  {[refWhen(t, r), kindLabel(t, r.kind), mag && `${mag.label} ${mag.value}`].filter(Boolean).join(' · ')}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {more > 0 && <p className="mt-3 text-[13px] text-ink-3">{t('and {n} more', { n: more.toLocaleString(t.intl) })}</p>}
    </>
  );
}
