'use client';

import { memo, useCallback, useMemo } from 'react';
import { SearchX } from 'lucide-react';
import TerrainStatusNote from '@/components/map/controls/terrain-status-note';
import { EmptyState } from '@/components/ui/empty-state';
import { SearchField } from '@/components/ui/search-field';
import { useT } from '@/components/ui/use-t';
import { msg } from '@/lib/core/i18n/translator';
import type { TerrainStatus } from '@/lib/map/terrain/terrain';
import { LAYER_GROUPS } from './layer-groups';
import LayerSection from '@/components/panels/layers/parts/layer-section';
import type { LayerSection as Section } from '@/components/panels/layers/lib/layer-sections';
import LayersOnMap from '@/components/panels/layers/parts/layers-on-map';
import MapLookMobile from '@/components/shell/map-look/map-look-mobile';
import { useLayerBrowser } from './use-layer-browser';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the page's live data and layer state are untyped
type Loose = any;

/** The phone's layer list, in the drawer. The desktop has LayersPane in the sidebar and the display toggles under map options. */
interface LayerPanelProps {
  data: Loose;
  activeLayers: Loose;
  setActiveLayers: React.Dispatch<React.SetStateAction<Loose>>;
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
const NO_CAPABILITIES: Record<string, boolean> = {};

function LayerPanel({ data, activeLayers, setActiveLayers, theme = 'core', setTheme, capabilities = NO_CAPABILITIES, terrainStatus = 'idle', onTerrainRetry, onTerrainFocus, on3DModeSelected }: LayerPanelProps) {
  const t = useT();
  // Display settings sit under map options on a desktop; a phone has only this list.
  const display = useMemo<Section[]>(() => LAYER_GROUPS
    .filter(g => g.label === 'DISPLAY')
    .map(g => ({ id: 'display', title: msg('Display'), groups: [g], subheadings: false })), []);
  const beforeTurnOn = useCallback((keys: string[]) => { if (keys.some(isTerrain)) on3DModeSelected?.(); }, [on3DModeSelected]);
  const b = useLayerBrowser({ data, activeLayers, setActiveLayers, capabilities, extraGroups: display, beforeTurnOn });

  return (
    <div className="flex flex-col gap-5 pb-2 text-ink-2">
      {/* iOS zooms into inputs under 16 px. */}
      <SearchField value={b.query} onChange={b.setQuery} placeholder={t('Search {n} layers', { n: b.layerTotal })} autoComplete="off" spellCheck={false}
        className="h-10 [&_input]:text-base" />
      {!b.searching && <div><LayersOnMap items={b.onMap} undo={b.undo} onTurnOff={b.turnOff} onUndo={b.restore} /></div>}
      {b.shown.length === 0 ? (
        <EmptyState icon={SearchX} title={t('No layers match “{query}”', { query: b.query.trim() })} body={t('Search matches layer names and their sources, such as ships, quakes or ADS-B.')} />
      ) : (
        <div>
          {b.searching && <p role="status" className="mb-1 text-meta text-ink-3">{t('{n, plural, one {# layer matches} other {# layers match}}', { n: b.matchCount })}</p>}
          <div>
            {b.shown.map(section => (
              <LayerSection
                key={section.id}
                section={section}
                open={b.isOpen(section.id)}
                onOpenChange={open => b.setOpen(section.id, open)}
                activeLayers={activeLayers}
                countOf={b.countOf}
                searching={b.searching}
                onToggle={b.toggle}
                onSetMany={(keys, on) => {
                  b.setMany(keys, on);
                  if (on) b.setOpen(section.id, true);
                }}
                after={label => label === 'DISPLAY' && activeLayers.terrain_elevation
                  ? <TerrainStatusNote status={terrainStatus} onFocus={onTerrainFocus} onRetry={onTerrainRetry} />
                  : null}
              />
            ))}
          </div>
        </div>
      )}
      <div><MapLookMobile theme={theme} setTheme={setTheme} /></div>
    </div>
  );
}

export default memo(LayerPanel);
