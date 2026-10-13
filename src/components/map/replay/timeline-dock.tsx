'use client';

import { useLayoutEffect, type ReactNode } from 'react';

/** Height of the timeline over the map; the status strip under the sidebar keeps the status bar's 28 px. */
export const TIMELINE_HEIGHT = 68;

/**
 * The bottom of the frame while a timeline runs, in place of the status bar: a quiet strip under the
 * sidebar and panel, and the timeline across the map. `above` holds one card, such as a legend, over it.
 */
export function TimelineDock({ label, status, above, children }: {
  label: string;
  status?: ReactNode;
  above?: ReactNode;
  children: ReactNode;
}) {
  // Map controls sit this far up while the timeline is showing: bottom: calc(var(--shell-bottom, 28px) + 12px).
  useLayoutEffect(() => {
    const style = document.documentElement.style;
    style.setProperty('--shell-bottom', `${TIMELINE_HEIGHT}px`);
    return () => { style.removeProperty('--shell-bottom'); };
  }, []);

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
