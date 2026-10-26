import Link from 'next/link';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import type { Translate } from '@/lib/core/i18n/translator';
import { openPath, pagePath, type LayerPage } from '@/lib/platform/site/layer-pages';
import { localePath } from '@/lib/platform/site/locale-path';

/**
 * Layer pages as a list split by hairlines: each row leads to its page, with a way straight onto the map beside it.
 * `findBy` gives each row the text CatalogFilter matches.
 */
export function LayerRows({ t, pages, className = 'sm:grid-cols-2 lg:grid-cols-3', findBy }: {
  t: Translate;
  pages: LayerPage[];
  className?: string;
  findBy?: (page: LayerPage) => string;
}) {
  return (
    <ul className={cx('grid grid-cols-1 border-t border-line sm:gap-x-10', className)}>
      {pages.map(p => (
        <li key={p.slug} data-catalog-item={findBy?.(p)} className="group/row relative border-b border-line">
          <Link href={localePath(t.locale, pagePath(p))} className={cx('group block py-3.5 pr-24', FOCUS_RING)}>
            <span className={cx('block text-[15px] leading-6 font-medium text-ink-1 group-hover:text-accent', TRANSITION)}>{p.heading}</span>
            <span className="mt-0.5 line-clamp-2 text-[13px] leading-5 text-ink-3">{p.description}</span>
          </Link>
          {/* Where a pointer can hover, only on the row it is over: the same words under every row would be noise. */}
          <a href={openPath(p)} className={cx('absolute top-4 right-0 text-[12px] leading-5 text-ink-3 hover:text-ink-1 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/row:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100', FOCUS_RING, TRANSITION)}>{t('On the map')}</a>
        </li>
      ))}
    </ul>
  );
}
