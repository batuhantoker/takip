'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { hudIn } from '@/lib/hud-motion';
import AccountButton from '@/components/account/account-button';
import MoreMenu from './more-menu';
import type { BackendStatus, LiveData } from './dashboard-types';

function UtcClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const tick = () => setTime(new Date().toISOString().slice(11, 19));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);
  return <span title="Coordinated Universal Time" className="hidden xl:inline">UTC <span className="font-mono tabular-nums text-[var(--text-secondary)]">{time || '--:--:--'}</span></span>;
}

/** NOAA R/S/G now, plus the worst G forecast for the next three days. */
function scalesLine(scales?: { current?: Record<'R' | 'S' | 'G', number | null>; forecast?: { G: number | null }[] } | null): string {
  if (!scales?.current) return '';
  const current = scales.current;
  const now = (['R', 'S', 'G'] as const).map(k => `${k}${current[k] ?? '?'}`).join(' ');
  const g = Math.max(-1, ...(scales.forecast ?? []).map(d => d.G ?? -1));
  return `\nNOAA scales now ${now}${g >= 0 ? ` · 3-day forecast up to G${g}` : ''}`;
}

const STATUS_LABEL: Record<BackendStatus, string> = { connected: 'Live', connecting: 'Connecting', error: 'Offline' };

/** The live picture in numbers, for the status bar: feed status, layers on, entities tracked, solar activity. */
export function LiveStats({ backendStatus, layersOn, data, spaceWeather }: {
  backendStatus: BackendStatus;
  layersOn: number;
  data: LiveData;
  spaceWeather: any;
}) {
  const entities = Object.values(data ?? {}).reduce<number>((sum, v) => sum + (Array.isArray(v) ? v.length : 0), 0);
  const live = backendStatus === 'connected';
  return (
    <div className="h-full flex items-center gap-3.5 px-3 text-[10.5px] text-[var(--text-muted)] whitespace-nowrap">
      <span title="Backend connection" className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${live ? 'bg-[var(--alert-green)] animate-pulse' : backendStatus === 'connecting' ? 'bg-[var(--alert-orange)]' : 'bg-[var(--alert-red)]'}`} />
        <span className={live ? 'text-[var(--alert-green)]/80' : 'text-[var(--text-secondary)]'}>{STATUS_LABEL[backendStatus]}</span>
      </span>
      <span title="Layers switched on"><span className="font-mono tabular-nums text-[var(--text-secondary)]">{layersOn}</span> {layersOn === 1 ? 'layer' : 'layers'}</span>
      <span title="Entities tracked on the map" className="hidden lg:inline"><span className="font-mono tabular-nums text-[var(--text-secondary)]">{entities.toLocaleString()}</span> entities</span>
      {spaceWeather && (
        <span className="hidden lg:inline" title={`${spaceWeather.kp_index == null ? 'Geomagnetic storm index: no reading from NOAA' : `Geomagnetic storm index: Kp${spaceWeather.kp_index}`}${scalesLine(spaceWeather.scales)}`}>
          Solar <span className="font-mono" style={{ color: spaceWeather.storm_color }}>{spaceWeather.kp_index == null ? 'n/a' : `Kp${spaceWeather.kp_index}`}</span>
        </span>
      )}
      <UtcClock />
    </div>
  );
}

export function MobileStatus({ revealed, onOpenMarkets }: { revealed: boolean; onOpenMarkets: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: revealed ? 1 : 0 }} transition={hudIn(0.35)} className="absolute top-3 right-3 z-[200] pointer-events-auto flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        <MoreMenu compact onOpenMarkets={onOpenMarkets} />
        <AccountButton compact />
      </div>
    </motion.div>
  );
}
