'use client';

import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import type { LiveData, MobilePanel } from './dashboard-types';

export function MobileDrawer({ mobilePanel, setMobilePanel, children }: {
  mobilePanel: MobilePanel | null;
  setMobilePanel: Dispatch<SetStateAction<MobilePanel | null>>;
  children: ReactNode;
}) {
  return (
    <AnimatePresence>
      {mobilePanel && (
        <motion.div
          initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className={`fixed bottom-[52px] left-0 right-0 z-[400] glass-panel ${mobilePanel === 'oi' ? 'oi-glass' : ''} rounded-b-none overflow-y-auto styled-scrollbar`}
          style={{ maxHeight: 'min(55vh, calc(100dvh - 100px))', paddingBottom: 'env(safe-area-inset-bottom, 4px)' }}
        >
          <div className="mobile-drawer-handle" />
          <div className="px-3 pb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="hud-text text-[10px] text-[var(--text-primary)]">
                {mobilePanel === 'layers' ? 'LAYERS & STATS' : mobilePanel === 'markets' ? 'MARKETS & INTEL' : mobilePanel === 'intel' ? 'INTEL FEED' : mobilePanel === 'recon' ? 'TAKIP RECON' : mobilePanel === 'oi' ? 'TAKIP OI' : 'SEARCH'}
              </span>
              <button onClick={() => setMobilePanel(null)} className="text-[var(--text-muted)] p-1"><X className="w-4 h-4" /></button>
            </div>
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function MobileStats({ totalFlights, data }: { totalFlights: number; data: LiveData }) {
  return (
    <div className="glass-panel-sm p-2 mb-2">
      <div className="grid grid-cols-5 gap-1 text-center">
        <div><div className="hud-label" style={{fontSize:'9px'}}>AIR</div><div className="hud-value text-[10px]">{totalFlights.toLocaleString()}</div></div>
        <div><div className="hud-label" style={{fontSize:'9px'}}>SAT</div><div className="hud-value text-[10px]">{(data.satellites?.length||0)}</div></div>
        <div><div className="hud-label" style={{fontSize:'9px'}}>CAM</div><div className="hud-value text-[10px]">{(data.cameras?.length||0)}</div></div>
        <div><div className="hud-label" style={{fontSize:'9px'}}>WX</div><div className="hud-value text-[10px]" style={{color:'var(--accent-weather)'}}>{(data.weather_events?.length||0)}</div></div>
        <div><div className="hud-label" style={{fontSize:'9px'}}>NUC</div><div className="hud-value text-[10px]" style={{color:'var(--accent-nuclear)'}}>{(data.infrastructure?.length||0)}</div></div>
      </div>
    </div>
  );
}
