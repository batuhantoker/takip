import { AlertTriangle, Database, Hourglass, Layers, PenLine, Radar, Radio, Route } from 'lucide-react';
import { LAYER_GROUPS, primary } from '@/components/layers/layer-groups';
import type { NavItem } from './nav-sidebar';

const DATA_LAYERS = primary(LAYER_GROUPS.filter(g => g.label !== 'DISPLAY').flatMap(g => g.layers));

/** Data layers switched on: display toggles and sub-layer filters don't count. */
export const countLayersOn = (active: Record<string, boolean>) => DATA_LAYERS.filter(l => active[l.key]).length;

/** The sidebar, top to bottom. TI is not here: it sits apart, below a rule. */
export function navItems({ layersOn, arcgisCount }: { layersOn: number; arcgisCount: number }): NavItem[] {
  return [
    { id: 'layers', label: 'Layers', title: 'Layers: choose what the map shows (L)', icon: Layers, badge: layersOn },
    { id: 'draw', label: 'Areas', title: 'Areas: draw an area, see what is inside it, watch it for changes (D)', icon: PenLine },
    { id: 'alerts', label: 'Alerts', title: 'Live alerts: earthquakes, conflicts, breaking news (A)', icon: AlertTriangle },
    { id: 'history', label: 'History', title: 'History: wars, attacks and country statistics on a timeline', icon: Hourglass },
    { id: 'recon', label: 'Recon', title: 'OSINT recon: IP lookup, network sweep, geolocation (I)', icon: Radar },
    { id: 'directions', label: 'Route', title: 'Directions: turn-by-turn routing', icon: Route },
    { id: 'space', label: 'Space', title: 'Space: every spacecraft JPL Horizons tracks, and the ISS live feed', icon: Radio },
    { id: 'arcgis', label: 'ArcGIS', title: 'ArcGIS: search and import geospatial layers', icon: Database, badge: arcgisCount },
  ];
}
