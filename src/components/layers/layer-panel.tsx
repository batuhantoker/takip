'use client';

import { memo, useState } from 'react';
import TerrainStatusNote from '@/components/map/terrain-status-note';
import type { TerrainStatus } from '@/lib/map-terrain';
import { LAYER_GROUPS, primary, type LayerDef, type LayerGroupDef } from './layer-groups';
import { BulkButton, LayerRow } from './layer-row';
import LayerListMobile from './layer-list-mobile';
import LayerSearchField from './layer-search-field';
import { filterLayerGroups } from './layer-search';
import { layerCount } from './layer-count';
import { groupTitle } from './layer-sections';

/** The phone's layer list, in the drawer. The desktop has LayersPane in the sidebar and the display toggles under map options. */
interface LayerPanelProps {
  data: any;
  activeLayers: any;
  setActiveLayers: React.Dispatch<React.SetStateAction<any>>;
  theme?: 'core' | 'ghost';
  setTheme?: (theme: 'core' | 'ghost') => void;
  /** Server-side capabilities, e.g. { cloudflare: true }. Layers declaring a
   *  `requires` key stay hidden until the matching capability is present. */
  capabilities?: Record<string, boolean>;
  terrainStatus?: TerrainStatus;
  onTerrainRetry?: () => void;
  onTerrainFocus?: () => void;
  on3DModeSelected?: () => void;
}

const isTerrain = (key: string) => key === 'terrain_elevation' || key === 'terrain_3d';

function LayerPanel({ data, activeLayers, setActiveLayers, theme = 'core', setTheme, capabilities = {}, terrainStatus = 'idle', onTerrainRetry, onTerrainFocus, on3DModeSelected }: LayerPanelProps) {
  const [studioOpen, setStudioOpen] = useState(false);
  const [query, setQuery] = useState('');

  const toggle = (key: string) => {
    if (isTerrain(key) && !activeLayers[key]) on3DModeSelected?.();
    setActiveLayers((prev: any) => ({ ...prev, [key]: !prev[key] }));
  };

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

  const masterControls = (
    <>
      <span className="text-[11px] font-mono tabular-nums text-white/60">{totalOn} on</span>
      <span className="flex-1" />
      <BulkButton label={`Turn every ${query ? 'matching ' : ''}layer on`} disabled={everyOn} onClick={() => setMany(allLayers, true)}>All</BulkButton>
      <BulkButton label={`Turn every ${query ? 'matching ' : ''}layer off`} disabled={totalOn === 0} onClick={() => setMany(allLayers, false)}>None</BulkButton>
    </>
  );

  const renderGroup = (group: LayerGroupDef) => {
    const Icon = group.icon;
    const counted = primary(group.layers);
    const on = counted.filter(l => activeLayers[l.key]).length;
    const title = groupTitle(group);
    return (
      <>
        <div className="flex items-center gap-2 mb-1 pb-1.5 border-b border-white/[0.1]">
          <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: on ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)' }} />
          <span className="text-[13px] font-medium text-white/80 flex-1 truncate">{title}</span>
          {on > 0 && <span className="text-[11px] font-mono tabular-nums text-[var(--cyan-primary)]">{on}/{counted.length}</span>}
          {counted.length > 1 && (
            <BulkButton label={`Turn ${on ? 'off' : 'on'} every ${title.toLowerCase()} layer`} onClick={() => toggleGroup(group.layers)}>
              {on ? 'None' : 'All'}
            </BulkButton>
          )}
        </div>
        <div className="flex flex-col gap-0.5">
          {group.layers.map(layer => (
            <LayerRow
              key={layer.key}
              layer={layer}
              active={!!activeLayers[layer.key]}
              count={layerCount(data, layer.dataKey, layer.catKey)}
              dormant={!!layer.parent && !activeLayers[layer.parent]}
              onToggle={() => toggle(layer.key)}
              mobile
            />
          ))}
          {group.label === 'DISPLAY' && activeLayers.terrain_elevation && (
            <TerrainStatusNote status={terrainStatus} onFocus={onTerrainFocus} onRetry={onTerrainRetry} />
          )}
        </div>
      </>
    );
  };

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

export default memo(LayerPanel);
