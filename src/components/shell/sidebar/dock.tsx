'use client';

import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import AdSlot from '@/components/shell/ads/ad-slot';
import { useEscape } from '@/components/ui/use-escape';
import { cx } from '@/components/ui/class-names';
import { AD_SLOTS } from '@/lib/platform/ads';

/** What the sidebar can open beside it, one at a time. */
export type ToolId = 'layers' | 'ai' | 'draw' | 'alerts' | 'history' | 'recon' | 'directions' | 'space' | 'arcgis' | 'markets';

/** Sidebar width, and the panel column that opens flush beside it. Search and the map controls keep clear of both. */
export const NAV_WIDTH = 72;
export const DOCK_WIDTH = 360;

/** Browsing panels carry an ad underneath; tools mid-task (TI, drawing, routes, recon) never do. */
const AD_TOOLS: ReadonlySet<ToolId> = new Set(['layers', 'alerts', 'space', 'arcgis', 'markets']);

const TEXT_FIELD = 'input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]):not([type=submit]), textarea';

/** The column a tool opens into: flush to the sidebar, full height down to the status bar. Escape closes it. */
export function Dock({ tool, onClose, children }: { tool: ToolId | null; onClose: () => void; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useEscape(onClose, tool !== null, root);

  // Escape in a field with something typed in it leaves the field, not the panel.
  const keepOpen = (e: KeyboardEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    if (e.key !== 'Escape' || !t.matches(TEXT_FIELD) || !(t as HTMLInputElement).value) return;
    e.stopPropagation();
    if (!e.defaultPrevented) t.blur();
  };

  return (
    <div ref={root} data-hud data-tour="dock" data-tool={tool ?? undefined} onKeyDown={keepOpen}
      className={cx('absolute top-0 bottom-[var(--shell-foot,28px)] z-[250] flex flex-col', tool === null && 'pointer-events-none')}
      style={{ left: NAV_WIDTH, width: DOCK_WIDTH }}>
      {children}
      <AdSlot slot={AD_SLOTS.panel} variant="panel" visible={tool !== null && AD_TOOLS.has(tool)}
        className="shrink-0 border-t border-r border-line bg-surface-1 px-4 pt-2 pb-3" />
    </div>
  );
}

/** One panel in the dock. Keyed by tool, so switching fades the new one in rather than sliding the old one out. */
export function DockSlot({ hidden, children }: { hidden?: boolean; children: ReactNode }) {
  return (
    <div className={cx(
      'flex min-h-0 flex-1 flex-col overflow-y-auto bg-surface-1 styled-scrollbar',
      'transition-opacity duration-[120ms] ease-out starting:opacity-0 motion-reduce:transition-none',
      hidden && 'hidden',
    )}>
      {children}
    </div>
  );
}
