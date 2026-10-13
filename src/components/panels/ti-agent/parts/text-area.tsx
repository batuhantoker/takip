'use client';

import { forwardRef, useLayoutEffect, useRef, type ComponentProps } from 'react';
import { cx } from '@/components/ui/class-names';

/** The kit's field look for several lines; grows with what is typed up to `maxRows`. */
export const TextArea = forwardRef<HTMLTextAreaElement, Omit<ComponentProps<'textarea'>, 'rows'> & { minRows?: number; maxRows?: number; bare?: boolean }>(
  function TextArea({ minRows = 1, maxRows = 6, bare, className, value, ...rest }, ref) {
    const own = useRef<HTMLTextAreaElement | null>(null);
    useLayoutEffect(() => {
      const el = own.current;
      if (!el) return;
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, maxRows * 20 + 12)}px`;
    }, [value, maxRows]);
    return (
      <textarea
        ref={el => { own.current = el; if (typeof ref === 'function') ref(el); else if (ref) ref.current = el; }}
        rows={minRows}
        value={value}
        className={cx(
          'block w-full resize-none text-body leading-5 text-ink-1 outline-none placeholder:text-ink-3 styled-scrollbar',
          bare ? 'bg-transparent' : 'rounded-card border border-line-strong bg-surface-2 px-2.5 py-1.5 transition-colors duration-150 focus:border-accent',
          className,
        )}
        {...rest}
      />
    );
  },
);
