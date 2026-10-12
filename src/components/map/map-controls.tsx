'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { History, Minus, Plus } from 'lucide-react';
import type { Map as MlMap } from 'maplibre-gl';
import { createMapCameraControls, type CameraMove } from '@/lib/map-camera-controls';

interface MapControlsProps {
  mapRef: React.RefObject<MlMap | null>;
  onInteract?: () => void;
  replayActive?: boolean;
  /** Absent: no replay button. */
  onReplayToggle?: () => void;
}

/** Zoom in and out; hold to keep going. The arrow keys pan. The clock opens replay. */
export default function MapControls({ mapRef, onInteract, replayActive = false, onReplayToggle }: MapControlsProps) {
  const controller = useRef<ReturnType<typeof createMapCameraControls> | null>(null);
  const interact = useRef(onInteract);
  const [limits, setLimits] = useState({ min: false, max: false });
  useEffect(() => { interact.current = onInteract; }, [onInteract]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const controls = createMapCameraControls(map, () => interact.current?.(),
      () => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    controller.current = controls;
    const updateLimits = () => setLimits({ min: map.getZoom() <= map.getMinZoom() + 0.001, max: map.getZoom() >= map.getMaxZoom() - 0.001 });
    const onHidden = () => { if (document.hidden) controls.release(); };
    updateLimits();
    map.on('zoomend', updateLimits);
    window.addEventListener('blur', controls.release);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      controls.dispose();
      controller.current = null;
      map.off('zoomend', updateLimits);
      window.removeEventListener('blur', controls.release);
      document.removeEventListener('visibilitychange', onHidden);
    };
  }, [mapRef]);

  const step = useCallback((move: CameraMove) => controller.current?.step(move), []);
  const press = useCallback((move: CameraMove) => controller.current?.press(move), []);
  const release = useCallback(() => controller.current?.release(), []);
  return (
    <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: 0.4 }}
      className="absolute right-2 bottom-[112px] md:right-3 md:bottom-10 z-[240] pointer-events-auto" data-map-controls>
      <div role="group" aria-label="Zoom"
        className="flex flex-col gap-[3px] p-[3px] rounded-xl border border-white/10 bg-[var(--bg-panel)] backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.55)]">
        <Btn label="Zoom in" move={{ kind: 'zoom', dir: 1 }} icon={Plus} disabled={limits.max} press={press} release={release} step={step} />
        <Btn label="Zoom out" move={{ kind: 'zoom', dir: -1 }} icon={Minus} disabled={limits.min} press={press} release={release} step={step} />
      </div>
      {onReplayToggle && (
        <div role="group" aria-label="Replay"
          className="mt-1.5 flex flex-col p-[3px] rounded-xl border border-white/10 bg-[var(--bg-panel)] backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.55)]">
          <button type="button" aria-pressed={replayActive} onClick={onReplayToggle}
            title={replayActive ? 'Back to the live map' : 'Replay: watch recorded ships and aircraft, with satellites where they were'}
            aria-label={replayActive ? 'Leave replay' : 'Replay'}
            className={`w-10 h-10 md:w-8 md:h-8 rounded-md flex items-center justify-center hover:bg-[var(--hover-accent)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--gold-primary)] ${
              replayActive ? 'text-[var(--gold-light)] bg-[var(--gold-primary)]/10' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
            <History className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        </div>
      )}
    </motion.div>
  );
}

function Btn({ label, icon: Icon, move, disabled = false, press, release, step }: {
  label: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  move: CameraMove; disabled?: boolean;
  press: (m: CameraMove) => void; release: () => void; step: (m: CameraMove) => void;
}) {
  return (
    <button type="button" title={`${label} — hold to keep going`} aria-label={label} disabled={disabled}
      className={`w-10 h-10 md:w-8 md:h-8 rounded-md flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-accent)] active:text-[var(--gold-light)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--gold-primary)] disabled:opacity-25 touch-none select-none`}
      onPointerDown={e => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        press(move);
      }}
      onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}
      onClick={e => { if (e.detail === 0) step(move); }}>
      <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
    </button>
  );
}
