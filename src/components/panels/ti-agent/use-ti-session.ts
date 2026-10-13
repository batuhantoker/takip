'use client';

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { useOi } from '@/lib/oi/client';
import { workspaceInsets } from '@/lib/oi/layout';
import type { OiGlobe, OiHover } from '@/lib/oi/globe';
import type { ToolId } from '@/components/shell/sidebar/dock';
import type { FlyToTarget, MobilePanel } from '@/components/shell/state/types';
import type { OiMode } from './ti-mode';
import type { Stage } from '@/components/panels/ti-agent/workspace/workspace';

export function useOiSession({ mobilePanel, setMobilePanel, setActiveTool, setFlyToLocation }: {
  mobilePanel: MobilePanel | null;
  setMobilePanel: Dispatch<SetStateAction<MobilePanel | null>>;
  setActiveTool: Dispatch<SetStateAction<ToolId | null>>;
  setFlyToLocation: Dispatch<SetStateAction<FlyToTarget | null>>;
}) {
  // ── TAKIP OI ── the run lives here, not in the panel, so the globe keeps
  // drawing it while the panel is closed. State goes to the map's OI layer
  // directly rather than through a prop, so the map does not re-render per event.
  const oi = useOi();
  /** What is selected on the globe or in the panel: a point's key, or "link:<id>" for an arc. */
  const [oiSelected, setOiSelected] = useState<string | null>(null);
  const [oiHover, setOiHover] = useState<OiHover | null>(null);
  const [oiFollowing, setOiFollowing] = useState(true);
  const [oiTheater, setOiTheater] = useState(false);
  /** Assist (talk to OI, the default) or Forecast (the swarm). */
  const [oiMode, setOiMode] = useState<OiMode>('assist');
  /** What the full-screen workspace's stage shows. */
  const [oiStage, setOiStage] = useState<Stage>('globe');
  /** Whether the panel was opened from the keyboard, to type straight away. */
  const [oiAutoFocus, setOiAutoFocus] = useState(false);
  // A different run (or none) starts with nothing selected.
  const [oiSelectionRun, setOiSelectionRun] = useState(oi.runId);
  if (oiSelectionRun !== oi.runId) {
    setOiSelectionRun(oi.runId);
    setOiSelected(null);
  }
  const oiGlobe = useRef<OiGlobe | null>(null);
  const oiState = useRef(oi.state);
  const oiSelectedRef = useRef(oiSelected);
  useEffect(() => {
    oiState.current = oi.state;
    oiGlobe.current?.update(oi.state);
  }, [oi.state]);
  useEffect(() => {
    oiSelectedRef.current = oiSelected;
    oiGlobe.current?.select(oiSelected);
  }, [oiSelected]);
  const handleOiGlobe = useCallback((globe: OiGlobe | null) => {
    oiGlobe.current = globe;
    globe?.update(oiState.current);
    globe?.select(oiSelectedRef.current);
  }, []);
  // A click on the globe selects, and opens the panel to show what was clicked; empty map clears.
  const handleOiSelect = useCallback((key: string | null) => {
    setOiSelected(key);
    if (!key) return;
    setOiMode('forecast');
    if (window.matchMedia('(max-width: 767px)').matches) setMobilePanel('oi');
    else setActiveTool('oi');
  }, []);
  // Going somewhere on purpose takes the camera off the director.
  const handleOiLocate = useCallback((lat: number, lng: number, zoom?: number) => {
    oiGlobe.current?.follow(false);
    setFlyToLocation({ lat, lng, zoom, ts: Date.now() });
  }, []);
  const followOi = useCallback(() => oiGlobe.current?.follow(true), []);
  // Full screen: the workspace's columns sit either side, and the globe stays centred on the stage between.
  const oiTheaterOn = oiTheater;
  const oiHasRun = Boolean(oi.state);
  // On a phone the drawer covers the lower half: the globe, and anywhere OI flies to, centre in the space above it.
  const oiDrawerOpen = mobilePanel === 'oi';
  useEffect(() => {
    if (!oiDrawerOpen) return;
    const drawer = Math.round(Math.min(window.innerHeight * 0.55, window.innerHeight - 100)) + 52;
    oiGlobe.current?.setInsets({ top: 70, bottom: drawer, left: 0, right: 0 });
    return () => oiGlobe.current?.setInsets(null);
  }, [oiDrawerOpen]);
  useEffect(() => {
    const inset = () => oiGlobe.current?.setInsets(oiTheaterOn ? workspaceInsets(window.innerWidth, oiHasRun) : null);
    inset();
    // The app's own HUD (everything marked data-hud) steps back while the workspace has the screen.
    document.documentElement.toggleAttribute('data-oi-theater', oiTheaterOn);
    if (oiTheaterOn) window.addEventListener('resize', inset);
    return () => {
      window.removeEventListener('resize', inset);
      document.documentElement.removeAttribute('data-oi-theater');
    };
  }, [oiTheaterOn, oiHasRun]);

  return {
    oi, oiSelected, setOiSelected, oiHover, setOiHover, oiFollowing, setOiFollowing, oiTheater, setOiTheater,
    oiMode, setOiMode, oiStage, setOiStage, oiAutoFocus, setOiAutoFocus, oiGlobe,
    handleOiGlobe, handleOiSelect, handleOiLocate, followOi,
  };
}
