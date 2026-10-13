'use client';

import type { ComponentProps } from 'react';
import { LoaderCircle } from 'lucide-react';
import { cx, FOCUS_RING, TRANSITION, type IconType } from './class-names';
import type { Side } from './position';
import { Tooltip } from './tooltip';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent hover:bg-accent/90 active:bg-accent/80',
  secondary: 'border border-line-strong bg-surface-2 text-ink-1 hover:bg-surface-3',
  ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink-1 active:bg-surface-3',
  danger: 'border border-line-strong bg-surface-2 text-red hover:border-red/40 hover:bg-red/10',
};

const SIZE: Record<ButtonSize, { box: string; withIcon: string; icon: string }> = {
  md: { box: 'h-8 px-3 gap-1.5 text-body', withIcon: 'pl-2.5', icon: 'size-4' },
  sm: { box: 'h-7 px-2.5 gap-1.5 text-small', withIcon: 'pl-2', icon: 'size-3.5' },
};

const BASE = cx(
  'inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-control font-medium select-none',
  'disabled:cursor-not-allowed disabled:opacity-40',
  FOCUS_RING,
  TRANSITION,
);

export type ButtonProps = ComponentProps<'button'> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconType;
  loading?: boolean;
};

/** A verb: "Add to map", "Back to live". One primary per view. */
export function Button({ variant = 'secondary', size = 'md', icon: Icon, loading, disabled, className, children, type = 'button', ...rest }: ButtonProps) {
  const s = SIZE[size];
  const Lead = loading ? LoaderCircle : Icon;
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(BASE, VARIANT[variant], s.box, Lead && s.withIcon, className)}
      {...rest}
    >
      {Lead && <Lead aria-hidden className={cx(s.icon, 'shrink-0', loading && 'animate-spin motion-reduce:animate-none')} strokeWidth={1.75} />}
      {children}
    </button>
  );
}

const KEY_NAMES: Record<string, string> = { Esc: 'Escape', '↑': 'ArrowUp', '↓': 'ArrowDown', '←': 'ArrowLeft', '→': 'ArrowRight' };

export type IconButtonProps = Omit<ComponentProps<'button'>, 'children' | 'aria-label'> & {
  /** Names the button for screen readers and shows as its tooltip. */
  label: string;
  icon: IconType;
  kbd?: string;
  size?: ButtonSize;
  /** A toggle's state: on draws it pressed and sets aria-pressed. */
  active?: boolean;
  tooltipSide?: Side;
};

export function IconButton({ label, icon: Icon, kbd, size = 'md', active, tooltipSide = 'bottom', className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <Tooltip label={label} kbd={kbd} side={tooltipSide}>
      <button
        type={type}
        aria-label={label}
        aria-pressed={active}
        aria-keyshortcuts={kbd ? (KEY_NAMES[kbd] ?? kbd) : undefined}
        className={cx(
          BASE,
          size === 'md' ? 'size-8' : 'size-7',
          active ? 'bg-surface-3 text-ink-1' : 'text-ink-2 hover:bg-surface-2 hover:text-ink-1 active:bg-surface-3',
          className,
        )}
        {...rest}
      >
        <Icon aria-hidden className={size === 'md' ? 'size-4' : 'size-3.5'} strokeWidth={1.75} />
      </button>
    </Tooltip>
  );
}
