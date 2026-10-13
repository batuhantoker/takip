'use client';

import { useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { cx } from '@/components/ui/class-names';
import { useBottomBar } from '@/components/shell/mobile/use-bottom-bar';
import './inspect-sheet.css';

/** How far a drag must travel before it changes the sheet. */
const STEP = 48;

/**
 * The inspect card on a phone: a sheet on the bottom bar that peeks with the
 * name and key numbers, opens fully on a tap or a pull up, and closes on a pull down.
 */
export function InspectSheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const bar = useBottomBar(true);
  const [full, setFull] = useState(false);
  const [pull, setPull] = useState(0);
  const from = useRef<number | null>(null);
  const moved = useRef(false);

  // A peek has nothing to scroll, so it drags from anywhere; a full sheet only by its top.
  const draggable = (e: PointerEvent) => {
    const t = e.target as HTMLElement;
    return !t.closest('button, a, input') && (!full || !!t.closest('[data-sheet-grab], header'));
  };

  const handlers = {
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
      if (!draggable(e)) return;
      from.current = e.clientY;
      moved.current = false;
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
      if (from.current === null) return;
      const dy = e.clientY - from.current;
      if (Math.abs(dy) > 6) moved.current = true;
      setPull(dy);
    },
    onPointerUp: () => {
      if (from.current === null) return;
      if (!moved.current) setFull(f => !f);
      else if (pull < -STEP) setFull(true);
      else if (pull > STEP) { if (full) setFull(false); else onClose(); }
      from.current = null;
      setPull(0);
    },
    onPointerCancel: () => { from.current = null; setPull(0); },
    // A tap on the peeking body opens it; controls inside still work on their own.
    onClick: (e: React.MouseEvent) => {
      if (!full && !(e.target as HTMLElement).closest('button, a, input, header')) setFull(true);
    },
  };

  return (
    <div
      {...handlers}
      data-state={full ? 'full' : 'peek'}
      className={cx('tk-sheet pointer-events-auto fixed inset-x-0 z-[420] flex flex-col', pull ? '' : 'tk-sheet-settle')}
      style={{ bottom: bar, transform: pull ? `translateY(${Math.max(-80, pull)}px)` : undefined }}
    >
      <div data-sheet-grab className="flex h-5 shrink-0 cursor-grab touch-none items-center justify-center rounded-t-float border-t border-line bg-surface-1">
        <span aria-hidden className="h-1 w-9 rounded-full bg-ink-4" />
      </div>
      <div className="tk-sheet-body">{children}</div>
    </div>
  );
}
