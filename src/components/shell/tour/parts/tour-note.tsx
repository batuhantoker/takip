'use client';

import { useId, type CSSProperties, type ReactNode } from 'react';
import { cx, ENTER } from '@/components/ui/class-names';

// The middle of the map, clear of the bottom corners' pieces; on a phone, above the bottom bar and Map / Space.
const PLACE: CSSProperties = { left: 'calc(var(--shell-left, 0px) + (100% - var(--shell-left, 0px)) / 2)' };

/** A small card low in the middle of the map that asks about the tour without covering anything. */
export function TourNote({ title, body, actions }: { title: string; body: string; actions: ReactNode }) {
  const id = useId();
  return (
    <div role="dialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-body`} style={PLACE}
      className={cx(
        'absolute bottom-[calc(var(--shell-foot,28px)+72px)] z-[500] w-[340px] max-w-[calc(100vw-24px)] -translate-x-1/2',
        'max-md:bottom-[calc(var(--shell-bottom,56px)+62px+env(safe-area-inset-bottom))]',
        'rounded-float border border-line bg-surface-1 p-4 shadow-float starting:translate-y-1', ENTER,
      )}>
      <h2 id={`${id}-title`} className="text-title font-semibold text-ink-1">{title}</h2>
      <p id={`${id}-body`} className="mt-1.5 text-body text-ink-2">{body}</p>
      <div className="mt-4 flex justify-end gap-2">{actions}</div>
    </div>
  );
}
