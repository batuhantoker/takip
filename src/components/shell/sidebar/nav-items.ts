import { Database, Hourglass, Layers, Orbit, Pentagon, Radar, Route, TriangleAlert } from 'lucide-react';
import { LAYER_GROUPS, primary } from '@/components/panels/layers/layer-groups';
import type { NavItem } from './nav-sidebar';

const DATA_LAYERS = primary(LAYER_GROUPS.filter(g => g.label !== 'DISPLAY').flatMap(g => g.layers));

/** Data layers switched on: display toggles and sub-layer filters don't count. */
export const dataLayersOn = (active: Record<string, boolean>) => DATA_LAYERS.filter(l => active[l.key]).map(l => l.key);
export const countLayersOn = (active: Record<string, boolean>) => dataLayersOn(active).length;

/**
 * The sidebar, top to bottom, in three groups by how often people reach for them:
 * what is on the map now, going somewhere in time or space, then the specialist tools.
 * TI is not here: it sits apart, below a rule. Keys are bound in use-keyboard-shortcuts.ts.
 */
export function navItems({ layersOn, arcgisCount, historyOn = false }: { layersOn: number; arcgisCount: number; historyOn?: boolean }): NavItem[][] {
  return [
    [
      { id: 'layers', label: 'Layers', hint: 'Choose what the map shows', kbd: 'L', icon: Layers, badge: layersOn },
      { id: 'alerts', label: 'Alerts', hint: 'Quakes, conflicts, breaking news', kbd: 'A', icon: TriangleAlert },
      { id: 'draw', label: 'Areas', hint: 'Draw an area and watch it', kbd: 'D', icon: Pentagon },
    ],
    [
      { id: 'history', label: 'History', hint: 'The past on a timeline', kbd: 'H', icon: Hourglass, running: historyOn },
      { id: 'space', label: 'Space', hint: 'Spacecraft and the ISS, live', icon: Orbit },
      { id: 'directions', label: 'Route', hint: 'Directions, turn by turn', icon: Route },
    ],
    [
      { id: 'recon', label: 'Recon', hint: 'Look up an IP, domain or name', kbd: 'I', icon: Radar },
      { id: 'arcgis', label: 'ArcGIS', hint: 'Find and add ArcGIS layers', icon: Database, badge: arcgisCount },
    ],
  ];
}
