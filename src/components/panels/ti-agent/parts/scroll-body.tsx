'use client';

import { forwardRef, useState, type ReactNode } from 'react';
import { cx } from '@/components/ui/class-names';

/** A bare Panel's scrolling body: padded, with the hairline under the header once it scrolls, as Panel draws its own. */
export const ScrollBody = forwardRef<HTMLDivElement, { className?: string; children: ReactNode }>(function ScrollBody({ className, children }, ref) {
  const [scrolled, setScrolled] = useState(false);
  return (
    <div ref={ref} onScroll={e => setScrolled(e.currentTarget.scrollTop > 0)}
      className={cx('styled-scrollbar min-h-0 flex-1 overflow-y-auto border-t p-4 transition-colors duration-150', scrolled ? 'border-line' : 'border-transparent', className)}>
      {children}
    </div>
  );
});
