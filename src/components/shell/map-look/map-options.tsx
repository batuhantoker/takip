'use client';

import type { Dispatch, SetStateAction } from 'react';
import { Palette } from 'lucide-react';
import { LAYER_GROUPS } from '@/components/panels/layers/layer-groups';
import TerrainStatusNote from '@/components/map/controls/terrain-status-note';
import { MenuItem } from '@/components/ui/menu-item';
import { Segmented } from '@/components/ui/segmented';
import { Switch } from '@/components/ui/switch';
import { BASEMAP_PROVIDERS, hasCartoKey, setBasemapProvider, type BasemapProvider } from '@/lib/map/basemap/provider';
import { useBasemapProvider } from '@/components/map/basemap/use-basemap-provider';
import type { TerrainStatus } from '@/lib/map/terrain/terrain';
import { BuildingLook } from './building-look';
import type { ThemeId } from './use-theme';

const THEMES: { value: ThemeId; label: string }[] = [{ value: 'core', label: 'Core' }, { value: 'ghost', label: 'Ghost' }];

/** Plain words for the display toggles; the layer list's own labels are written for a different place. */
const DISPLAY_COPY: Record<string, { label: string; note?: string }> = {
  day_night: { label: 'Day and night', note: 'Shade the side of Earth in darkness' },
  terrain_3d: { label: '3D buildings', note: 'City detail from zoom 14.5' },
  terrain_elevation: { label: '3D terrain', note: 'Mountains from zoom 10' },
};

export type DisplayProps = {
  activeLayers: Record<string, boolean>;
  setActiveLayers: Dispatch<SetStateAction<any>>;
  terrainStatus: TerrainStatus;
  on3DModeSelected: () => void;
  onTerrainFocus: () => void;
  onTerrainRetry: () => void;
};

const Label = ({ children }: { children: string }) => <p className="mt-5 mb-2 text-meta font-medium text-ink-3">{children}</p>;

/** Day and night, 3D buildings and 3D terrain: the display toggles kept out of Layers. */
export function DisplaySwitches({ activeLayers, setActiveLayers, terrainStatus, on3DModeSelected, onTerrainFocus, onTerrainRetry }: DisplayProps) {
  const display = LAYER_GROUPS.find(g => g.label === 'DISPLAY')?.layers ?? [];
  const toggle = (key: string) => {
    if ((key === 'terrain_elevation' || key === 'terrain_3d') && !activeLayers[key]) on3DModeSelected();
    setActiveLayers((prev: any) => ({ ...prev, [key]: !prev[key] }));
  };
  return (
    <div className="flex flex-col gap-3">
      {display.map(layer => (
        <div key={layer.key}>
          <Switch label={DISPLAY_COPY[layer.key]?.label ?? layer.label} description={DISPLAY_COPY[layer.key]?.note ?? layer.description}
            checked={!!activeLayers[layer.key]} onChange={() => toggle(layer.key)} />
          {layer.key === 'terrain_3d' && activeLayers.terrain_3d && <BuildingLook />}
          {layer.key === 'terrain_elevation' && activeLayers.terrain_elevation && (
            <TerrainStatusNote status={terrainStatus} onFocus={onTerrainFocus} onRetry={onTerrainRetry} />
          )}
        </div>
      ))}
    </div>
  );
}

export function ThemePicker({ theme, setTheme }: { theme: ThemeId; setTheme: (theme: ThemeId) => void }) {
  return <Segmented label="Theme" options={THEMES} value={theme} onChange={setTheme} size="sm" full />;
}

/** Which server draws the base map's tiles. */
export function TilesPicker() {
  const basemap = useBasemapProvider();
  return (
    <>
      <Segmented<BasemapProvider> label="Map tiles" size="sm" full value={basemap} onChange={setBasemapProvider}
        options={BASEMAP_PROVIDERS.map(p => ({ value: p.id, label: p.label }))} />
      {basemap === 'carto' && !hasCartoKey && (
        <p className="mt-1.5 text-meta text-ink-3">CARTO needs an API key: set NEXT_PUBLIC_CARTO_API_KEY.</p>
      )}
    </>
  );
}

/** How the map looks rather than what is on it: the display toggles kept out of Layers, the theme, the tiles and the Style Studio. */
export default function MapOptions({ theme, setTheme, onOpenStudio, ...display }: DisplayProps & {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
  onOpenStudio: () => void;
}) {
  return (
    <>
      <Label>Display</Label>
      <DisplaySwitches {...display} />

      <Label>Theme</Label>
      <ThemePicker theme={theme} setTheme={setTheme} />

      <Label>Map tiles</Label>
      <TilesPicker />

      <div aria-hidden className="-mx-3 mt-4 border-t border-line" />
      <div className="-mx-2 mt-1 -mb-1">
        <MenuItem icon={Palette} hint="Colours, type, motion" onSelect={onOpenStudio}>Style studio</MenuItem>
      </div>
    </>
  );
}
