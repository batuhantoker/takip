'use client';

import { useEffect, useState } from 'react';
import { CircleHelp } from 'lucide-react';
import { IconButton } from '@/components/ui/button';
import { Dot } from '@/components/ui/tag';
import { Tooltip } from '@/components/ui/tooltip';
import { cx } from '@/components/ui/class-names';
import { useT } from '@/components/ui/use-t';
import { msg } from '@/lib/core/i18n/translator';
import AccountButton from '@/components/site/account/account-button';
import MoreMenu from '@/components/shell/more/more-menu';
import { showShortcuts } from '@/components/shell/keyboard/shortcuts-state';
import type { BackendStatus, LiveData } from '@/components/shell/state/types';

export function UtcClock() {
  const t = useT();
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);
  const local = now?.toLocaleTimeString(t.intl, { hour: '2-digit', minute: '2-digit' });
  return (
    <Tooltip label={local ? t('Local time {time}', { time: local }) : t('Coordinated Universal Time')} side="top">
      <span aria-label={t('Coordinated Universal Time')}>
        <span className="font-mono tabular-nums text-ink-2">{now ? now.toISOString().slice(11, 19) : '--:--:--'}</span> UTC
      </span>
    </Tooltip>
  );
}

const STATE: Record<BackendStatus, { tone: 'green' | 'amber' | 'red'; label: string }> = {
  connected: { tone: 'green', label: msg('Live') },
  connecting: { tone: 'amber', label: msg('Connecting') },
  error: { tone: 'red', label: msg('Offline') },
};

/** Everything the live layers have on the map right now. */
export const trackedCount = (data: LiveData) =>
  Object.values(data ?? {}).reduce<number>((sum, v) => sum + (Array.isArray(v) ? v.length : 0), 0);

/** Live, Connecting or Offline. */
export function LiveState({ backendStatus }: { backendStatus: BackendStatus }) {
  const t = useT();
  const state = STATE[backendStatus];
  return (
    <span role="status" className="flex items-center gap-1.5">
      <Dot tone={state.tone} />
      <span className={cx(backendStatus === 'connected' ? 'text-ink-2' : 'text-ink-1')}>{t(state.label)}</span>
    </span>
  );
}

/** How much the live layers have on the map; wide screens only. */
export function TrackedCount({ data }: { data: LiveData }) {
  const t = useT();
  const tracked = trackedCount(data);
  if (!tracked) return null;
  return (
    <span className="hidden lg:inline">
      {t.rich('{n} tracked', { n: <span className="font-mono tabular-nums text-ink-2">{tracked.toLocaleString(t.intl)}</span> })}
    </span>
  );
}

/** The shortcuts sheet; `tight` tucks it against the clock it usually follows. */
export function ShortcutsButton({ tight }: { tight: boolean }) {
  const t = useT();
  return <IconButton label={t('Keyboard shortcuts')} kbd="?" icon={CircleHelp} size="sm" tooltipSide="top" onClick={showShortcuts} className={tight ? '-ml-2' : undefined} />;
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
