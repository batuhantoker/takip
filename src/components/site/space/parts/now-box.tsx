import type { ReactNode } from 'react';
import { LocalClock } from '@/components/site/pages/local-clock';
import { msg, type Translate } from '@/lib/core/i18n/translator';

const AS_OF = msg('Right now · as of {time}');

/** What is true now, with the moment it was true for; the server renders the time in UTC, the browser in the reader's zone. */
export function NowBox({ t, at, title, children, className = '' }: { t: Translate; at: number; title?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-card border border-line bg-surface-1 p-4 ${className}`}>
      <p className="flex items-center gap-2 text-[12px] font-medium text-ink-3">
        <span className="size-1.5 rounded-full bg-green" aria-hidden />
        <span>{t.parts(AS_OF, { time: <LocalClock key="t" at={at} intl={t.intl} className="font-mono tabular-nums" /> }) as ReactNode[]}</span>
      </p>
      {title && <h2 className="mt-2 text-[17px] leading-snug font-semibold text-ink-1">{title}</h2>}
      <div className="mt-2 text-[15px] leading-relaxed text-ink-1">{children}</div>
    </div>
  );
}
