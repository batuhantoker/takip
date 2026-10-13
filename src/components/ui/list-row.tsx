'use client';

import type { MouseEventHandler, ReactNode } from 'react';
import { cx, isNumeric, TRANSITION } from './class-names';

export type ListRowProps = {
  /** A Dot or a 16 px icon. */
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Small context after the title line, in ink-3: "4 min ago". */
  meta?: ReactNode;
  /** The value on the right; numbers are set in mono. Controls here stay clickable on their own. */
  trailing?: ReactNode;
  selected?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  href?: string;
  /** Opens `href` in a new tab. */
  external?: boolean;
  disabled?: boolean;
  compact?: boolean;
  /** Drop the 8 px bleed that lines row text up with section labels inside a padded panel. */
  flush?: boolean;
  className?: string;
  'aria-label'?: string;
};

/** One thing in a list. The whole row is the target; trailing controls sit above it. */
export function ListRow({ leading, title, subtitle, meta, trailing, selected, onClick, href, external, disabled, compact, flush, className, 'aria-label': ariaLabel }: ListRowProps) {
  const interactive = !!(onClick || href) && !disabled;
  // Stretched over the whole row so the row is one target without nesting controls in a button.
  const hit = 'text-left outline-none after:absolute after:inset-0 after:rounded-control focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-accent';
  const titleText = <span className="block truncate text-body font-medium text-ink-1">{title}</span>;

  let main: ReactNode = titleText;
  if (href && !disabled) {
    main = (
      <a href={href} aria-label={ariaLabel} aria-current={selected ? 'true' : undefined}
        target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined} className={cx('block min-w-0', hit)}>
        {titleText}
      </a>
    );
  } else if (onClick && !disabled) {
    main = (
      <button type="button" onClick={onClick} aria-label={ariaLabel} aria-current={selected ? 'true' : undefined}
        className={cx('block w-full min-w-0', hit)}>
        {titleText}
      </button>
    );
  }

  return (
    <div className={cx(
      'group/row relative flex items-center gap-3 rounded-control px-2',
      flush ? '' : '-mx-2',
      compact ? 'min-h-8 py-1' : 'min-h-10 py-1.5',
      selected ? 'bg-surface-3' : interactive && 'hover:bg-surface-2',
      interactive && 'cursor-pointer',
      disabled && 'opacity-40',
      TRANSITION,
      className,
    )}>
      {leading && <span className="flex size-4 shrink-0 items-center justify-center text-ink-3">{leading}</span>}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-w-0 items-baseline gap-2">
          <div className="min-w-0 flex-1">{main}</div>
          {meta && <span className="shrink-0 text-meta text-ink-3">{meta}</span>}
        </div>
        {subtitle && <span className="truncate text-small text-ink-2">{subtitle}</span>}
      </div>
      {trailing != null && (
        <span className={cx(
          'relative z-[1] flex shrink-0 items-center gap-1',
          (typeof trailing === 'string' || typeof trailing === 'number') && 'text-small text-ink-2',
          isNumeric(trailing) && 'font-mono tabular-nums',
        )}>
          {trailing}
        </span>
      )}
    </div>
  );
}
