'use client';

import { useId, type ReactNode } from 'react';
import { cx, EASE, FOCUS_RING, TRANSITION } from './class-names';

export type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Always required: shown beside the switch, or only read out with `hideLabel`. */
  label: string;
  hideLabel?: boolean;
  description?: ReactNode;
  size?: 'sm' | 'md';
  disabled?: boolean;
  id?: string;
  className?: string;
};

/** On or off, effective at once. Accent when on. */
export function Switch({ checked, onChange, label, hideLabel, description, size = 'md', disabled, id, className }: SwitchProps) {
  const auto = useId();
  const sid = id ?? auto;
  const md = size === 'md';
  const control = (
    <button
      id={sid}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={hideLabel ? label : undefined}
      aria-describedby={description && !hideLabel ? `${sid}-desc` : undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative inline-flex shrink-0 items-center rounded-full disabled:cursor-not-allowed disabled:opacity-40',
        md ? 'h-[18px] w-[30px]' : 'h-4 w-[26px]',
        checked ? 'bg-accent' : 'bg-surface-3 ring-1 ring-inset ring-line-strong',
        FOCUS_RING,
        TRANSITION,
        hideLabel && className,
      )}
    >
      <span className={cx(
        'rounded-full shadow-sm transition-[translate,background-color] duration-150 motion-reduce:transition-none',
        EASE,
        md ? 'size-3.5' : 'size-3',
        checked ? cx('bg-ink-1', md ? 'translate-x-[14px]' : 'translate-x-3') : 'translate-x-0.5 bg-ink-3',
      )} />
    </button>
  );
  if (hideLabel) return control;
  return (
    <div className={cx('flex items-start gap-2.5', className)}>
      <span className={cx('flex items-center', md ? 'h-[18px]' : 'h-4')}>{control}</span>
      <span className="flex min-w-0 flex-col">
        <label htmlFor={sid} className={cx('text-body text-ink-1', disabled ? 'opacity-40' : 'cursor-pointer')}>{label}</label>
        {description && <span id={`${sid}-desc`} className="text-small text-ink-3">{description}</span>}
      </span>
    </div>
  );
}
