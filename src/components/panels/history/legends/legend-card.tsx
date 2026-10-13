import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { IconButton } from '@/components/ui/button';
import { cx } from '@/components/ui/class-names';

/** The one card that sits over the History timeline: a legend, or deep time's story. */
export function LegendCard({ title, subtitle, meta, onClose, closeLabel, source, footer, wide, children }: {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Beside the title, such as the years a layer covers. */
  meta?: ReactNode;
  onClose: () => void;
  closeLabel: string;
  /** Quiet attribution at the bottom. */
  source?: ReactNode;
  /** Controls under a hairline, such as the story's chapter buttons. */
  footer?: ReactNode;
  /** Room for reading, as deep time's chapters need. */
  wide?: boolean;
  children?: ReactNode;
}) {
  return (
    <section className={cx(
      'flex max-h-[min(560px,calc(100vh-180px))] max-w-full flex-col overflow-hidden rounded-float border border-line bg-surface-1 shadow-float',
      wide ? 'w-[400px]' : 'w-[360px]',
    )}>
      <header className="flex shrink-0 items-start gap-2 pt-3 pr-2 pl-4">
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex min-w-0 items-baseline gap-2">
            <h3 className="min-w-0 truncate text-title font-semibold text-ink-1">{title}</h3>
            {meta && <span className="shrink-0 text-meta text-ink-3 tabular-nums">{meta}</span>}
          </div>
          {subtitle && <p className="flex min-w-0 items-center gap-1.5 truncate text-meta text-ink-3">{subtitle}</p>}
        </div>
        <IconButton size="sm" label={closeLabel} icon={X} onClick={onClose} tooltipSide="top" />
      </header>
      <div className="styled-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-3">
        {children}
        {source && <p className="mt-3 text-meta text-ink-3">{source}</p>}
      </div>
      {footer && <div className="flex shrink-0 items-center gap-1 border-t border-line px-2 py-1.5">{footer}</div>}
    </section>
  );
}
