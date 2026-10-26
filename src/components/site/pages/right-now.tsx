import Link from 'next/link';
import type { ReactNode } from 'react';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { msg } from '@/lib/core/i18n/translator';
import { availablePages, pagePath } from '@/lib/platform/site/layer-pages';
import { liveLine } from '@/lib/platform/site/live/live-line';
import { localePath } from '@/lib/platform/site/locale-path';
import { pageIn, type SiteText } from '@/lib/platform/site/text';
import { LocalClock, SpokenText } from './local-clock';

const AS_OF = msg('Right now · as of {time}');

/**
 * What the layers with a live line say at this moment, a line each leading to its page. Async: render it inside
 * Suspense, so a slow feed never holds up the rest of the page.
 */
export async function RightNow({ text, className }: { text: SiteText; className?: string }) {
  const { t } = text;
  const lines = (await Promise.all(availablePages().filter(p => p.live).map(async p => ({ page: pageIn(text, p), live: await liveLine(p.live!, t) }))))
    .flatMap(({ page, live }) => (live ? [{ page, live }] : []));
  if (!lines.length) return null;
  const at = Math.min(...lines.map(l => l.live.at));
  return (
    <section className={className}>
      <p className="flex items-center gap-2 text-[11px] leading-[14px] text-ink-3">
        <span className="size-1.5 rounded-full bg-green" aria-hidden />
        <span>{t.parts(AS_OF, { time: <LocalClock key="t" at={at} intl={t.intl} className="font-mono tabular-nums" /> }) as ReactNode[]}</span>
      </p>
      <ul className="mt-2 flex flex-col gap-2 text-[14px] leading-[22px]">
        {lines.map(({ page, live }) => (
          <li key={page.slug}>
            <Link href={localePath(t.locale, pagePath(page))} className={cx('group block text-ink-2', FOCUS_RING)}>
              <span className={cx('font-medium text-ink-1 group-hover:text-accent', TRANSITION)}>{page.heading}</span>
              {' · '}<SpokenText parts={live.text} intl={t.intl} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
