'use client';

import { useId, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cx, TRANSITION, type IconType } from '@/components/ui/class-names';

/**
 * A group that folds: a 40 px header row (icon, name, a quiet count) with the
 * chevron on the right, and an optional action that stays clickable on its own.
 */
export function Disclosure({ icon: Icon, title, hint, active, open, onOpenChange, action, children }: {
  icon?: IconType;
  title: ReactNode;
  /** Quiet context after the name: "2 on", "86". */
  hint?: ReactNode;
  /** Draws the icon in ink-1: something inside is on. */
  active?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action?: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section className="border-line not-first:border-t">
      <div className={cx('group/row relative -mx-2 flex min-h-10 items-center gap-3 rounded-control px-2 hover:bg-surface-2', TRANSITION)}>
        {Icon && <Icon aria-hidden className={cx('size-4 shrink-0', active ? 'text-ink-1' : 'text-ink-3')} strokeWidth={1.75} />}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => onOpenChange(!open)}
          className="flex min-w-0 flex-1 items-baseline gap-2 text-left outline-none after:absolute after:inset-0 after:rounded-control focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-accent"
        >
          <span className="truncate text-body font-medium text-ink-1">{title}</span>
          {hint != null && <span className="shrink-0 text-meta text-ink-3">{hint}</span>}
        </button>
        {action && <span className="relative z-[1] -my-1 flex shrink-0 items-center">{action}</span>}
        <ChevronRight aria-hidden strokeWidth={1.75} className={cx(
          'size-4 shrink-0 text-ink-3 transition-transform duration-150 ease-out motion-reduce:transition-none',
          open && 'rotate-90',
        )} />
      </div>
      {open && <div id={id} className="pb-3">{children}</div>}
    </section>
  );
}
