'use client';

import { useEffect, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { OiClient } from '@/lib/oi/client';
import type { ToolId } from '@/components/shell/dock';
import type { MobilePanel } from '@/components/shell/dashboard-types';
import type { OiMode } from './mode-switch';

/** A shared link (?oi=<run>) opens TI on that run, and from then on the run, not the visitor's city, has the camera. */
export function useOiShareLink({ oi, setOiMode, setMobilePanel, setActiveTool, autoLocateCancelled }: {
  oi: OiClient;
  setOiMode: Dispatch<SetStateAction<OiMode>>;
  setMobilePanel: Dispatch<SetStateAction<MobilePanel | null>>;
  setActiveTool: Dispatch<SetStateAction<ToolId | null>>;
  autoLocateCancelled: RefObject<boolean>;
}) {
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('oi');
    if (!id) return;
    autoLocateCancelled.current = true;
    setOiMode('forecast');
    if (window.matchMedia('(max-width: 767px)').matches) setMobilePanel('oi');
    else setActiveTool('oi');
    void oi.watch(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Once a run is under way the camera is the director's (lib/oi/camera).
  useEffect(() => { if (oi.runId) autoLocateCancelled.current = true; }, [oi.runId, autoLocateCancelled]);
}
