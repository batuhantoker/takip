'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plane, Satellite, Sun, AlertTriangle, Camera,
  CloudLightning, Ship, Network, Database, Ghost,
  Flame, Tv, Radio, Mountain, Anchor, Megaphone, SlidersHorizontal, CloudSun
} from 'lucide-react';
import StyleStudio from '@/components/shell/style-studio';
import { TERRAIN_MIN_ZOOM, type TerrainStatus } from '@/lib/map-terrain';
import { SHIP_CLASSES, SHIPS_UNDERWAY } from '@/lib/ship-filter';

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

interface LayerDef {
  key: string;
  label: string;
  dataKey: string;
  description?: string;
  /** Reads a bucket out of data.category_counts instead of a top-level array. */
  catKey?: string;
  /** Capability that must be configured server-side for this layer to appear. */
  requires?: string;
  /** Key of the layer this one modifies. Renders indented beneath it, and reads
   *  as inert while that parent is off — it has nothing to act on. */
  parent?: string;
}

interface LayerGroupDef {
  label: string;
  fullLabel: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  layers: LayerDef[];
}

const LAYER_GROUPS: LayerGroupDef[] = [
  {
    label: 'SDK',
    fullLabel: 'TAKIP SDK',
    icon: Network,
    layers: [
      { key: 'sdk_sea', label: 'Maritime Lines', dataKey: 'sdk_entities' },
    ],
  },
  {
    label: 'WEATHER',
    fullLabel: 'GLOBAL WEATHER',
    icon: CloudSun,
    layers: [
      { key: 'wx_temperature', label: 'Temperature', description: 'Open-Meteo · global · hourly', dataKey: '' },
      { key: 'wx_wind', label: 'Wind', description: 'Open-Meteo · 10 m · arrows show where it blows', dataKey: '' },
      { key: 'wx_radar', label: 'Rain Radar', description: 'RainViewer · where ground radar exists', dataKey: '' },
      { key: 'live_clouds', label: 'Live Clouds', description: 'NOAA satellites · lit in 3D · hourly', dataKey: '' },
    ],
  },
  {
    label: 'AVIATION',
    fullLabel: 'AVIATION',
    icon: Plane,
    layers: [
      { key: 'flights', label: 'Commercial', dataKey: 'commercial_flights' },
      { key: 'private', label: 'Private', dataKey: 'private_flights' },
      { key: 'jets', label: 'Private Jets', dataKey: 'private_jets' },
      { key: 'military', label: 'Military', dataKey: 'military_flights' },
    ],
  },
  {
    label: 'MARITIME',
    fullLabel: 'MARITIME',
    icon: Ship,
    layers: [
      { key: 'maritime', label: 'Maritime / Naval', dataKey: 'maritime_ships,maritime_ports,maritime_chokepoints' },
      { key: SHIPS_UNDERWAY, label: 'Underway only', description: 'Hide anchored and moored', dataKey: '', parent: 'maritime' },
      ...SHIP_CLASSES.map(c => ({ key: c.key, label: c.label, dataKey: '', parent: 'maritime' })),
    ],
  },
  {
    label: 'SPACE',
    fullLabel: 'SPACE TRACKING',
    icon: Satellite,
    layers: [
      { key: 'satellites', label: 'All Satellites', dataKey: 'satellites' },
      { key: 'sat_comms', label: 'Starlink / Comms', dataKey: 'satellites', catKey: 'comms' },
      { key: 'sat_military', label: 'Military / Intel', dataKey: 'satellites', catKey: 'military' },
      { key: 'sat_navigation', label: 'GPS / Navigation', dataKey: 'satellites', catKey: 'navigation' },
      { key: 'sat_earth', label: 'Earth Observation', dataKey: 'satellites', catKey: 'earth_obs' },
      { key: 'sat_science', label: 'Stations / Telescopes', dataKey: 'satellites', catKey: 'science' },
    ],
  },
  {
    label: 'SURVEIL',
    fullLabel: 'SURVEILLANCE',
    icon: Camera,
    layers: [
      { key: 'cctv', label: 'CCTV Cameras', dataKey: 'cameras' },
      { key: 'cctv_previews', label: 'Live Previews', dataKey: '', parent: 'cctv' },
      { key: 'live_news', label: 'Live News Feeds', dataKey: 'live_feeds' },
    ],
  },
  {
    label: 'HAZARD',
    fullLabel: 'NATURAL HAZARDS',
    icon: CloudLightning,
    layers: [
      { key: 'earthquakes', label: 'Earthquakes', dataKey: 'earthquakes' },
      { key: 'fires', label: 'Active Fires', dataKey: 'fires' },
      { key: 'weather', label: 'Severe Weather', dataKey: 'weather_events' },
    ],
  },
  {
    label: 'THREAT',
    fullLabel: 'THREATS & INTEL',
    icon: AlertTriangle,
    layers: [
      { key: 'infrastructure', label: 'Nuclear Facilities', dataKey: 'infrastructure' },
      { key: 'global_incidents', label: 'Global Incidents', dataKey: 'gdelt' },
      { key: 'alert_pins', label: 'Live Alert Pins', dataKey: 'alert_pins' },
      { key: 'gdelt_events', label: 'GDELT Events', dataKey: 'gdelt_events' },
    ],
  },
  {
    label: 'NETWORK',
    fullLabel: 'NETWORK INTEL',
    icon: Network,
    layers: [
      { key: 'malware', label: 'Live Malware', dataKey: 'malware_threats' },
      { key: 'cyber_attacks', label: 'Botnet C2 Servers', dataKey: 'cyber_attacks' },
    ],
  },
  {
    label: 'NETINTEL',
    fullLabel: 'NET & EVENT INTEL',
    icon: Megaphone,
    layers: [
      { key: 'cf_outages', label: 'Internet Outages', dataKey: 'cf_outages', requires: 'cloudflare' },
      { key: 'cf_attacks', label: 'Attack Origins', dataKey: 'cf_attack_origins', requires: 'cloudflare' },
    ],
  },
  {
    label: 'DISPLAY',
    fullLabel: 'DISPLAY',
    icon: Sun,
    layers: [
      { key: 'day_night', label: 'Day / Night Cycle', dataKey: '' },
      { key: 'terrain_3d', label: '3D Buildings', description: 'City detail · zoom 14.5+', dataKey: '' },
      { key: 'terrain_elevation', label: '3D Terrain', description: 'Mountains · zoom 10+', dataKey: '' },
    ],
  },
];

