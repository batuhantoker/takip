'use client';

import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Minimize2 } from 'lucide-react';
import { IconButton } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';

/**
 * Markets over the dimmed map: find and sections across the top, the
 * benchmarks, then the section's table with the day's heatmap on the left and
 * the chart with what moved beside it. Each column scrolls on its own.
 */
export default function MarketsFull({ subtitle, clocks, find, sections, monitor, table, side, footer, onExit }: {
  subtitle: ReactNode;
  clocks: ReactNode;
  find: ReactNode;
  sections: ReactNode;
  monitor: ReactNode;
  /** The section's table and the heatmap under it. */
  table: ReactNode;
  /** The chart, breadth, alerts, biggest moves and the brief. */
  side: ReactNode;
  footer: ReactNode;
  onExit: () => void;
}) {
  return createPortal(
    <div className="fixed inset-0 z-[1100] flex bg-surface-0/80 p-4" onClick={onExit}>
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[1500px]" onClick={e => e.stopPropagation()}>
        <Panel docked={false} bare closeOnEscape={false} title="Markets" subtitle={subtitle} className="h-full w-full"
          actions={<>{clocks}<IconButton icon={Minimize2} label="Exit full screen" kbd="Esc" onClick={onExit} className="ml-3" /></>}
          footer={footer}>
          <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 pt-1 pb-4">
            <div className="flex shrink-0 items-start gap-4">
              <div className="w-80 shrink-0">{find}</div>
              <div className="styled-scrollbar min-w-0 flex-1 overflow-x-auto">{sections}</div>
            </div>
            <div className="shrink-0">{monitor}</div>
            <div className="styled-scrollbar grid min-h-0 flex-1 grid-cols-1 gap-6 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_minmax(380px,34%)] lg:overflow-hidden">
              <div className="styled-scrollbar flex min-h-0 flex-col gap-6 pr-1 lg:overflow-y-auto">{table}</div>
              <div className="styled-scrollbar flex min-h-0 flex-col gap-6 lg:overflow-y-auto lg:border-l lg:border-line lg:pl-6">{side}</div>
            </div>
          </div>
        </Panel>
      </div>
    </div>,
    document.body,
  );
}
