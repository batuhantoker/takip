'use client';

import { useId, type ComponentProps, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cx } from './class-names';
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

export type SelectProps = Omit<ComponentProps<'select'>, 'size' | 'className'> & Labelled & {
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
