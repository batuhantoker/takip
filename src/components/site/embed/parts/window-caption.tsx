'use client';

import { LoaderCircle } from 'lucide-react';
import { useT } from '@/components/ui/use-t';
import type { WindowShown } from '../hooks/use-window-data';

const YEAR_MS = 365.25 * 86_400_000;

/** What a windowed embed shows, said plainly: how many of how many, from what magnitude, over when, from whom. */
export function WindowCaption({ shown }: { shown: WindowShown }) {
  const t = useT();
  const box = 'pointer-events-auto absolute top-3 left-3 z-20 max-w-[min(360px,calc(100%-24px))] rounded-float border border-line bg-surface-1 px-3 py-2 text-small text-ink-2 shadow-float';
  if (shown.status === 'loading') {
    return (
      <div role="status" className={`${box} flex items-center gap-2`}>
        <LoaderCircle aria-hidden className="size-3.5 shrink-0 animate-spin text-ink-3 motion-reduce:animate-none" strokeWidth={1.75} />
        {t('Loading earthquakes…')}
      </div>
    );
  }
  if (shown.status === 'failed') return <div role="status" className={box}>{t('The earthquake catalogue didn’t answer. Try again later.')}</div>;

  const { from, until, minMag, total } = shown;
  // A short window reads better as dates than as one year.
  const long = until - from >= 2 * YEAR_MS;
  const format = (at: number) => (long
    ? String(new Date(at).getUTCFullYear())
    : new Date(at).toLocaleDateString(t.intl, { timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric' }));
  const start = format(from);
  const end = format(until - 1);
  const when = start === end ? start : `${start}–${end}`;
  // Without a count, a full list is still only the largest.
  const capped = total !== null ? total > shown.shown : shown.shown >= shown.limit;
  return (
    <div role="status" className={box}>
      <p className="text-ink-1">
        {capped && total !== null
          ? t('The {shown} largest of {total, plural, one {# earthquake} other {# earthquakes}} from magnitude {mag}', { shown: shown.shown, total, mag: minMag })
          : capped
            ? t('The {shown} largest earthquakes from magnitude {mag}', { shown: shown.shown, mag: minMag })
            : t('{n, plural, one {# earthquake} other {# earthquakes}} from magnitude {mag}', { n: shown.shown, mag: minMag })}
      </p>
      <p className="text-ink-3">{when} · USGS</p>
    </div>
  );
}