/* ── Minimal Toggle Switch ── */
/**
 * Presentational only. The row around it is the button, and a button inside a
 * button is invalid HTML — the browser reparents it, which breaks hydration and
 * silently drops the click handler on the inner control.
 */
function ToggleSwitch({ active }: { active: boolean }) {
  return (
    <span
      role="presentation"
      className="relative flex-shrink-0 block"
      style={{ width: 28, height: 14 }}
    >
      <div
        className="absolute inset-0 rounded-full transition-all duration-300"
        style={{
          background: active ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.04)',
          border: active ? '1px solid rgba(255,255,255,0.45)' : '1px solid rgba(255,255,255,0.28)',
          boxShadow: active ? '0 0 8px rgba(255,255,255,0.1)' : 'none',
        }}
      />
      <motion.div
        className="absolute top-[2px] rounded-full"
        style={{
          width: 10,
          height: 10,
          background: active ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.4)',
          boxShadow: active ? '0 0 6px rgba(255,255,255,0.4)' : 'none',
        }}
        animate={{ left: active ? 16 : 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    </span>
  );
}

/**
 * The elbow that ties a sub-layer row to the layer above it. Indentation alone
 * reads as a typo at this size; the line is what says "this belongs to that".
 */
function SubLayerStem() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute left-[6px] top-0 h-1/2 w-[8px] rounded-bl-[3px] border-b border-l border-white/[0.25]"
    />
  );
}

function BulkButton({ onClick, disabled, children, label }: { onClick: () => void; disabled?: boolean; children: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      disabled={disabled}
      aria-label={label}
      className="px-1.5 py-0.5 rounded text-[10px] font-mono tracking-wider text-white/70 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-35 disabled:pointer-events-none focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
    >
      {children}
    </button>
  );
}

