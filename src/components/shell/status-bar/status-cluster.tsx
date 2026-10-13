'use client';

import { useEffect, useState } from 'react';
import { CircleHelp } from 'lucide-react';
import { IconButton } from '@/components/ui/button';
import { Dot } from '@/components/ui/tag';
import { Tooltip } from '@/components/ui/tooltip';
import { cx } from '@/components/ui/class-names';
import AccountButton from '@/components/site/account/account-button';
import { LatestQuake } from './latest-quake';
import MoreMenu from '@/components/shell/more/more-menu';
import { showShortcuts } from '@/components/shell/keyboard/shortcuts-state';
import type { BackendStatus, LiveData } from '@/components/shell/state/types';

function UtcClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);
  const local = now?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    <Tooltip label={local ? `Local time ${local}` : 'Coordinated Universal Time'} side="top">
      <span aria-label="Coordinated Universal Time">
        <span className="font-mono tabular-nums text-ink-2">{now ? now.toISOString().slice(11, 19) : '--:--:--'}</span> UTC
      </span>
    </Tooltip>
  );
}

const STATE: Record<BackendStatus, { tone: 'green' | 'amber' | 'red'; label: string }> = {
  connected: { tone: 'green', label: 'Live' },
  connecting: { tone: 'amber', label: 'Connecting' },
  error: { tone: 'red', label: 'Offline' },
};

/** Everything the live layers have on the map right now. */
export const trackedCount = (data: LiveData) =>
  Object.values(data ?? {}).reduce<number>((sum, v) => sum + (Array.isArray(v) ? v.length : 0), 0);

/** The status bar's right end: the live state, how much is on the map, the time, and the shortcuts. */
export function LiveStats({ backendStatus, data, onLocate }: {
  backendStatus: BackendStatus;
  data: LiveData;
  onLocate: (lat: number, lng: number) => void;
}) {
  const tracked = trackedCount(data);
  const state = STATE[backendStatus];
  return (
    <>
      <span className="hidden min-w-0 xl:flex"><LatestQuake quakes={data?.earthquakes} onLocate={onLocate} /></span>
      <span role="status" className="flex items-center gap-1.5">
        <Dot tone={state.tone} />
        <span className={cx(backendStatus === 'connected' ? 'text-ink-2' : 'text-ink-1')}>{state.label}</span>
      </span>
      {tracked > 0 && (
        <span className="hidden lg:inline">
          <span className="font-mono tabular-nums text-ink-2">{tracked.toLocaleString('en-US')}</span> tracked
        </span>
      )}
      <UtcClock />
      <IconButton label="Keyboard shortcuts" kbd="?" icon={CircleHelp} size="sm" tooltipSide="top" onClick={showShortcuts} className="-ml-2" />
    </>
  );
}

/** The phone's top-right corner: the account, then More. */
export function MobileStatus({ revealed, onOpenMarkets }: { revealed: boolean; onOpenMarkets: () => void }) {
  return (
    <div data-hud className={cx(
      'absolute top-3 right-3 z-[200] flex items-center gap-1 rounded-float border border-line bg-surface-1 p-1 shadow-float',
      'transition-opacity duration-150 ease-out',
      revealed ? 'opacity-100' : 'pointer-events-none opacity-0',
    )}>
      <AccountButton compact />
      {/* Last, so its menu lines up with the corner. */}
      <MoreMenu compact onOpenMarkets={onOpenMarkets} />
    </div>
  );
}
