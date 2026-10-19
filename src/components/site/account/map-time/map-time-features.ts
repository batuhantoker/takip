import { layerSection } from '@/components/panels/layers/lib/layer-gates';
import { dataLayersOn } from '@/components/shell/sidebar/nav-items';

export type MapTimeView = 'map' | 'space' | 'history' | 'replay';
export type MapTimeWindow = 'camera' | 'feed' | 'dossier' | 'search';

/** What the map's once-a-minute tick reports, so the admin's analytics can split time by feature (apps/api map-time.ts checks the names). */
export function mapTimeFeatures({ view, panel, layers, windows, mobile }: {
  view: MapTimeView;
  panel: string | null;
  layers: Record<string, boolean>;
  windows: (MapTimeWindow | false | null | undefined)[];
  mobile: boolean;
}): string[] {
  const on = dataLayersOn(layers);
  // The Layers sections (air, sea, …) with a layer on: what someone follows, counted on its own so reach adds up.
  const sections = new Set(on.map(layerSection).filter(Boolean));
  return [
    `view:${view}`,
    `panel:${panel ?? 'none'}`,
    `device:${mobile ? 'mobile' : 'desktop'}`,
    ...windows.filter(w => !!w).map(w => `window:${w}`),
    ...[...sections].map(section => `section:${section}`),
    ...on.map(key => `layer:${key}`),
  ];
}
