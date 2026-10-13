import type { ReactNode } from 'react';
import { cx, FIELD_FOCUS, TRANSITION } from './class-names';

export type FieldSize = 'sm' | 'md';

/** The box every text-like field draws: surface-2, a firm hairline, accent while focused. */
export const fieldBox = (size: FieldSize = 'md', invalid?: boolean, padded = true) => cx(
  'flex w-full min-w-0 items-center gap-2 rounded-card border bg-surface-2 text-ink-1',
  'has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50',
  invalid ? 'border-red/60' : 'border-line-strong',
  size === 'md' ? 'h-8 text-body' : 'h-7 text-small',
  padded && (size === 'md' ? 'px-2.5' : 'px-2'),
  FIELD_FOCUS,
  TRANSITION,
);

export const fieldInput = 'h-full min-w-0 flex-1 bg-transparent text-inherit placeholder:text-ink-3 outline-none';

/** Label above, hint or error below, tied to the control by id. */
export function FieldShell({ id, label, hint, error, className, children }: {
  id: string;
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cx('flex min-w-0 flex-col gap-1.5', className)}>
      {label && <label htmlFor={id} className="text-small font-medium text-ink-2">{label}</label>}
      {children}
      {error ? <p id={`${id}-note`} className="text-meta text-red">{error}</p>
        : hint ? <p id={`${id}-note`} className="text-meta text-ink-3">{hint}</p> : null}
    </div>
  );
}
