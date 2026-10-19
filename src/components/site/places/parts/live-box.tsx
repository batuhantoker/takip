import type { ReactNode } from 'react';
import { LocalClock } from '@/components/site/pages/local-clock';
import { msg, type Translate } from '@/lib/core/i18n/translator';

const AS_OF = msg('Right now · as of {time}');

/** What a feed said when the page was rendered, stamped with the time it was true for. */
export function LiveBox({ t, at, label = AS_OF, children }: { t: Translate; at: number; label?: string; children: ReactNode }) {
  return (
    <div className="mt-8 rounded-card border border-line bg-surface-1 p-4">
      <p className="flex items-center gap-2 text-[12px] font-medium text-ink-3">
        <span className="size-1.5 rounded-full bg-green" aria-hidden />
        <span>{t.parts(label, { time: <LocalClock key="t" at={at} intl={t.intl} className="font-mono tabular-nums" /> }) as ReactNode[]}</span>
      </p>
      <div className="mt-2 flex flex-col gap-2 text-[15px] leading-relaxed text-ink-1">{children}</div>
    </div>
  );
}
