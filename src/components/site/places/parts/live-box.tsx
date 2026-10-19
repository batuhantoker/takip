import type { ReactNode } from 'react';
import { msg, type Translate } from '@/lib/core/i18n/translator';

const AS_OF = msg('Right now · as of {time}');

export const utcClock = (t: Translate, at: number) =>
  `${new Intl.DateTimeFormat(t.intl, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' }).format(at)} UTC`;

/** What a feed said when the page was rendered, stamped with the time it was true for. */
export function LiveBox({ t, at, children }: { t: Translate; at: number; children: ReactNode }) {
  return (
    <div className="mt-8 rounded-card border border-line bg-surface-1 p-4">
      <p className="flex items-center gap-2 text-[12px] font-medium text-ink-3">
        <span className="size-1.5 rounded-full bg-green" aria-hidden />
        <span>{t.parts(AS_OF, { time: <time key="t" className="font-mono tabular-nums">{utcClock(t, at)}</time> }) as ReactNode[]}</span>
      </p>
      <div className="mt-2 flex flex-col gap-2 text-[15px] leading-relaxed text-ink-1">{children}</div>
    </div>
  );
}
