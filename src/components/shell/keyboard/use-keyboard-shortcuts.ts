'use client';

import { useEffect, useEffectEvent, type Dispatch, type SetStateAction } from 'react';
import { stepCamera } from '@/components/map/controls/map-controls';
import type { ActiveLayers } from '@/lib/layers/defaults';
import type { OiMode } from '@/components/panels/ti-agent/ti-panel';
import type { ToolId } from '@/components/shell/sidebar/dock';
import type { FlyToTarget, MapProjection, MobilePanel } from '@/components/shell/state/types';

const PANEL_KEYS: Record<string, ToolId> = { l: 'layers', a: 'alerts', d: 'draw', h: 'history', i: 'recon', m: 'markets' };
const PAN: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

/** The app's single keys. keyboard-shortcuts.tsx lists them; keep the two in step. */
export function useKeyboardShortcuts({
  setShowDesktopSearch, onTool, onReplay, setOiMode, setOiAutoFocus, setMobilePanel, setActiveTool, setFlyToLocation, setActiveLayers, setMapProjection,
}: {
  setShowDesktopSearch: Dispatch<SetStateAction<boolean>>;
  /** Opens a sidebar panel, or closes it if it is the one showing. */
  onTool: (tool: ToolId) => void;
  onReplay: () => void;
  setOiMode: Dispatch<SetStateAction<OiMode>>;
  setOiAutoFocus: Dispatch<SetStateAction<boolean>>;
  setMobilePanel: Dispatch<SetStateAction<MobilePanel | null>>;
  setActiveTool: Dispatch<SetStateAction<ToolId | null>>;
  setFlyToLocation: Dispatch<SetStateAction<FlyToTarget | null>>;
  setActiveLayers: Dispatch<SetStateAction<ActiveLayers>>;
  setMapProjection: Dispatch<SetStateAction<MapProjection>>;
}) {
  const handle = useEffectEvent((e: KeyboardEvent) => {
    const t = e.target instanceof HTMLElement ? e.target : null;
    if (t && (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable)) return;
    // The full-screen workspace has keys of its own.
    if (document.documentElement.hasAttribute('data-oi-theater')) return;
    if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'f' || e.key === 'k')) {
      e.preventDefault();
      setShowDesktopSearch(true);
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
    // The map handles its own keys while it has focus.
    const onMap = !!t?.closest('.maplibregl-map');

    if (e.key === '/') { e.preventDefault(); setShowDesktopSearch(true); return; }
    if (!onMap && (e.key === '+' || e.key === '=')) { stepCamera({ kind: 'zoom', dir: 1 }); return; }
    if (!onMap && (e.key === '-' || e.key === '_')) { stepCamera({ kind: 'zoom', dir: -1 }); return; }
    // Arrows belong to whatever has focus; only an unclaimed press moves the map.
    if (PAN[e.key] && (!t || t === document.body || t === document.documentElement)) {
      e.preventDefault();
      const [dx, dy] = PAN[e.key];
      stepCamera({ kind: 'pan', dx, dy });
      return;
    }
    if (e.shiftKey) return;

    const key = e.key.toLowerCase();
    if (PANEL_KEYS[key]) { onTool(PANEL_KEYS[key]); return; }
    switch (key) {
      case 'f':
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen?.();
        break;
      case 't':
      case 'o':
        setOiMode('assist');
        setOiAutoFocus(true);
        if (window.matchMedia('(max-width: 767px)').matches) setMobilePanel('oi');
        else setActiveTool('oi');
        break;
      case 's': setShowDesktopSearch(p => !p); break;
      case 'p': onReplay(); break;
      case 'r': setFlyToLocation({ lat: 20, lng: 0, zoom: 2.5, ts: Date.now() }); break;
      case 'g':
        setActiveLayers(prev => ({ ...prev, terrain_elevation: false, terrain_3d: false }));
        setMapProjection(p => (p === 'globe' ? 'mercator' : 'globe'));
        break;
    }
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => handle(e);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
