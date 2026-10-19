'use client';

import { useLayoutEffect, type ReactNode } from 'react';

/** Height of the timeline over the map; the status strip under the sidebar keeps the status bar's 28 px. */
export const TIMELINE_HEIGHT = 68;
/** The phone's two rows, above its 56 px bottom bar. */
export const COMPACT_TIMELINE_HEIGHT = 100;
const BOTTOM_BAR = 56;

/** One row of the phone's timeline. */
export function TimelineRow({ children }: { children: ReactNode }) {
  return <div className="flex min-w-0 items-center gap-2">{children}</div>;
}

/**
 * The bottom of the frame while a timeline runs, in place of the status bar: a quiet strip under the
 * sidebar and panel, and the timeline across the map. `above` holds one card, such as a legend, over it.
 * `compact` is the phone's: two TimelineRows above the bottom bar, under any open sheet.
 */
export function TimelineDock({ label, status, above, compact, children }: {
  label: string;
  status?: ReactNode;
  above?: ReactNode;
  compact?: boolean;
  children: ReactNode;
}) {
  // Map controls sit this far up while the timeline is showing: bottom: calc(var(--shell-bottom, 28px) + 12px).
  useLayoutEffect(() => {
    const style = document.documentElement.style;
    style.setProperty('--shell-bottom', `${compact ? BOTTOM_BAR + COMPACT_TIMELINE_HEIGHT : TIMELINE_HEIGHT}px`);
    return () => { style.removeProperty('--shell-bottom'); };
  }, [compact]);

  if (compact) {
    return (
      <section data-hud aria-label={label}
        className="@container/timeline absolute inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-[270] flex flex-col justify-center gap-1 border-t border-line bg-surface-1 px-3"
        style={{ height: COMPACT_TIMELINE_HEIGHT }}>
        {/* Clear of Map / Space above the timeline and of the map controls on the right. */}
        {above && <div className="absolute bottom-full left-3 mb-[62px] w-max max-w-[calc(100%-80px)]">{above}</div>}
        {children}
      </section>
    );
  }

  return (
    <div data-hud className="pointer-events-none absolute inset-x-0 bottom-0 z-[270] hidden items-end md:flex">
      <div className="@container pointer-events-auto flex h-7 shrink-0 items-center overflow-hidden border-t border-line bg-surface-1 px-4 transition-[width] duration-200 ease-out"
        style={{ width: 'var(--shell-left, 72px)' }}>
        {status && <div className="hidden min-w-0 items-center gap-2 text-meta whitespace-nowrap text-ink-3 @[200px]:flex">{status}</div>}
      </div>
      <section aria-label={label}
        className="@container/timeline pointer-events-auto relative flex min-w-0 flex-1 items-center gap-4 border-t border-line bg-surface-1 pr-3 pl-4"
        style={{ height: TIMELINE_HEIGHT }}>
        {above && (
          <div className="absolute bottom-full left-1/2 mb-3 w-max max-w-[calc(100%-24px)] -translate-x-1/2">{above}</div>
        )}
        {children}
      </section>
    </div>
  );
}
