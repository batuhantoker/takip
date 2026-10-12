'use client';

import type { RefObject } from 'react';
import { motion } from 'framer-motion';
import { hudIn } from '@/lib/hud-motion';
import type { MapView } from './dashboard-types';

export default function CursorInfo({ revealed, coordsDisplayRef, locationLabel, mapView }: {
  revealed: boolean;
  coordsDisplayRef: RefObject<HTMLDivElement | null>;
  locationLabel: string;
  mapView: MapView;
}) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: revealed ? 1 : 0 }} transition={hudIn(0.6)} className="desktop-only absolute bottom-8 z-[200] pointer-events-auto" style={{ left: '72px' }}>
      <div className="flex items-center gap-5 text-[9px] font-mono tracking-widest text-[var(--text-muted)] opacity-60">
        <div className="flex gap-2 items-center" title="Cursor coordinates (hover over map)">
          <span>CURSOR</span>
          <span ref={coordsDisplayRef} className="text-[var(--gold-primary)] font-bold tabular-nums">—</span>
        </div>
        <div className="flex gap-2 items-center" title="Reverse-geocoded location name">
          <span>LOCATION</span>
          <span className="text-[var(--cyan-primary)] truncate max-w-[200px]">{locationLabel || 'HOVER MAP'}</span>
        </div>
        <div className="flex gap-2 items-center" title="Current zoom level">
          <span>ZOOM</span>
          <span className="text-[var(--gold-primary)] font-bold tabular-nums">{mapView.zoom.toFixed(1)}</span>
        </div>
      </div>
    </motion.div>
  );
}
