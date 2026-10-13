'use client';

import { useId, useRef, useState, type ComponentProps } from 'react';
import { Search, X } from 'lucide-react';
import { cx, FOCUS_RING } from './class-names';
import { fieldBox, fieldInput, type FieldSize } from './field-shell';
import { Kbd } from './kbd';

export type SearchFieldProps = Omit<ComponentProps<'input'>, 'size' | 'value' | 'onChange' | 'type' | 'className'> & {
  value: string;
  onChange: (value: string) => void;
  /** Names the field for screen readers; defaults to the placeholder. */
  label?: string;
  /** The key that focuses this field, shown while it is empty. The caller binds the key. */
  kbd?: string;
  size?: FieldSize;
  className?: string;
};

/** Search with a clear button. Escape clears, and a second Escape leaves the field. */
export function SearchField({ value, onChange, label, kbd, size = 'md', className, placeholder = 'Search', onKeyDown, onFocus, onBlur, id, ...rest }: SearchFieldProps) {
  const auto = useId();
  const input = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  return (
    <div className={cx(fieldBox(size), className)}>
      <Search aria-hidden className={cx('shrink-0 text-ink-3', size === 'md' ? 'size-4' : 'size-3.5')} strokeWidth={1.75} />
      <input
        ref={input}
        id={id ?? auto}
        type="search"
        aria-label={label ?? placeholder}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => {
          onKeyDown?.(e);
          if (e.key !== 'Escape' || e.defaultPrevented) return;
          e.preventDefault();
          if (value) onChange('');
          else input.current?.blur();
        }}
        onFocus={e => { setFocused(true); onFocus?.(e); }}
        onBlur={e => { setFocused(false); onBlur?.(e); }}
        className={cx(fieldInput, '[&::-webkit-search-cancel-button]:appearance-none')}
        {...rest}
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => { onChange(''); input.current?.focus(); }}
          className={cx('-mr-1 flex size-5 shrink-0 items-center justify-center rounded text-ink-3 hover:bg-surface-3 hover:text-ink-1', FOCUS_RING)}
        >
          <X aria-hidden className="size-3.5" strokeWidth={2} />
        </button>
      ) : kbd && !focused ? <Kbd>{kbd}</Kbd> : null}
    </div>
  );
}
