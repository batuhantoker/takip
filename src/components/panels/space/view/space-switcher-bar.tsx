'use client';

import type { ReactNode } from 'react';
import { cx } from '@/components/ui/class-names';
import type { SpaceFocus } from '@/lib/space/worlds';
import WorldSwitcher from './world-switcher';

/** Map or space, at the bottom-left of the map area (above the bottom bar on a phone). */
export default function SpaceSwitcherBar({ revealed, isMobile, inSpace, focus, onMap, onSpace, beside }: {
  revealed: boolean;
  isMobile: boolean;
  inSpace: boolean;
  focus: SpaceFocus;
  onMap: () => void;
  onSpace: (f: SpaceFocus) => void;
  /** A control that sits to its right, such as Showing. */
  beside?: ReactNode;
}) {
  return (
    <div data-hud
      className={cx(
        'pointer-events-none absolute z-[240] flex items-center gap-2 transition-[opacity,left] duration-150 ease-out motion-reduce:transition-none',
        isMobile ? 'bottom-[calc(68px+env(safe-area-inset-bottom))] left-3 max-w-[calc(100vw-80px)] overflow-x-auto [scrollbar-width:none]' : 'bottom-[calc(var(--shell-bottom,28px)+12px)]',
        revealed ? 'opacity-100' : 'opacity-0',
      )}
      style={isMobile ? undefined : { left: 'calc(var(--shell-left, 72px) + 12px)' }}>
      <WorldSwitcher inSpace={inSpace} focus={focus} onMap={onMap} onSpace={onSpace} />
      {beside}
    </div>
  );
}
