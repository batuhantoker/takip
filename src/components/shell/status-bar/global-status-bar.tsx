'use client';

import type { ReactNode } from 'react';
import { cx } from '@/components/ui/class-names';

/** The desktop's bottom edge: where the pointer is on the left, the live state on the right. Nothing scrolls. */
export default function GlobalStatusBar({ revealed = true, left, right }: { revealed?: boolean; left?: ReactNode; right?: ReactNode }) {
  return (
    <footer data-hud
      className={cx(
        'absolute inset-x-0 bottom-0 z-[270] flex h-7 items-center justify-between gap-6 border-t border-line bg-surface-0 pr-1 pl-3',
        'text-meta whitespace-nowrap text-ink-3 select-none',
        'transition-opacity duration-150 ease-out motion-reduce:transition-none',
        revealed ? 'opacity-100' : 'opacity-0',
      )}>
      <div className="flex min-w-0 flex-1 items-center gap-4">{left}</div>
      <div className="flex shrink-0 items-center gap-4">{right}</div>
    </footer>
  );
}
