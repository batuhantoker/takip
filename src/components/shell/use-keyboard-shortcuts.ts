'use client';

import { useEffect, type Dispatch, type SetStateAction } from 'react';
import type { ActiveLayers } from '@/lib/default-layers';
import type { OiMode } from '@/components/oi/oi-panel';
import type { ToolId } from './dock';
import type { FlyToTarget, MapProjection, MobilePanel } from './dashboard-types';

export function useKeyboardShortcuts({
  setShowDesktopSearch, setActiveTool, setOiMode, setOiAutoFocus, setMobilePanel, setShowLayers, setFlyToLocation, setActiveLayers, setMapProjection,
}: {
  setShowDesktopSearch: Dispatch<SetStateAction<boolean>>;
  setActiveTool: Dispatch<SetStateAction<ToolId | null>>;
  setOiMode: Dispatch<SetStateAction<OiMode>>;
  setOiAutoFocus: Dispatch<SetStateAction<boolean>>;
  setMobilePanel: Dispatch<SetStateAction<MobilePanel | null>>;
  setShowLayers: Dispatch<SetStateAction<boolean>>;
  setFlyToLocation: Dispatch<SetStateAction<FlyToTarget | null>>;
  setActiveLayers: Dispatch<SetStateAction<ActiveLayers>>;
  setMapProjection: Dispatch<SetStateAction<MapProjection>>;
}) {
  // Keyboard shortcuts — keep shell/keyboard-shortcuts.tsx in step with these.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable)) return;
      // The full-screen workspace has keys of its own.
      if (document.documentElement.hasAttribute('data-oi-theater')) return;
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'f' || e.key === 'k')) {
        e.preventDefault();
        setShowDesktopSearch(true);
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const toggle = (tool: ToolId) => setActiveTool(cur => (cur === tool ? null : tool));
      switch (e.key) {
        case 'f':
          if (document.fullscreenElement) document.exitFullscreen();
          else document.documentElement.requestFullscreen();
          break;
        case 't':
        case 'o':
          setOiMode('assist');
          setOiAutoFocus(true);
          if (window.matchMedia('(max-width: 767px)').matches) setMobilePanel('oi');
          else setActiveTool('oi');
          break;
        case 's': setShowDesktopSearch(p => !p); break;
        case 'l': setShowLayers(p => !p); break;
        case 'd': toggle('draw'); break;
        case 'a': toggle('alerts'); break;
        case 'i': toggle('recon'); break;
        case 'm': toggle('markets'); break;
        case 'r': setFlyToLocation({ lat: 20, lng: 0, zoom: 2.5, ts: Date.now() }); break;
        case 'g':
          setActiveLayers(prev => ({ ...prev, terrain_elevation: false, terrain_3d: false }));
          setMapProjection(p => p === 'globe' ? 'mercator' : 'globe');
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
