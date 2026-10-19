'use client';

import type { ReactNode } from 'react';
import { cx } from '@/components/ui/class-names';
import type { SpaceFocus } from '@/lib/space/worlds';
import WorldSwitcher from './world-switcher';

/** Map or space on a phone, at the bottom-left above the bottom bar; a desktop places WorldSwitcher in its layout's corner. */
export default function SpaceSwitcherBar({ revealed, inSpace, focus, onMap, onSpace, switcher = true, beside }: {
  revealed: boolean;
  inSpace: boolean;
  focus: SpaceFocus;
  onMap: () => void;
  onSpace: (f: SpaceFocus) => void;
  /** Off when the person hid it; out in space it shows anyway, as the way back. */
  switcher?: boolean;
  /** A control that sits to its right, such as Showing. */
  beside?: ReactNode;
}) {
  if (!switcher && !inSpace && !beside) return null;
  return (
    <div data-hud
      className={cx(
        'pointer-events-none absolute bottom-[calc(var(--shell-bottom,56px)+12px+env(safe-area-inset-bottom))] left-3 z-[240] flex max-w-[calc(100vw-80px)] items-center gap-2 overflow-x-auto [scrollbar-width:none]',
        'transition-opacity duration-150 ease-out motion-reduce:transition-none',
        revealed ? 'opacity-100' : 'opacity-0',
      )}>
      {(switcher || inSpace) && <WorldSwitcher inSpace={inSpace} focus={focus} onMap={onMap} onSpace={onSpace} />}
      {beside}
    </div>
  );
}
