'use client';

import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Minimize2 } from 'lucide-react';
import { IconButton } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';

/** Recon over the whole map, beside the sidebar: the tool rail on the left, results with room to breathe. Escape or the backdrop exits. */
export function ExpandedView({ onExit, rail, footer, children }: {
  onExit: () => void;
  rail: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const node = (
    <div className="fixed top-0 right-0 bottom-7 left-[72px] z-[1200] flex justify-center p-4">
      <div aria-hidden className="absolute inset-0 bg-surface-0/70" onClick={onExit} />
      <Panel
        title="Recon"
        subtitle="Look up an IP, domain, username or phone number"
        docked={false}
        bare
        closeOnEscape={false}
        actions={<IconButton label="Exit full screen" kbd="Esc" icon={Minimize2} onClick={onExit} />}
        footer={footer}
        className="relative h-full w-full max-w-[1500px]"
      >
        <div className="flex min-h-0 flex-1 border-t border-line">
          <aside className="w-[320px] shrink-0 border-r border-line">{rail}</aside>
          <main className="styled-scrollbar min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="mx-auto max-w-[920px]">{children}</div>
          </main>
        </div>
      </Panel>
    </div>
  );
  return typeof document !== 'undefined' ? createPortal(node, document.body) : node;
}
