'use client';

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { useAi } from './use-ai';
import { workspaceInsets } from '@/lib/ai/workspace/layout';
import type { AiGlobe, AiHover } from '@/lib/ai/globe/attach';
import type { ToolId } from '@/components/shell/sidebar/dock';
import type { FlyToTarget, MobilePanel } from '@/components/shell/state/types';
import type { AiMode } from './ti-mode';
import type { Stage } from '@/components/panels/ti-agent/workspace/workspace';

export function useAiSession({ mobilePanel, setMobilePanel, setActiveTool, setFlyToLocation }: {
  mobilePanel: MobilePanel | null;
  setMobilePanel: Dispatch<SetStateAction<MobilePanel | null>>;
  setActiveTool: Dispatch<SetStateAction<ToolId | null>>;
  setFlyToLocation: Dispatch<SetStateAction<FlyToTarget | null>>;
}) {
  // ── TAKIP AI ── the run lives here, not in the panel, so the globe keeps
  // drawing it while the panel is closed. State goes to the map's AI layer
  // directly rather than through a prop, so the map does not re-render per event.
  const ai = useAi();
  /** What is selected on the globe or in the panel: a point's key, or "link:<id>" for an arc. */
  const [aiSelected, setAiSelected] = useState<string | null>(null);
  const [aiHover, setAiHover] = useState<AiHover | null>(null);
  const [aiFollowing, setAiFollowing] = useState(true);
  const [aiTheater, setAiTheater] = useState(false);
  /** Assist (talk to AI, the default) or Forecast (the swarm). */
  const [aiMode, setAiMode] = useState<AiMode>('assist');
  /** What the full-screen workspace's stage shows. */
  const [aiStage, setAiStage] = useState<Stage>('globe');
  /** Whether the panel was opened from the keyboard, to type straight away. */
  const [aiAutoFocus, setAiAutoFocus] = useState(false);
  // A different run (or none) starts with nothing selected.
  const [aiSelectionRun, setAiSelectionRun] = useState(ai.runId);
  if (aiSelectionRun !== ai.runId) {
    setAiSelectionRun(ai.runId);
    setAiSelected(null);
  }
  const aiGlobe = useRef<AiGlobe | null>(null);
  const aiState = useRef(ai.state);
  const aiSelectedRef = useRef(aiSelected);
  useEffect(() => {
    aiState.current = ai.state;
    aiGlobe.current?.update(ai.state);
  }, [ai.state]);
  useEffect(() => {
    aiSelectedRef.current = aiSelected;
    aiGlobe.current?.select(aiSelected);
  }, [aiSelected]);
  const handleAiGlobe = useCallback((globe: AiGlobe | null) => {
    aiGlobe.current = globe;
    globe?.update(aiState.current);
    globe?.select(aiSelectedRef.current);
  }, []);
  // A click on the globe selects, and opens the panel to show what was clicked; empty map clears.
  const handleAiSelect = useCallback((key: string | null) => {
    setAiSelected(key);
    if (!key) return;
    setAiMode('forecast');
    if (window.matchMedia('(max-width: 767px)').matches) setMobilePanel('ai');
    else setActiveTool('ai');
  }, []);
  // Going somewhere on purpose takes the camera off the director.
  const handleAiLocate = useCallback((lat: number, lng: number, zoom?: number) => {
    aiGlobe.current?.follow(false);
    setFlyToLocation({ lat, lng, zoom, ts: Date.now() });
  }, []);
  const followAi = useCallback(() => aiGlobe.current?.follow(true), []);
  // Full screen: the workspace's columns sit either side, and the globe stays centred on the stage between.
  const aiTheaterOn = aiTheater;
  const aiHasRun = Boolean(ai.state);
  // On a phone the drawer covers the lower half: the globe, and anywhere AI flies to, centre in the space above it.
  const aiDrawerOpen = mobilePanel === 'ai';
  useEffect(() => {
    if (!aiDrawerOpen) return;
    const drawer = Math.round(Math.min(window.innerHeight * 0.55, window.innerHeight - 100)) + 52;
    aiGlobe.current?.setInsets({ top: 70, bottom: drawer, left: 0, right: 0 });
    return () => aiGlobe.current?.setInsets(null);
  }, [aiDrawerOpen]);
  useEffect(() => {
    const inset = () => aiGlobe.current?.setInsets(aiTheaterOn ? workspaceInsets(window.innerWidth, aiHasRun) : null);
    inset();
    // The app's own HUD (everything marked data-hud) steps back while the workspace has the screen.
    document.documentElement.toggleAttribute('data-ai-theater', aiTheaterOn);
    if (aiTheaterOn) window.addEventListener('resize', inset);
    return () => {
      window.removeEventListener('resize', inset);
      document.documentElement.removeAttribute('data-ai-theater');
    };
  }, [aiTheaterOn, aiHasRun]);

  return {
    ai, aiSelected, setAiSelected, aiHover, setAiHover, aiFollowing, setAiFollowing, aiTheater, setAiTheater,
    aiMode, setAiMode, aiStage, setAiStage, aiAutoFocus, setAiAutoFocus, aiGlobe,
    handleAiGlobe, handleAiSelect, handleAiLocate, followAi,
  };
}
