'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { APP_VERSION } from '@/lib/app-version';
import { hudIn } from '@/lib/hud-motion';
import AccountButton from '@/components/account/account-button';
import type { ActiveLayers } from '@/lib/default-layers';
import MoreMenu from './more-menu';
import type { BackendStatus, LiveData } from './dashboard-types';

const UptimeClock = () => {
  const [uptime, setUptime] = useState('00:00:00');
  const startTime = useRef(0);
  if (startTime.current === 0) startTime.current = Date.now();
  useEffect(() => {
    const iv = setInterval(() => {
      const e = Math.floor((Date.now() - startTime.current) / 1000);
      setUptime(`${String(Math.floor(e/3600)).padStart(2,'0')}:${String(Math.floor((e%3600)/60)).padStart(2,'0')}:${String(e%60).padStart(2,'0')}`);
    }, 1000);
    return () => clearInterval(iv);
  }, []);
  return <span className="hidden lg:inline">UPTIME: <span className="text-[var(--gold-primary)]">{uptime}</span></span>;
};

const ZuluClock = () => {
  const [time, setTime] = useState('');
  useEffect(() => {
    const iv = setInterval(() => {
      const now = new Date();
      setTime(`ZULU ${String(now.getUTCHours()).padStart(2,'0')}:${String(now.getUTCMinutes()).padStart(2,'0')}:${String(now.getUTCSeconds()).padStart(2,'0')}Z`);
    }, 1000);
    return () => clearInterval(iv);
  }, []);
  return <span className="text-[var(--cyan-primary)] font-bold tabular-nums">{time || 'ZULU --:--:--Z'}</span>;
};

/** Real entity count — no fake throughput metrics */
const ActiveEntityCount = ({ data }: { data: Record<string, unknown[]> }) => {
  const count = useMemo(() => {
    if (!data) return 0;
    return Object.values(data).reduce((sum, v) => sum + (Array.isArray(v) ? v.length : 0), 0);
  }, [data]);
  return <span className="text-[var(--alert-green)] font-bold tabular-nums">{count.toLocaleString()}</span>;
};

export function StatusCluster({ revealed, backendStatus, activeLayers, data, spaceWeather, onOpenMarkets }: {
  revealed: boolean;
  backendStatus: BackendStatus;
  activeLayers: ActiveLayers;
  data: LiveData;
  spaceWeather: any;
  onOpenMarkets: () => void;
}) {
  return (
    <motion.div data-hud initial={{ opacity: 0 }} animate={{ opacity: revealed ? 1 : 0 }} transition={hudIn(0.35)} className="status-bar-desktop absolute top-4 right-6 z-[300] pointer-events-none flex items-center gap-3 text-[10px] font-mono tracking-widest text-[var(--text-muted)]">

      <span className="hidden lg:inline-flex items-center gap-1.5">
        <ZuluClock />
      </span>

      <span className="flex items-center gap-1" title="Backend connection status">STATUS: <span className={backendStatus === 'connected' ? 'text-[var(--alert-green)]' : 'text-[var(--alert-red)]'}>{backendStatus === 'connected' ? 'LIVE' : backendStatus.toUpperCase()}</span></span>

      <span className="hidden lg:inline-flex items-center gap-1" title="Number of active data layers">
        <span className="text-[var(--cyan-primary)] font-bold">{Object.values(activeLayers).filter(Boolean).length}</span>
        <span className="opacity-60">LAYERS</span>
      </span>

      <span className="hidden lg:inline-flex items-center gap-1" title="Tracked entities on map">
        <ActiveEntityCount data={data} />
        <span className="opacity-60">ENTITIES</span>
      </span>

      {spaceWeather && <span className="hidden lg:inline" title={spaceWeather.kp_index == null ? 'Geomagnetic Storm Index — no reading from NOAA' : `Geomagnetic Storm Index — Kp${spaceWeather.kp_index}`}>SOLAR: <span style={{ color: spaceWeather.storm_color, fontWeight: 700 }}>{spaceWeather.kp_index == null ? 'N/A' : `Kp${spaceWeather.kp_index}`}</span></span>}

      <span className="text-[11px] font-bold tracking-[0.2em] text-[var(--text-muted)] opacity-50">{APP_VERSION}</span>
      
      <MoreMenu onOpenMarkets={onOpenMarkets} />
      <AccountButton />
    </motion.div>
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
