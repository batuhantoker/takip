'use client';

import {
  cloneElement, useCallback, useId, useLayoutEffect, useRef, useState,
  type KeyboardEvent, type MouseEvent, type ReactElement, type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cx, ENTER } from './class-names';
import { anchorIn, ENTER_FROM, place, type Align, type Side } from './position';
import { useDismiss } from './use-dismiss';

type TriggerProps = {
  onClick?: (e: MouseEvent<HTMLElement>) => void;
  'aria-expanded'?: boolean;
  'aria-haspopup'?: 'dialog' | 'menu';
  'aria-controls'?: string;
};

export type PopoverProps = {
  /** One element that takes onClick, usually a Button or IconButton. */
  trigger: ReactElement<TriggerProps>;
  children: ReactNode | ((close: () => void) => ReactNode);
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  placement?: Side;
  align?: Align;
  /** Names the surface for screen readers. */
  label?: string;
  role?: 'dialog' | 'menu';
  /** Width and padding; the surface itself (radius, border, shadow) is the kit's. */
  className?: string;
};

/** A floating surface anchored to its trigger. Escape or a press elsewhere closes it, and focus returns to the trigger. */
export function Popover({ trigger, children, open: controlled, defaultOpen = false, onOpenChange, placement = 'bottom', align = 'start', label, role = 'dialog', className }: PopoverProps) {
  const [inner, setInner] = useState(defaultOpen);
  const open = controlled ?? inner;
  const id = useId();
  const wrap = useRef<HTMLSpanElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const anchor = useRef<HTMLElement | null>(null);

  const setOpen = useCallback((next: boolean) => {
    if (controlled === undefined) setInner(next);
    onOpenChange?.(next);
  }, [controlled, onOpenChange]);
  const close = useCallback(() => setOpen(false), [setOpen]);

  useDismiss(open, close, [wrap, surface], anchor);

  useLayoutEffect(() => {
    anchor.current = anchorIn(wrap.current);
    const el = surface.current;
    if (!open || !el || !anchor.current) return;
    let frame = 0;
    const position = () => {
      const a = anchor.current;
      if (!a) return;
      const p = place(a.getBoundingClientRect(), el.getBoundingClientRect(), placement, align);
      el.style.left = `${p.x}px`;
      el.style.top = `${p.y}px`;
      el.style.visibility = 'visible';
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(position); };
    position();
    if (!el.contains(document.activeElement)) (el.querySelector<HTMLElement>('[data-autofocus]') ?? el).focus({ preventScroll: true });
    const resize = new ResizeObserver(schedule);
    resize.observe(el);
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
    };
  }, [open, placement, align]);

  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
    if (role !== 'menu' || !step) return;
    e.preventDefault();
    const items = [...e.currentTarget.querySelectorAll<HTMLElement>('[role^="menuitem"]:not(:disabled)')];
    const i = items.indexOf(document.activeElement as HTMLElement);
    const n = items.length;
    items[i < 0 ? (step > 0 ? 0 : n - 1) : (i + step + n) % n]?.focus();
  };

  const triggerEl = cloneElement(trigger, {
    onClick: (e: MouseEvent<HTMLElement>) => {
      trigger.props.onClick?.(e);
      if (!e.defaultPrevented) setOpen(!open);
    },
    'aria-expanded': open,
    'aria-haspopup': role,
    'aria-controls': open ? id : undefined,
  });

  return (
    <span ref={wrap} className="contents">
      {triggerEl}
      {open && createPortal(
        <div
          ref={surface}
          id={id}
          role={role}
          aria-label={label}
          tabIndex={-1}
          onKeyDown={onMenuKey}
          style={{ visibility: 'hidden' }}
          className={cx(
            'fixed top-0 left-0 z-[1200] max-h-[calc(100vh-16px)] overflow-y-auto rounded-float border border-line bg-surface-1 text-ink-2 shadow-float outline-none styled-scrollbar',
            ENTER,
            ENTER_FROM[placement],
            className,
          )}
        >
          {typeof children === 'function' ? children(close) : children}
        </div>,
        document.body,
      )}
    </span>
  );
}
