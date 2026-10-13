'use client';

import { useEffect, useId, useRef, type ComponentProps, type ReactNode } from 'react';
import { Check, Minus } from 'lucide-react';
import { cx, TRANSITION } from './class-names';

export type CheckboxProps = Omit<ComponentProps<'input'>, 'type' | 'size' | 'className'> & {
  label?: ReactNode;
  description?: ReactNode;
  /** Some but not all of a group: drawn as a dash. */
  indeterminate?: boolean;
  className?: string;
};

/** A native checkbox, drawn to match. Without `label`, pass `aria-label`. */
export function Checkbox({ label, description, indeterminate, className, id, disabled, ...rest }: CheckboxProps) {
  const auto = useId();
  const cid = id ?? auto;
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = !!indeterminate; }, [indeterminate]);
  return (
    <div className={cx('flex items-start gap-2.5', className)}>
      <span className="relative flex h-[18px] shrink-0 items-center">
        <input
          ref={ref}
          id={cid}
          type="checkbox"
          disabled={disabled}
          aria-describedby={description ? `${cid}-desc` : undefined}
          className="peer absolute inset-0 size-4 cursor-pointer opacity-0 disabled:cursor-not-allowed"
          {...rest}
        />
        <span aria-hidden className={cx(
          'pointer-events-none relative flex size-4 items-center justify-center rounded-[4px] border border-line-strong bg-surface-2 text-on-accent',
          'peer-checked:border-accent peer-checked:bg-accent peer-indeterminate:border-accent peer-indeterminate:bg-accent',
          'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent',
          'peer-disabled:opacity-40 peer-hover:border-ink-4',
          'peer-checked:[&>.on]:opacity-100 peer-indeterminate:[&>.on]:opacity-0 peer-indeterminate:[&>.some]:opacity-100',
          TRANSITION,
        )}>
          <Check className="on absolute size-3 opacity-0" strokeWidth={3} />
          <Minus className="some absolute size-3 opacity-0" strokeWidth={3} />
        </span>
      </span>
      {(label || description) && (
        <span className="flex min-w-0 flex-col">
          {label && <label htmlFor={cid} className={cx('text-body text-ink-1', disabled ? 'opacity-40' : 'cursor-pointer')}>{label}</label>}
          {description && <span id={`${cid}-desc`} className="text-small text-ink-3">{description}</span>}
        </span>
      )}
    </div>
  );
}
