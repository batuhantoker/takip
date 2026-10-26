import Link from 'next/link';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import type { Translate } from '@/lib/core/i18n/translator';
import { pagePath, type LayerPage } from '@/lib/platform/site/layer-pages';
import { localePath } from '@/lib/platform/site/locale-path';
import { WorldSketch } from '../world-sketch';

/** The section's next page, at the foot of this one, so a reader who got to the end has somewhere to go on to. */
export function NextPage({ t, page, section, image }: { t: Translate; page: LayerPage; section: string; image: string | null }) {
  return (
    <Link href={localePath(t.locale, pagePath(page))}
      className={cx('group mt-16 grid grid-cols-1 items-center gap-5 rounded-card border border-line bg-surface-1 p-3 hover:border-line-strong sm:grid-cols-[18rem_minmax(0,1fr)] sm:gap-8', FOCUS_RING, TRANSITION)}>
      <span className="block aspect-[16/9] overflow-hidden rounded-control border border-line">
        {image
          // eslint-disable-next-line @next/next/no-img-element -- see map-window.tsx
          ? <img src={image} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
          : <WorldSketch points={(page.spots ?? []).map(s => s.view)} />}
      </span>
      <span className="block px-1 pb-2 sm:p-0 sm:pr-6">
        <span className="block text-[13px] leading-5 text-ink-3">{t('Up next')} · {section}</span>
        <span className={cx('mt-1 block text-[22px] leading-7 font-semibold tracking-[-0.01em] text-ink-1 group-hover:text-accent', TRANSITION)}>{page.heading}</span>
        <span className="mt-2 line-clamp-2 block text-[15px] leading-6 text-ink-2">{page.lede}</span>
      </span>
    </Link>
  );
}
