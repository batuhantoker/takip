'use client';

import { useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Palette, Settings2 } from 'lucide-react';
import { LAYER_GROUPS } from '@/components/layers/layer-groups';
import { LayerRow } from '@/components/layers/layer-row';
import TerrainStatusNote from '@/components/map/terrain-status-note';
import { useDismiss } from '@/components/ui/use-dismiss';
import { BASEMAP_PROVIDERS, hasCartoKey, setBasemapProvider, useBasemapProvider } from '@/lib/basemap/provider';
import type { TerrainStatus } from '@/lib/map-terrain';
import StyleStudio from './style-studio';
import type { ThemeId } from './use-theme';

const THEMES: { id: ThemeId; label: string }[] = [{ id: 'core', label: 'Core' }, { id: 'ghost', label: 'Ghost' }];

/** How the map looks rather than what is on it: the display toggles kept out of Layers, the theme and the Style Studio. */
export default function MapOptions({ activeLayers, setActiveLayers, theme, setTheme, terrainStatus, on3DModeSelected, onTerrainFocus, onTerrainRetry, compact = false }: {
  activeLayers: Record<string, boolean>;
  setActiveLayers: Dispatch<SetStateAction<any>>;
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
  terrainStatus: TerrainStatus;
  on3DModeSelected: () => void;
  onTerrainFocus: () => void;
  onTerrainRetry: () => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);
  const basemap = useBasemapProvider();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  useDismiss(open, () => setOpen(false), rootRef, buttonRef);

  const display = LAYER_GROUPS.find(g => g.label === 'DISPLAY')?.layers ?? [];
  const toggle = (key: string) => {
    if ((key === 'terrain_elevation' || key === 'terrain_3d') && !activeLayers[key]) on3DModeSelected();
    setActiveLayers((prev: any) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div ref={rootRef} className="relative">
      <button ref={buttonRef} type="button" onClick={() => setOpen(v => !v)} aria-expanded={open} aria-haspopup="dialog"
        title="Map options: day and night, 3D, theme, colours"
        className={`h-8 flex items-center gap-1.5 px-2.5 rounded-md text-[11px] transition-colors ${open ? 'bg-white/10 text-[var(--text-heading)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.05]'}`}>
        <Settings2 className="w-3.5 h-3.5" />
        <span className={compact ? 'hidden 2xl:inline' : ''}>Options</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div role="dialog" aria-label="Map options"
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.15 }}
            className="absolute bottom-full right-0 mb-2 w-[300px] rounded-xl border border-white/10 bg-[var(--bg-panel-solid)]/95 backdrop-blur-2xl shadow-[0_16px_48px_rgba(0,0,0,0.6)] p-3">
            <p className="mb-1.5 text-[11px] font-medium text-[var(--text-secondary)]">Display</p>
            <div className="flex flex-col gap-0.5">
              {display.map(layer => (
                <div key={layer.key}>
                  <LayerRow layer={layer} active={!!activeLayers[layer.key]} count={null} dormant={false} onToggle={() => toggle(layer.key)} />
                  {layer.key === 'terrain_elevation' && activeLayers.terrain_elevation && (
                    <TerrainStatusNote status={terrainStatus} onFocus={onTerrainFocus} onRetry={onTerrainRetry} />
                  )}
                </div>
              ))}
            </div>
            <div className="my-3 h-px bg-white/[0.06]" />
            <p className="mb-1.5 text-[11px] font-medium text-[var(--text-secondary)]">Theme</p>
            <div className="flex gap-1 p-[3px] rounded-lg bg-white/[0.04]">
              {THEMES.map(t => (
                <button key={t.id} type="button" onClick={() => setTheme(t.id)} aria-pressed={theme === t.id}
                  className={`flex-1 h-7 rounded-md text-[11px] transition-colors ${theme === t.id ? 'bg-white/10 text-[var(--text-heading)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
                  {t.label}
                </button>
              ))}
            </div>
            <p className="mt-3 mb-1.5 text-[11px] font-medium text-[var(--text-secondary)]">Base map tiles</p>
            <div className="flex gap-1 p-[3px] rounded-lg bg-white/[0.04]">
              {BASEMAP_PROVIDERS.map(p => (
                <button key={p.id} type="button" onClick={() => setBasemapProvider(p.id)} aria-pressed={basemap === p.id}
                  className={`flex-1 h-7 rounded-md text-[11px] transition-colors ${basemap === p.id ? 'bg-white/10 text-[var(--text-heading)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
                  {p.label}
                </button>
              ))}
            </div>
            {basemap === 'carto' && !hasCartoKey && (
              <p className="mt-1.5 text-[10.5px] leading-snug text-[var(--text-muted)]">CARTO asks for an API key: set NEXT_PUBLIC_CARTO_API_KEY.</p>
            )}
            <button type="button" onClick={() => { setOpen(false); setStudioOpen(true); }}
              className="mt-2 w-full h-8 flex items-center gap-2 px-2 rounded-md text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.05]">
              <Palette className="w-3.5 h-3.5 text-[var(--gold-primary)]" />
              Style studio: accents, colours, type, motion
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {studioOpen && <StyleStudio onClose={() => setStudioOpen(false)} />}
      </AnimatePresence>
    </div>
  );
}
