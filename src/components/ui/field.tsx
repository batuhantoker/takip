'use client';

import { useId, type ComponentProps, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cx, TRANSITION } from './class-names';
import { FieldShell, fieldBox, fieldInput, type FieldSize } from './field-shell';

export { SearchField } from './search-field';
export { Switch } from './switch';
export { Checkbox } from './checkbox';

type Labelled = {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  size?: FieldSize;
  /** Classes for the outer wrapper (width, margin); the input itself is styled by the kit. */
  className?: string;
};

export type TextFieldProps = Omit<ComponentProps<'input'>, 'size' | 'className'> & Labelled & {
  leading?: ReactNode;
  trailing?: ReactNode;
};

/** A labelled text input. Without `label`, pass `aria-label`. */
export function TextField({ label, hint, error, size = 'md', className, leading, trailing, id, ...rest }: TextFieldProps) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <FieldShell id={fid} label={label} hint={hint} error={error} className={className}>
      <div className={fieldBox(size, !!error)}>
        {leading && <span className="flex shrink-0 text-ink-3">{leading}</span>}
        <input
          id={fid}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? `${fid}-note` : undefined}
          className={fieldInput}
          {...rest}
        />
        {trailing && <span className="flex shrink-0 items-center text-ink-3">{trailing}</span>}
      </div>
    </FieldShell>
  );
}

export type TextAreaProps = Omit<ComponentProps<'textarea'>, 'className'> & Omit<Labelled, 'size'>;

/** A labelled box for several lines of text. Without `label`, pass `aria-label`. */
export function TextArea({ label, hint, error, className, id, rows = 4, ...rest }: TextAreaProps) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <FieldShell id={fid} label={label} hint={hint} error={error} className={className}>
      <textarea
        id={fid}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${fid}-note` : undefined}
        className={cx(
          'block w-full min-w-0 resize-y rounded-card border bg-surface-2 px-2.5 py-1.5 text-body leading-5 text-ink-1 outline-none placeholder:text-ink-3 focus:border-accent styled-scrollbar',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error ? 'border-red/60' : 'border-line-strong',
          TRANSITION,
        )}
        {...rest}
      />
    </FieldShell>
  );
}

export type SelectProps =Omit<ComponentProps<'select'>, 'size' | 'className'> & Labelled & {
  options?: { value: string; label: string; disabled?: boolean }[];
};

/** The native select, dressed to match: keyboard, phones and screen readers come free. */
export function Select({ label, hint, error, size = 'md', className, options, children, id, ...rest }: SelectProps) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <FieldShell id={fid} label={label} hint={hint} error={error} className={className}>
      <div className={cx(fieldBox(size, !!error, false), 'relative')}>
        <select
          id={fid}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? `${fid}-note` : undefined}
          className={cx(fieldInput, 'w-full cursor-pointer appearance-none scheme-dark disabled:cursor-not-allowed', size === 'md' ? 'pr-8 pl-2.5' : 'pr-7 pl-2')}
          {...rest}
        >
          {options?.map(o => <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}
          {children}
        </select>
        <ChevronDown aria-hidden className="pointer-events-none absolute right-2 size-4 text-ink-3" strokeWidth={1.75} />
      </div>
    </FieldShell>
  );
}
