'use client';

import type { ComponentProps, ReactNode } from 'react';
import { Tooltip } from '@/components/ui/tooltip';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { AnchorBox } from '@/components/shell/sidebar/rail-button';

/** A square in the map cluster: 36 px (40 on a phone), the tooltip to its left. */
export function ClusterButton({ label, kbd, active, touch, children, className, ...rest }: Omit<ComponentProps<'button'>, 'aria-label'> & {
  label: string;
  kbd?: string;
  /** A toggle's state; draws it pressed. */
  active?: boolean;
  touch?: boolean;
  children: ReactNode;
}) {
  return (
    <AnchorBox className="flex">
      <Tooltip label={label} kbd={kbd} side="left" disabled={touch}>
        <button type="button" aria-label={label} aria-pressed={active}
          className={cx(
            'flex items-center justify-center select-none disabled:cursor-not-allowed disabled:opacity-35',
            touch ? 'size-10' : 'size-9',
            active ? 'bg-surface-3 text-ink-1' : 'text-ink-2 hover:bg-surface-2 hover:text-ink-1 active:bg-surface-3',
            FOCUS_RING, 'focus-visible:-outline-offset-2',
            TRANSITION,
            className,
          )}
          {...rest}>
          {children}
        </button>
      </Tooltip>
    </AnchorBox>
  );
}

export const ClusterDivider = () => <div aria-hidden className="h-px shrink-0 bg-line" />;
