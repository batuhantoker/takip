'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Ghost, SlidersHorizontal } from 'lucide-react';
import StyleStudio from '@/components/shell/style-studio';
import { TERRAIN_MIN_ZOOM, type TerrainStatus } from '@/lib/map-terrain';
import { LAYER_GROUPS, primary, type LayerDef, type LayerGroupDef } from './layer-groups';
import { BulkButton, LayerRow } from './layer-row';
import LayerRail from './layer-rail';
import LayerFlyout from './layer-flyout';
import LayerListMobile from './layer-list-mobile';
import LayerSearchField from './layer-search-field';
import { filterLayerGroups } from './layer-search';

interface LayerPanelProps {
  data: any;
  activeLayers: any;
  setActiveLayers: React.Dispatch<React.SetStateAction<any>>;
  isMobile?: boolean;
  theme?: 'core' | 'ghost';
  setTheme?: (theme: 'core' | 'ghost') => void;
  /** Server-side capabilities, e.g. { cloudflare: true }. Layers declaring a
   *  `requires` key stay hidden until the matching capability is present. */
  capabilities?: Record<string, boolean>;
  terrainStatus?: TerrainStatus;
  onTerrainRetry?: () => void;
  onTerrainFocus?: () => void;
  on3DModeSelected?: () => void;
  /** False while the splash is up; the rail slides in when it turns true. */
  revealed?: boolean;
}

const isTerrain = (key: string) => key === 'terrain_elevation' || key === 'terrain_3d';

