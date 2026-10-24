'use client';

import type { FocusEvent, MouseEvent, ReactNode } from 'react';
import { Tooltip } from '@/components/ui/tooltip';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';

export type RailTone = 'accent' | 'gold';

/** The props Popover hands its trigger; passed on to the real button. */
export type TriggerProps = {
  onClick?: (e: MouseEvent<HTMLElement>) => void;
  'aria-expanded'?: boolean;
  'aria-haspopup'?: 'dialog' | 'menu';
  'aria-controls'?: string;
};

/** A box a Popover anchors to instead of the button, such as a sidebar entry's full width. Focus handed to it goes on to the button inside. */
export function AnchorBox({ className, children }: { className?: string; children: ReactNode }) {
  const pass = (e: FocusEvent<HTMLSpanElement>) => {
    if (e.target === e.currentTarget) e.currentTarget.querySelector<HTMLElement>('button, a')?.focus();
  };
  return <span tabIndex={-1} onFocus={pass} className={cx('outline-none', className)}>{children}</span>;
}

/** One sidebar entry: an 18 px glyph over an 11 px label. Active is a neutral fill with a 2 px bar on the sidebar's edge. */
export function RailButton({ glyph, label, hint, kbd, active = false, tone = 'accent', badge, pressed, tour, onClick, ...trigger }: TriggerProps & {
  glyph: ReactNode;
  label: ReactNode;
  /** Tooltip, to the right: what the entry is for. */
  hint?: string;
  kbd?: string;
  active?: boolean;
  tone?: RailTone;
  /** A quiet count beside the glyph, such as layers switched on. */
  badge?: number;
  /** For toggles (sidebar panels); menus use aria-expanded instead. */
  pressed?: boolean;
  /** Its mark for the map tour. */
  tour?: string;
}) {
  const gold = tone === 'gold';
  const open = trigger['aria-expanded'];
  return (
    // The box reaches the sidebar's edge, so tooltips and menus open just clear of it rather than on its border.
    <AnchorBox className="relative flex w-[calc(100%+8px)]">
      <Tooltip label={hint} kbd={kbd} side="right" disabled={!hint}>
        <span className="flex w-full pr-2">
          <button
            type="button"
            onClick={onClick}
            aria-pressed={pressed}
            data-tour={tour}
            {...trigger}
            className={cx(
              'relative flex h-12 w-full flex-col items-center justify-center gap-1 rounded-card select-none',
              active
                ? (gold ? 'bg-gold-soft text-gold' : 'bg-surface-3 text-ink-1')
                : open ? 'bg-surface-3 text-ink-1' : 'text-ink-2 hover:bg-surface-2 hover:text-ink-1 active:bg-surface-3',
              FOCUS_RING,
              TRANSITION,
            )}
          >
            {active && <span aria-hidden className={cx('absolute inset-y-2 -left-2 w-0.5 rounded-r-full', gold ? 'bg-gold' : 'bg-accent')} />}
            <span aria-hidden className="flex size-[18px] items-center justify-center">{glyph}</span>
            <span className="max-w-full truncate px-1 text-meta font-medium">{label}</span>
            {!!badge && (
              <span className={cx('absolute top-1 left-[calc(50%+11px)] font-mono text-meta tabular-nums', active ? 'text-ink-2' : 'text-ink-3')}>
                {badge}
              </span>
            )}
          </button>
        </span>
      </Tooltip>
    </AnchorBox>
  );
}
