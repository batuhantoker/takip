'use client';

import type { ReactNode } from 'react';
import { cx, TRANSITION } from '@/components/ui/class-names';
import { Dot, type DotTone } from '@/components/ui/tag';
import { Figure } from '@/components/ui/figure';
import { useT } from '@/components/ui/use-t';
import { fullDate, stamp } from '@/components/panels/alerts/format';

/**
 * One alert. Like ListRow, but the title may run to two lines, the time sits on
 * the right, and quick actions surface on hover or focus. When selected the row
 * opens and its own detail carries the actions as labelled buttons instead.
 */
export function AlertRow({ tone, toneLabel, title, meta, ts, now, selected, onSelect, actions, children }: {
  tone: DotTone;
  toneLabel?: string;
  title: ReactNode;
  meta?: ReactNode;
  ts: number;
  now: number;
  selected: boolean;
  onSelect: () => void;
  /** IconButtons offered on hover; hidden while the row is open. */
  actions?: ReactNode;
  /** The open row's detail. */
  children?: ReactNode;
}) {
  const t = useT();
  return (
    <li className={cx(
      'group/row relative -mx-2 flex gap-3 rounded-control px-2 py-2',
      selected ? 'bg-surface-2' : 'hover:bg-surface-2 focus-within:bg-surface-2',
      TRANSITION,
    )}>
      {/* Same 16 px leading slot as ListRow, so titles line up with every other panel's rows. */}
      <span className="flex h-[18px] w-4 shrink-0 items-center justify-center">
        <Dot tone={tone} label={toneLabel && t(toneLabel)} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-3">
          <button
            type="button"
            data-alert-row
            onClick={onSelect}
            aria-expanded={selected}
            className={cx(
              'min-w-0 flex-1 scroll-mt-10 scroll-mb-2 text-left text-body font-medium text-ink-1 outline-none',
              'after:absolute after:inset-0 after:rounded-control focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-accent',
              !selected && 'line-clamp-2',
            )}
          >
            {title}
          </button>
          <time dateTime={new Date(ts).toISOString()} title={fullDate(ts, t)} className="shrink-0 pt-px text-meta text-ink-3">
            <Figure>{stamp(ts, now, t)}</Figure>
          </time>
        </div>
        {meta && <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-small text-ink-3">{meta}</div>}
        {selected && children && <div className="relative z-[1] mt-3">{children}</div>}
      </div>
      {actions && !selected && (
        <div className={cx(
          'absolute top-1 right-1 z-[2] flex min-w-14 items-center justify-end gap-0.5 rounded-control bg-surface-2 pl-1',
          'opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100 [@media(hover:none)]:hidden',
          TRANSITION,
        )}>
          {actions}
        </div>
      )}
    </li>
  );
}

/**
 * The quiet second line: parts joined by a middle dot. The source and the one
 * long part (a place, an area) give way first; short facts like "ends in 16 h" stay whole.
 */
export function Meta({ parts, grow = 1 }: { parts: ReactNode[]; grow?: number }) {
  return (
    <>
      {parts.map((p, i) => (p == null || p === false || p === '') ? null : (
        <span key={i} className={cx(
          'whitespace-nowrap',
          i === 0 ? 'max-w-[45%] min-w-0 shrink-0 truncate text-ink-2' : i === grow ? 'min-w-0 truncate' : 'shrink-0',
        )}>
          {i > 0 && <span aria-hidden className="mr-1.5 text-ink-4">·</span>}
          {p}
        </span>
      ))}
    </>
  );
}
