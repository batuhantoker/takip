'use client';

import type { RefObject } from 'react';
import { cx } from '@/components/ui/class-names';

/** Where the pointer is: the status bar's left end. The coordinates are written straight into the ref, off React. */
export default function CursorInfo({ coordsDisplayRef, locationLabel, hidden = false }: {
  coordsDisplayRef: RefObject<HTMLSpanElement | null>;
  locationLabel: string;
  /** Out in space there is no map under the pointer; kept mounted so the ref keeps its last reading. */
  hidden?: boolean;
}) {
  return (
    <div className={cx('min-w-0 items-center gap-2', hidden ? 'hidden' : 'flex')}>
      <span ref={coordsDisplayRef} aria-label="Pointer position" className="shrink-0 font-mono tabular-nums text-ink-2" />
      {locationLabel && (
        <>
          <span aria-hidden className="text-ink-4">·</span>
          <span className="truncate">{locationLabel}</span>
        </>
      )}
    </div>
  );
}
