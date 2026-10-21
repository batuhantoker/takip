'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { IconButton } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { useT } from '@/components/ui/use-t';
import { AU_KM, C_KM_S } from '@/lib/space/astro';
import type { ExoplanetPayload } from '@/lib/space/deep/exoplanets';
import { distance, lightTime } from '@/lib/space/format';
import type { FleetPayload } from '@/lib/space/craft/fleet';
import type { NearbyStarCatalog } from '@/lib/space/deep/nearby-stars';
import type { OuterPayload } from '@/lib/space/deep/outer';
import type { CameraInfo, SpaceLayers } from '@/lib/space/scene/types';
import SpaceLayerList from './space-layer-list';

/** The space view's left panel: where the camera is, what is drawn, and where it all comes from. */

const FOLD_KEY = 'takip.space.layersFolded';

function loadFolded(): boolean {
  try { return window.localStorage.getItem(FOLD_KEY) === '1'; } catch { return false; }
}

export default function SpacePanelLeft({ camera, layers, setLayers, fleet, satelliteCount, deep }: {
  camera: CameraInfo | null;
  layers: SpaceLayers;
  setLayers: (l: SpaceLayers) => void;
  fleet: FleetPayload | null;
  satelliteCount: number;
  deep: { outer: OuterPayload | null; exoplanets: ExoplanetPayload | null; catalog: NearbyStarCatalog | null };
}) {
  const t = useT();
  // Folded to its header, it still says where the camera is; remembered, since it is a matter of taste.
  const [folded, setFoldedState] = useState(() => typeof window !== 'undefined' && loadFolded());
  const setFolded = (f: boolean) => {
    setFoldedState(f);
    try { window.localStorage.setItem(FOLD_KEY, f ? '1' : '0'); } catch { /* storage blocked */ }
  };
  const counts: Partial<Record<keyof SpaceLayers, string>> = {
    satellites: satelliteCount ? satelliteCount.toLocaleString(t.intl) : '',
    fleet: fleet ? `${fleet.craft.filter(c => c.region !== 'earth-orbit').length.toLocaleString(t.intl)}${fleet.pending ? '…' : ''}` : '…',
    exoplanets: deep.exoplanets ? deep.exoplanets.hosts.length.toLocaleString(t.intl) : '',
  };
  const known = camera && Number.isFinite(camera.distanceKm);
  const far = (camera?.sunKm ?? 0) > 30 * AU_KM && camera?.anchorName !== 'Sun' && camera?.anchorName !== 'Solar system';
  const light = known && camera.distanceKm / C_KM_S < 365.25 * 86_400 && camera.distanceKm > 1e7 ? lightTime(camera.distanceKm / C_KM_S, t) : null;

  const anchor = camera ? t(camera.anchorName) : t('Earth');
  const away = known ? distance(camera.distanceKm, t) : '';
  const fromSun = far && camera ? distance(camera.sunKm, t) : '';
  const where = !known ? undefined
    : light && far ? t('The camera is {distance} from {anchor}, {time} at light speed, {sun} from the Sun', { distance: away, anchor, time: light, sun: fromSun })
      : light ? t('The camera is {distance} from {anchor}, {time} at light speed', { distance: away, anchor, time: light })
        : far ? t('The camera is {distance} from {anchor}, {sun} from the Sun', { distance: away, anchor, sun: fromSun })
          : t('The camera is {distance} from {anchor}', { distance: away, anchor });

  // Named apart from the sidebar's Layers, which are the map's; where the camera is goes underneath.
  return (
    <Panel docked={false} bare={folded} className="pointer-events-auto w-[280px] shrink-0" title={t('Space layers')}
      subtitle={known ? <span title={where} className="tabular-nums">{t('{distance} from {anchor}', { distance: away, anchor })}</span> : t('Placing the camera…')}
      actions={<IconButton icon={folded ? ChevronDown : ChevronUp} label={folded ? t('Show the layers') : t('Fold away')} tooltipSide="right"
        aria-expanded={!folded} onClick={() => setFolded(!folded)} />}>
      {!folded && <SpaceLayerList layers={layers} setLayers={setLayers} counts={counts} deep={deep} />}
    </Panel>
  );
}
