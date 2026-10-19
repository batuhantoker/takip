'use client';

import type { Dispatch, SetStateAction } from 'react';
import { Palette } from 'lucide-react';
import { LAYER_GROUPS } from '@/components/panels/layers/layer-groups';
import TerrainStatusNote from '@/components/map/controls/terrain-status-note';
import { MenuItem } from '@/components/ui/menu-item';
import { Segmented } from '@/components/ui/segmented';
import { Switch } from '@/components/ui/switch';
import { useT } from '@/components/ui/use-t';
import { msg } from '@/lib/core/i18n/translator';
import { BASEMAP_PROVIDERS, hasCartoKey, setBasemapProvider, type BasemapProvider } from '@/lib/map/basemap/provider';
import { useBasemapProvider } from '@/components/map/basemap/use-basemap-provider';
import type { TerrainStatus } from '@/lib/map/terrain/terrain';
import { BuildingLook } from './building-look';
import type { ThemeId } from './use-theme';

const THEMES: { value: ThemeId; label: string }[] = [{ value: 'core', label: 'Core' }, { value: 'ghost', label: 'Ghost' }];

/** Plain words for the display toggles; the layer list's own labels are written for a different place. */
const DISPLAY_COPY: Record<string, { label: string; note?: string }> = {
  day_night: { label: msg('Day and night'), note: msg('Shade the side of Earth in darkness') },
  terrain_3d: { label: msg('3D buildings'), note: msg('City detail from zoom 14.5') },
  terrain_elevation: { label: msg('3D terrain'), note: msg('Mountains from zoom 10') },
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
  const t = useT();
  const display = LAYER_GROUPS.find(g => g.label === 'DISPLAY')?.layers ?? [];
  const toggle = (key: string) => {
    if ((key === 'terrain_elevation' || key === 'terrain_3d') && !activeLayers[key]) on3DModeSelected();
    setActiveLayers((prev: any) => ({ ...prev, [key]: !prev[key] }));
  };
  return (
    <div className="flex flex-col gap-3">
      {display.map(layer => {
        const copy = DISPLAY_COPY[layer.key];
        const note = copy?.note ?? layer.description;
        return (
          <div key={layer.key}>
            <Switch label={t(copy?.label ?? layer.label)} description={note && t(note)}
              checked={!!activeLayers[layer.key]} onChange={() => toggle(layer.key)} />
            {layer.key === 'terrain_3d' && activeLayers.terrain_3d && <BuildingLook />}
            {layer.key === 'terrain_elevation' && activeLayers.terrain_elevation && (
              <TerrainStatusNote status={terrainStatus} onFocus={onTerrainFocus} onRetry={onTerrainRetry} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ThemePicker({ theme, setTheme }: { theme: ThemeId; setTheme: (theme: ThemeId) => void }) {
  const t = useT();
  return <Segmented label={t('Theme')} options={THEMES} value={theme} onChange={setTheme} size="sm" full />;
}

/** Which server draws the base map's tiles. */
export function TilesPicker() {
  const t = useT();
  const basemap = useBasemapProvider();
  return (
    <>
      <Segmented<BasemapProvider> label={t('Map tiles')} size="sm" full value={basemap} onChange={setBasemapProvider}
        options={BASEMAP_PROVIDERS.map(p => ({ value: p.id, label: p.label }))} />
      {basemap === 'carto' && !hasCartoKey && (
        <p className="mt-1.5 text-meta text-ink-3">{t('CARTO needs an API key: set {name}.', { name: 'NEXT_PUBLIC_CARTO_API_KEY' })}</p>
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
  const t = useT();
  return (
    <>
      <Label>{t('Display')}</Label>
      <DisplaySwitches {...display} />

      <Label>{t('Theme')}</Label>
      <ThemePicker theme={theme} setTheme={setTheme} />

      <Label>{t('Map tiles')}</Label>
      <TilesPicker />

      <div aria-hidden className="-mx-3 mt-4 border-t border-line" />
      <div className="-mx-2 mt-1 -mb-1">
        <MenuItem icon={Palette} hint={t('Colours, type, motion')} onSelect={onOpenStudio}>{t('Style studio')}</MenuItem>
      </div>
    </>
  );
}
