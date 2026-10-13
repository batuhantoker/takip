'use client';

import { useRef, useState, type Dispatch, type PointerEvent, type ReactNode, type SetStateAction } from 'react';
import { X } from 'lucide-react';
import { IconButton } from '@/components/ui/button';
import { cx } from '@/components/ui/class-names';
import type { MobilePanel } from '@/components/shell/state/types';

const TITLES: Record<MobilePanel, string> = {
  layers: 'Layers',
  markets: 'Markets',
  intel: 'Alerts',
  search: 'Search',
  recon: 'Recon',
  oi: 'TI',
};

/** How far the sheet must be pulled down before letting go closes it. */
const DISMISS_AT = 72;

/** The phone's one sheet, above the bottom bar: a title, a close button, and whatever was opened. Pull the top down to close it. */
export function MobileDrawer({ mobilePanel, setMobilePanel, subtitle, children }: {
  mobilePanel: MobilePanel | null;
  setMobilePanel: Dispatch<SetStateAction<MobilePanel | null>>;
  /** One quiet line under the title. */
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  const [pull, setPull] = useState(0);
  const from = useRef<number | null>(null);
  if (!mobilePanel) return null;
  const close = () => setMobilePanel(null);

  const grab = {
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest('button')) return;
      from.current = e.clientY;
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
      if (from.current !== null) setPull(Math.max(0, e.clientY - from.current));
    },
    onPointerUp: () => {
      if (from.current !== null && pull > DISMISS_AT) close();
      from.current = null;
      setPull(0);
    },
    onPointerCancel: () => { from.current = null; setPull(0); },
  };

  return (
    <section data-hud aria-label={TITLES[mobilePanel]} style={pull ? { transform: `translateY(${pull}px)` } : undefined}
      className={cx(
        'fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-[400] flex max-h-[min(60vh,calc(100dvh-120px))] flex-col',
        'rounded-t-float border-t border-line bg-surface-1 shadow-float',
        // The sheet follows the finger while pulled, and eases back if let go short.
        pull ? 'transition-[opacity,translate]' : 'transition-[opacity,translate,transform]',
        'duration-150 ease-out starting:translate-y-2 starting:opacity-0 motion-reduce:transition-none',
      )}>
      <div {...grab} className="shrink-0 cursor-grab touch-none select-none active:cursor-grabbing">
        <div aria-hidden className="mx-auto mt-2 h-1 w-9 rounded-full bg-ink-4" />
        <header className="flex min-h-11 items-center justify-between gap-3 py-1 pr-2 pl-4">
          <div className="min-w-0">
            <h2 className="truncate text-title font-semibold text-ink-1">{TITLES[mobilePanel]}</h2>
            {subtitle && <p className="truncate text-meta text-ink-3">{subtitle}</p>}
          </div>
          <IconButton label="Close" icon={X} onClick={close} />
        </header>
      </div>
      <div className="styled-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
    </section>
  );
}
