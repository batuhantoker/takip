'use client';

import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { motion } from 'framer-motion';
import { Globe, MapPinned, Moon, Mountain, Satellite } from 'lucide-react';
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
      className={`relative h-8 flex items-center gap-1.5 px-2.5 rounded-md text-[11px] transition-colors duration-200 ${
        active ? 'text-[var(--gold-light)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
      }`}
    >
      {active && (
        <motion.span
          layoutId={layoutId}
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          className="absolute inset-0 rounded-md border border-[var(--border-active)] bg-[var(--gold-primary)]/10"
        />
      )}
      <Icon className="w-3.5 h-3.5 relative z-10" />
      <span className="hidden md:inline relative z-10">{label}</span>
    </button>
  );
}

/** Projection, basemap and (desktop) map options in one strip: bottom-right beside the zoom buttons, bottom-left on a phone. */
export default function ViewControls({ revealed, isMobile, mapProjection, setMapProjection, selectFlatMap, mapStyle, setMapStyle, mapView, options }: {
  revealed: boolean;
  isMobile: boolean;
  mapProjection: MapProjection;
  setMapProjection: Dispatch<SetStateAction<MapProjection>>;
  selectFlatMap: () => void;
  mapStyle: MapStyle;
  setMapStyle: Dispatch<SetStateAction<MapStyle>>;
  mapView: MapView;
  options?: ReactNode;
}) {
  const divider = <div className="w-px h-5 mx-1 bg-white/10" />;
  return (
    <motion.div
      data-hud
      initial={{ opacity: 0, y: 20 }} animate={revealed ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }} transition={hudIn(0.45)}
      className={`absolute z-[240] flex flex-col gap-1.5 pointer-events-none ${isMobile ? 'left-3 bottom-[75px] items-start' : 'right-[60px] bottom-10 items-end'}`}
    >
      {!isMobile && <div className="pr-1"><ScaleBar zoom={mapView.zoom} latitude={mapView.latitude} /></div>}
      <div className="flex items-center gap-[3px] p-[3px] pointer-events-auto rounded-xl border border-white/10 bg-[var(--bg-panel)] backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.55)]">
        <ViewSegment layoutId="view-projection" active={mapProjection === 'globe'} onClick={() => setMapProjection('globe')} title="3D globe" icon={Globe} label="3D" />
        <ViewSegment layoutId="view-projection" active={mapProjection === 'mercator'} onClick={selectFlatMap} title="Flat 2D map" icon={MapPinned} label="2D" />
        {divider}
        <ViewSegment layoutId="view-style" active={mapStyle === 'dark'} onClick={() => setMapStyle('dark')} title="Dark map" icon={Moon} label="Dark" />
        <ViewSegment layoutId="view-style" active={mapStyle === 'satellite'} onClick={() => setMapStyle('satellite')} title="Satellite imagery" icon={Satellite} label="Satellite" />
        <ViewSegment layoutId="view-style" active={mapStyle === 'topo'} onClick={() => setMapStyle('topo')} title="Topographic (OpenTopoMap)" icon={Mountain} label="Topo" />
        {options && <>{divider}{options}</>}
      </div>
    </motion.div>
  );
}
