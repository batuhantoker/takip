'use client';

import type { Dispatch, SetStateAction } from 'react';
import { motion } from 'framer-motion';
import { Globe, MapPinned, Moon, Satellite } from 'lucide-react';
import ScaleBar from '@/components/map/scale-bar';
import { hudIn } from '@/lib/hud-motion';
import type { MapProjection, MapStyle, MapView } from './dashboard-types';

function ViewSegment({ active, onClick, title, icon: Icon, label, layoutId }: {
  active: boolean;
  onClick: () => void;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  layoutId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-mono font-medium tracking-[0.18em] transition-colors duration-200 ${
        active ? 'text-[var(--gold-light)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
      }`}
    >
      {active && (
        <motion.span
          layoutId={layoutId}
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          className="absolute inset-0 rounded-md border border-[var(--border-active)] bg-[var(--gold-primary)]/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_14px_var(--gold-glow)]"
        />
      )}
      <Icon className="w-3.5 h-3.5 relative z-10" />
      <span className="hidden md:inline relative z-10">{label}</span>
    </button>
  );
}

export default function ViewControls({ revealed, isMobile, mapProjection, setMapProjection, selectFlatMap, mapStyle, setMapStyle, mapView }: {
  revealed: boolean;
  isMobile: boolean;
  mapProjection: MapProjection;
  setMapProjection: Dispatch<SetStateAction<MapProjection>>;
  selectFlatMap: () => void;
  mapStyle: MapStyle;
  setMapStyle: Dispatch<SetStateAction<MapStyle>>;
  mapView: MapView;
}) {
  return (
    <motion.div
      data-hud
      initial={{ opacity: 0, y: 20 }} animate={revealed ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }} transition={hudIn(0.45)}
      className="absolute bottom-[75px] md:bottom-[100px] z-[200] flex flex-col gap-1.5 pointer-events-none"
      style={{ left: isMobile ? '12px' : '120px' }}
    >
      {/* Unified Control Strip */}
      <div className="flex items-center gap-[3px] p-[3px] pointer-events-auto rounded-xl border border-[var(--border-primary)] bg-[var(--bg-panel)] backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.55)]">
        <ViewSegment layoutId="view-projection" active={mapProjection === 'globe'} onClick={() => setMapProjection('globe')} title="3D Globe" icon={Globe} label="3D" />
        <ViewSegment layoutId="view-projection" active={mapProjection === 'mercator'} onClick={selectFlatMap} title="2D Map" icon={MapPinned} label="2D" />
        <div className="w-px h-5 mx-1 bg-[var(--border-secondary)]" />
        <ViewSegment layoutId="view-style" active={mapStyle === 'dark'} onClick={() => setMapStyle('dark')} title="Night Mode" icon={Moon} label="MAP" />
        <ViewSegment layoutId="view-style" active={mapStyle === 'satellite'} onClick={() => setMapStyle('satellite')} title="Satellite View" icon={Satellite} label="SAT" />
      </div>


      {/* Scale Bar */}
      {!isMobile && (
        <div className="pl-0.5">
          <ScaleBar zoom={mapView.zoom} latitude={mapView.latitude} />
        </div>
      )}
    </motion.div>
  );
}
