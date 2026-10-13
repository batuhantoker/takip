import type { ReactNode } from 'react';
import { cx } from './class-names';

/** A key, as printed on the keyboard: `<Kbd>/</Kbd>`, `<Kbd>⌘</Kbd><Kbd>K</Kbd>`. */
export function Kbd({ children, size = 'md', className }: { children: ReactNode; size?: 'sm' | 'md'; className?: string }) {
  return (
    <kbd className={cx(
      'inline-flex shrink-0 items-center justify-center rounded-[4px] border border-line-strong bg-surface-2 px-1',
      'font-mono text-meta leading-none font-medium text-ink-2 tabular-nums',
      size === 'sm' ? 'h-4 min-w-4' : 'h-[18px] min-w-[18px]',
      className,
    )}>
      {children}
    </kbd>
  );
}
