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
  return [
    `view:${view}`,
    `panel:${panel ?? 'none'}`,
    `device:${mobile ? 'mobile' : 'desktop'}`,
    ...windows.filter(w => !!w).map(w => `window:${w}`),
    ...dataLayersOn(layers).map(key => `layer:${key}`),
  ];
}
