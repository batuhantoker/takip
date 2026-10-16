'use client';

import { useEffect, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { AiClient } from './use-ai';
import type { ToolId } from '@/components/shell/sidebar/dock';
import type { MobilePanel } from '@/components/shell/state/types';
import type { AiMode } from './ti-mode';

/** A shared link (?ai=<run>) opens TI on that run, and from then on the run, not the visitor's city, has the camera. */
export function useAiShareLink({ ai, setAiMode, setMobilePanel, setActiveTool, autoLocateCancelled }: {
  ai: AiClient;
  setAiMode: Dispatch<SetStateAction<AiMode>>;
  setMobilePanel: Dispatch<SetStateAction<MobilePanel | null>>;
  setActiveTool: Dispatch<SetStateAction<ToolId | null>>;
  autoLocateCancelled: RefObject<boolean>;
}) {
  useEffect(() => {
    // Links shared before 2026-10-16 carry the run as ?oi=.
    const params = new URLSearchParams(window.location.search);
    const id = params.get('ai') ?? params.get('oi');
    if (!id) return;
    autoLocateCancelled.current = true;
    setAiMode('forecast');
    if (window.matchMedia('(max-width: 767px)').matches) setMobilePanel('ai');
    else setActiveTool('ai');
    void ai.watch(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Once a run is under way the camera is the director's (lib/ai/globe/camera).
  useEffect(() => { if (ai.runId) autoLocateCancelled.current = true; }, [ai.runId, autoLocateCancelled]);
}
