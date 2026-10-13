'use client';

import { TakipMark } from '@/components/shell/brand/takip-mark';
import { TakipWordmark } from '@/components/shell/brand/takip-wordmark';
import { cx } from '@/components/ui/class-names';

/** The phone's top-left: the mark and the name, on a small solid chip so the map never fights it. */
export default function AppHeader({ revealed }: { revealed: boolean }) {
  return (
    <div data-hud className={cx(
      'pointer-events-none absolute top-3 left-3 z-[200] flex h-10 items-center gap-2 rounded-float border border-line bg-surface-1 px-3 text-ink-1 shadow-float',
      'transition-opacity duration-150 ease-out',
      revealed ? 'opacity-100' : 'opacity-0',
    )}>
      <TakipMark className="h-5 w-auto" />
      <h1 className="m-0 leading-none"><TakipWordmark className="h-[11px] w-auto" /></h1>
    </div>
  );
}