function LayerPanel({ data, activeLayers, setActiveLayers, isMobile, theme = 'core', setTheme, capabilities = {}, terrainStatus = 'idle', onTerrainRetry, onTerrainFocus, on3DModeSelected, revealed = true }: LayerPanelProps) {
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  /** The group whose rail icon opened the panel; it is scrolled to and marked. */
  const [focusGroup, setFocusGroup] = useState<string | null>(null);
  const [studioOpen, setStudioOpen] = useState(false);
  const [query, setQuery] = useState('');
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (open && focusGroup) sectionRefs.current[focusGroup]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [open, focusGroup]);

  const openAt = (label: string) => {
    if (open && focusGroup === label) { setOpen(false); return; }
    setFocusGroup(label);
    setQuery('');
    setOpen(true);
  };

  const toggle = (key: string) => {
    if (isTerrain(key) && !activeLayers[key]) on3DModeSelected?.();
    setActiveLayers((prev: any) => ({ ...prev, [key]: !prev[key] }));
  };
  const terrainDetails = activeLayers.terrain_elevation ? (
    <div className="mt-2 rounded-lg border border-white/10 bg-white/[0.03] p-2.5 text-[10px] text-white/60">
      <p role="status">{terrainStatus === 'idle' ? `Terrain at zoom ${TERRAIN_MIN_ZOOM}+ · zoom in` : terrainStatus === 'waiting' ? 'Terrain starts when you stop moving' : terrainStatus === 'loading' ? 'Loading nearby terrain…' : terrainStatus === 'error' ? 'Terrain unavailable; the map is still usable.' : 'Terrain on'}</p>
      {terrainStatus === 'idle' && <button type="button" onClick={onTerrainFocus} className="mt-2 min-h-8 rounded border border-white/15 px-2 text-[var(--gold-primary)] hover:bg-white/10">Zoom to terrain</button>}
      {terrainStatus === 'error' && <button type="button" onClick={onTerrainRetry} className="mt-2 min-h-8 rounded border border-white/15 px-2 text-[var(--gold-primary)] hover:bg-white/10">Retry terrain</button>}
      <p className="mt-2 text-white/35">Nearby detail only · cached tiles</p>
      <a className="mt-1 inline-block underline underline-offset-2" href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noopener noreferrer">Terrain credits</a>
    </div>
  ) : null;

  const setMany = (layers: LayerDef[], on: boolean) => {
    if (on && layers.some(l => isTerrain(l.key) && !activeLayers[l.key])) on3DModeSelected?.();
    setActiveLayers((prev: any) => {
      const next = { ...prev };
      // Sub-layers are settings on their parent, not layers; bulk switches leave them be.
      for (const l of primary(layers)) next[l.key] = on;
      return next;
    });
  };
  /** Off if any are on, otherwise all on. */
  const toggleGroup = (layers: LayerDef[]) => setMany(layers, !primary(layers).some(l => activeLayers[l.key]));

  /* Drop layers whose backing capability is not configured, then drop any group
     left with nothing to show. */
  const visibleGroups = LAYER_GROUPS.map(g => ({
    ...g,
    layers: g.layers.filter(l => !l.requires || capabilities[l.requires]),
  })).filter(g => g.layers.length > 0);

  // Bulk switches and the count act on what the search leaves showing.
  const shownGroups = filterLayerGroups(visibleGroups, query);
  const allLayers = shownGroups.flatMap(g => g.layers);
  const totalOn = primary(allLayers).filter(l => activeLayers[l.key]).length;
  const everyOn = primary(allLayers).every(l => activeLayers[l.key]);

  const getCount = (dk: string, catKey?: string): number | null => {
    if (!dk) return null;
    if (catKey && data.category_counts) {
      return data.category_counts[catKey] || 0;
    }
    let total = 0;
    let found = false;
    for (const k of dk.split(',')) {
      if (data[k] && Array.isArray(data[k])) {
        total += data[k].length;
        found = true;
      }
    }
    return found ? total : null;
  };

  const masterControls = (
    <>
      <span className="text-[10px] font-mono tabular-nums text-white/60">{totalOn} on</span>
      <span className="flex-1" />
      <BulkButton label={`Turn every ${query ? 'matching ' : ''}layer on`} disabled={everyOn} onClick={() => setMany(allLayers, true)}>ALL</BulkButton>
      <BulkButton label={`Turn every ${query ? 'matching ' : ''}layer off`} disabled={totalOn === 0} onClick={() => setMany(allLayers, false)}>NONE</BulkButton>
    </>
  );

  const renderGroup = (group: LayerGroupDef, mobile = false) => {
    const Icon = group.icon;
    const counted = primary(group.layers);
    const on = counted.filter(l => activeLayers[l.key]).length;
    return (
      <>
        <div className="flex items-center gap-2 mb-1 pb-1.5 border-b border-white/[0.1]">
          <Icon className="w-3 h-3 flex-shrink-0 transition-colors" style={{ color: on ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)' }} />
          <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-white/70 flex-1 truncate">{group.fullLabel}</span>
          {on > 0 && <span className="text-[9px] font-mono tabular-nums text-[var(--cyan-primary)]">{on}/{counted.length}</span>}
          {counted.length > 1 && (
            <BulkButton label={`Turn ${on ? 'off' : 'on'} every ${group.fullLabel.toLowerCase()} layer`} onClick={() => toggleGroup(group.layers)}>
              {on ? 'NONE' : 'ALL'}
            </BulkButton>
          )}
        </div>
        <div className="flex flex-col gap-0.5">
          {group.layers.map(layer => (
            <LayerRow
              key={layer.key}
              layer={layer}
              active={!!activeLayers[layer.key]}
              count={getCount(layer.dataKey, layer.catKey)}
              dormant={!!layer.parent && !activeLayers[layer.parent]}
              onToggle={() => toggle(layer.key)}
              mobile={mobile}
            />
          ))}
          {group.label === 'DISPLAY' && terrainDetails}
        </div>
      </>
    );
  };

  /* ── MOBILE ── */
  if (isMobile) {
    return (
      <LayerListMobile
        visibleGroups={shownGroups}
        masterControls={masterControls}
        searchField={<LayerSearchField query={query} setQuery={setQuery} mobile />}
        renderGroup={renderGroup}
        studioOpen={studioOpen}
        setStudioOpen={setStudioOpen}
        theme={theme}
        setTheme={setTheme}
      />
    );
  }

  /* ── DESKTOP ── */
  return (
    <motion.div
      initial={{ x: -60, opacity: 0 }}
      animate={revealed ? { x: 0, opacity: 1 } : { x: -60, opacity: 0 }}
      transition={{ type: 'spring', damping: 30, stiffness: 200, delay: 0.25 }}
      className="absolute top-0 left-0 h-full w-[48px] flex flex-col items-center pt-24 pb-6 z-50 pointer-events-auto"
      style={{
        background: 'rgba(0,0,0,0.15)',
        backdropFilter: 'blur(24px) saturate(1.2)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.2)',
      }}
    >
      <LayerRail
        visibleGroups={visibleGroups}
        activeLayers={activeLayers}
        hoveredGroup={hoveredGroup}
        setHoveredGroup={setHoveredGroup}
        open={open}
        focusGroup={focusGroup}
        openAt={openAt}
      />

      <LayerFlyout
        open={open}
        setOpen={setOpen}
        visibleGroups={shownGroups}
        hoveredGroup={hoveredGroup}
        focusGroup={focusGroup}
        sectionRefs={sectionRefs}
        masterControls={masterControls}
        searchField={<LayerSearchField query={query} setQuery={setQuery} autoFocus />}
        renderGroup={renderGroup}
      />

      {/* Subtle separator */}
      <div className="w-5 h-px bg-white/[0.06] my-2" />

      {/* Style Studio */}
      <button
        onClick={() => setStudioOpen(o => !o)}
        aria-pressed={studioOpen}
        className="w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-500 cursor-pointer"
        style={{ background: studioOpen ? 'var(--hover-accent)' : 'transparent' }}
        title="Style Studio"
      >
        <SlidersHorizontal
          className="transition-all duration-500"
          style={{
            width: 15,
            height: 15,
            color: studioOpen ? 'var(--gold-primary)' : 'rgba(255,255,255,0.15)',
            filter: studioOpen ? 'drop-shadow(0 0 6px var(--gold-glow))' : 'none',
          }}
        />
      </button>
      <AnimatePresence>
        {studioOpen && <StyleStudio onClose={() => setStudioOpen(false)} />}
      </AnimatePresence>

      {/* Ghost Protocol Toggle */}
      {setTheme && (
        <button
          onClick={() => setTheme(theme === 'core' ? 'ghost' : 'core')}
          className="w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-500 cursor-pointer"
          style={{
            background: theme === 'ghost' ? 'rgba(179, 136, 255, 0.1)' : 'transparent',
          }}
          title="Ghost Protocol"
        >
          <Ghost
            className="transition-all duration-500"
            style={{
              width: 15,
              height: 15,
              color: theme === 'ghost' ? '#B388FF' : 'rgba(255,255,255,0.15)',
              filter: theme === 'ghost' ? 'drop-shadow(0 0 6px rgba(179, 136, 255, 0.5))' : 'none',
            }}
          />
        </button>
      )}
    </motion.div>
  );
}

export default memo(LayerPanel);