function LayerRow({ layer, active, count, dormant, onToggle, mobile }: {
  layer: LayerDef; active: boolean; count: number | null; dormant: boolean; onToggle: () => void; mobile?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      aria-label={layer.label}
      title={dormant ? 'Turn the layer above on to use this' : undefined}
      className={`relative w-full flex items-center gap-3 ${mobile ? 'py-2' : 'py-1'} rounded-md hover:bg-white/[0.06] transition-colors cursor-pointer text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30 ${layer.parent ? 'pl-[22px] pr-1' : 'px-1'} ${dormant ? 'opacity-50' : ''}`}
    >
      {layer.parent && <SubLayerStem />}
      <ToggleSwitch active={active} />
      <span className={`text-[11px] font-mono uppercase tracking-wider flex-1 transition-colors duration-200 ${active ? 'text-white' : 'text-white/65'}`}>
        {layer.label}
        {layer.description && <span className="block mt-0.5 text-[9px] normal-case tracking-normal text-white/55">{layer.description}</span>}
      </span>
      {count !== null && (
        <span className={`text-[10px] font-mono tabular-nums transition-colors ${active ? 'text-white/75' : 'text-white/45'}`}>
          {count.toLocaleString()}
        </span>
      )}
    </button>
  );
}

const isTerrain = (key: string) => key === 'terrain_elevation' || key === 'terrain_3d';
/** Sub-layers modify a parent rather than draw anything, so they never count as "on". */
const primary = (layers: LayerDef[]) => layers.filter(l => !l.parent);

/** Two columns of about equal height, in order. Weighed from the definitions alone so no group
 *  jumps columns when a layer is switched or the terrain notes open. */
function splitColumns<T extends { layers: LayerDef[] }>(groups: T[]): [T[], T[]] {
  const weight = (g: T) => 1.5 + g.layers.reduce((n, l) => n + (l.description ? 1.4 : 1), 0);
  const total = groups.reduce((n, g) => n + weight(g), 0);
  let split = 0, bestDiff = Infinity, acc = 0;
  for (let k = 0; k <= groups.length; k++) {
    const diff = Math.abs(total - 2 * acc);
    if (diff < bestDiff) { bestDiff = diff; split = k; }
    if (k < groups.length) acc += weight(groups[k]);
  }
  return [groups.slice(0, split), groups.slice(split)];
}

