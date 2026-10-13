'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Panel } from '@/components/ui/panel';
import { cx, ENTER } from '@/components/ui/class-names';

/**
 * A centred panel over a dimmed map, for things that need the whole attention:
 * the shortcut sheet, the token chart, the account. Escape, the close button
 * or a press on the dimmed map closes it; focus comes back to where it was.
 */
export function Modal({ open, onClose, title, subtitle, actions, className, bare, children }: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Width, as a max-w class. */
  className?: string;
  bare?: boolean;
  children: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const back = document.activeElement as HTMLElement | null;
    const el = box.current;
    if (el && !el.contains(document.activeElement)) {
      (el.querySelector<HTMLElement>('[data-autofocus], input:not([type=hidden]):not([type=checkbox])') ?? el).focus({ preventScroll: true });
    }
    return () => back?.focus?.({ preventScroll: true });
  }, [open]);
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <div aria-hidden onPointerDown={onClose} className={cx('absolute inset-0 bg-surface-0/70', ENTER)} />
      <div ref={box} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}
        className={cx('relative flex max-h-[min(88vh,820px)] w-full flex-col outline-none starting:translate-y-1', ENTER, className ?? 'max-w-md')}>
        <Panel docked={false} title={title} subtitle={subtitle} actions={actions} onClose={onClose} bare={bare} className="w-full">
          {children}
        </Panel>
      </div>
    </div>,
    document.body,
  );
}
