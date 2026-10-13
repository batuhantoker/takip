'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cx, ENTER } from './class-names';
import { Kbd } from './kbd';
import { anchorIn, ENTER_FROM, place, type Side } from './position';

const DELAY = 400;
// Moving along a toolbar shows the next tooltip at once, as macOS does.
const WARM_FOR = 400;
let lastHidden = 0;

/**
 * A short label beside one child, after a short hover or on keyboard focus.
 * Visual only: the child still needs its own accessible name.
 */
export function Tooltip({ label, kbd, side = 'top', disabled, children }: {
  label: ReactNode;
  kbd?: string;
  side?: Side;
  disabled?: boolean;
  children: ReactNode;
}) {
  const wrap = useRef<HTMLSpanElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const [open, setOpen] = useState(false);

  const show = (delay: number) => {
    window.clearTimeout(timer.current);
    const wait = Date.now() - lastHidden < WARM_FOR ? 0 : delay;
    timer.current = window.setTimeout(() => setOpen(true), wait);
  };
  const hide = () => {
    window.clearTimeout(timer.current);
    setOpen(o => {
      if (o) lastHidden = Date.now();
      return false;
    });
  };

  const visible = open && !disabled;
  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    if (!visible) return;
    window.addEventListener('scroll', hide, true);
    return () => window.removeEventListener('scroll', hide, true);
  }, [visible]);

  useLayoutEffect(() => {
    const anchor = anchorIn(wrap.current);
    const el = tip.current;
    if (!visible || !anchor || !el) return;
    const p = place(anchor.getBoundingClientRect(), el.getBoundingClientRect(), side, 'center', 6);
    el.style.left = `${p.x}px`;
    el.style.top = `${p.y}px`;
    el.style.visibility = 'visible';
  }, [visible, side]);

  return (
    <span
      ref={wrap}
      className="contents"
      onPointerEnter={e => { if (!disabled && e.pointerType !== 'touch') show(DELAY); }}
      onPointerLeave={hide}
      onPointerDown={hide}
      onFocus={e => { if (!disabled && e.target.matches(':focus-visible')) show(120); }}
      onBlur={hide}
    >
      {children}
      {visible && createPortal(
        <div
          ref={tip}
          aria-hidden
          style={{ visibility: 'hidden' }}
          className={cx(
            'pointer-events-none fixed top-0 left-0 z-[2000] flex max-w-64 items-center gap-2 rounded-control border border-line-strong bg-surface-3 px-2 py-1',
            'text-small font-medium text-ink-1 shadow-float',
            ENTER,
            ENTER_FROM[side],
          )}
        >
          <span>{label}</span>
          {kbd && <Kbd size="sm">{kbd}</Kbd>}
        </div>,
        document.body,
      )}
    </span>
  );
}