function LayerPanel({ data, activeLayers, setActiveLayers, isMobile, theme = 'core', setTheme, capabilities = {}, terrainStatus = 'idle', onTerrainRetry, onTerrainFocus, on3DModeSelected, revealed = true }: LayerPanelProps) {
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  /** The group whose rail icon opened the panel; it is scrolled to and marked. */
  const [focusGroup, setFocusGroup] = useState<string | null>(null);
  const [studioOpen, setStudioOpen] = useState(false);
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

  const allLayers = visibleGroups.flatMap(g => g.layers);
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
      <BulkButton label="Turn every layer on" disabled={everyOn} onClick={() => setMany(allLayers, true)}>ALL</BulkButton>
      <BulkButton label="Turn every layer off" disabled={totalOn === 0} onClick={() => setMany(allLayers, false)}>NONE</BulkButton>
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
      <div className="flex flex-col gap-5 py-2">
        <div className="flex items-center gap-2 px-1">
          <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-white/85">All layers</span>
          {masterControls}
        </div>
        {visibleGroups.map((group) => (
          <div key={group.label}>{renderGroup(group, true)}</div>
        ))}

        {/* MOBILE STYLE STUDIO */}
        <div className="flex items-center justify-between mt-2 pt-3 border-t border-white/[0.06] px-1">
          <span className="text-[10px] font-mono tracking-[0.2em] text-white/25 uppercase">Style Studio</span>
          <button
            onClick={() => setStudioOpen(o => !o)}
            aria-pressed={studioOpen}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
            style={{
              background: studioOpen ? 'var(--hover-accent)' : 'transparent',
              boxShadow: studioOpen ? '0 0 12px var(--gold-glow)' : 'none',
            }}
          >
            <SlidersHorizontal className="w-4 h-4" style={{ color: studioOpen ? 'var(--gold-primary)' : 'rgba(255,255,255,0.25)' }} />
          </button>
        </div>
        <AnimatePresence>
          {studioOpen && <StyleStudio isMobile onClose={() => setStudioOpen(false)} />}
        </AnimatePresence>

        {/* MOBILE GHOST TOGGLE */}
        {setTheme && (
          <div className="flex items-center justify-between pt-3 border-t border-white/[0.06] px-1">
            <span className="text-[10px] font-mono tracking-[0.2em] text-white/25 uppercase">Ghost Protocol</span>
            <button
              onClick={() => setTheme(theme === 'core' ? 'ghost' : 'core')}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
              style={{
                background: theme === 'ghost' ? 'rgba(179, 136, 255, 0.15)' : 'transparent',
                boxShadow: theme === 'ghost' ? '0 0 12px rgba(179, 136, 255, 0.3)' : 'none',
              }}
            >
              <Ghost className="w-4 h-4" style={{ color: theme === 'ghost' ? '#B388FF' : 'rgba(255,255,255,0.25)' }} />
            </button>
          </div>
        )}
      </div>
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
      <div className="flex-1 flex flex-col items-center gap-1">
        {visibleGroups.map((group) => {
          const counted = primary(group.layers);
          const activeCount = counted.filter(l => activeLayers[l.key]).length;
          const groupActive = activeCount > 0;
          const isHovered = hoveredGroup === group.label;
          const isFocused = open && focusGroup === group.label;
          const Icon = group.icon;

          return (
            <button
              key={group.label}
              type="button"
              onClick={() => openAt(group.label)}
              onMouseEnter={() => setHoveredGroup(group.label)}
              onMouseLeave={() => setHoveredGroup(null)}
              aria-expanded={open}
              aria-controls="layer-panel"
              aria-label={`${group.fullLabel}${activeCount ? ` — ${activeCount} active` : ''}`}
              title={group.fullLabel}
              className="relative w-10 h-10 flex items-center justify-center cursor-pointer rounded-lg transition-colors duration-200 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
              style={{
                background: isFocused
                  ? 'rgba(255,255,255,0.10)'
                  : isHovered ? 'rgba(255,255,255,0.05)' : 'transparent',
              }}
            >
              <Icon
                className="transition-all duration-300"
                style={{
                  width: 16,
                  height: 16,
                  color: groupActive
                    ? 'rgba(255,255,255,0.75)'
                    : isHovered || isFocused
                      ? 'rgba(255,255,255,0.45)'
                      : 'rgba(255,255,255,0.22)',
                  filter: groupActive ? 'drop-shadow(0 0 4px rgba(255,255,255,0.3))' : 'none',
                }}
              />
              {activeCount > 0 && (
                <span
                  className="absolute top-1 right-1 min-w-[13px] h-[13px] px-[3px] rounded-full flex items-center justify-center text-[9px] font-mono tabular-nums leading-none"
                  style={{
                    background: 'rgba(0,229,255,0.9)',
                    color: '#04040A',
                    boxShadow: '0 0 6px rgba(0,229,255,0.5)',
                  }}
                >
                  {activeCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            id="layer-panel"
            role="dialog"
            aria-label="Map layers"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            // Stops above the map view strip in the bottom-left corner.
            className="absolute left-[52px] top-24 w-[264px] lg:w-[492px] max-h-[calc(100%-264px)] flex flex-col rounded-xl z-[100] pointer-events-auto"
            style={{
              background: 'var(--bg-panel-solid)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.65)',
            }}
          >
            <div className="flex items-center gap-2 px-3 pt-2.5 pb-2 border-b border-white/[0.1] shrink-0">
              <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-white/90">Layers</span>
              {masterControls}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close layers"
                className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-mono text-white/70 hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
              >
                ✕
              </button>
            </div>
            <div className="min-h-0 overflow-y-auto styled-scrollbar p-2 flex flex-col lg:flex-row gap-2">
              {splitColumns(visibleGroups).map((column, i) => (
                <div key={i} className="flex-1 min-w-0 flex flex-col gap-1">
                  {column.map((group) => {
                    const lit = (hoveredGroup ?? focusGroup) === group.label;
                    return (
                      <section
                        key={group.label}
                        ref={el => { sectionRefs.current[group.label] = el; }}
                        className="rounded-lg p-2 transition-colors duration-200"
                        style={{ background: lit ? 'rgba(255,255,255,0.06)' : 'transparent' }}
                      >
                        {renderGroup(group)}
                      </section>
                    );
                  })}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
