import { Database, Hourglass, Layers, Orbit, Pentagon, Radar, Route, TriangleAlert } from 'lucide-react';
import { LAYER_GROUPS, primary } from '@/components/panels/layers/layer-groups';
import type { DesktopLayout } from '@/components/shell/layout/lib/model';
import { msg } from '@/lib/core/i18n/translator';
import type { NavItem } from './nav-sidebar';

const DATA_LAYERS = primary(LAYER_GROUPS.filter(g => g.label !== 'DISPLAY').flatMap(g => g.layers));

/** Data layers switched on: display toggles and sub-layer filters don't count. */
export const dataLayersOn = (active: Record<string, boolean>) => DATA_LAYERS.filter(l => active[l.key]).map(l => l.key);
export const countLayersOn = (active: Record<string, boolean>) => dataLayersOn(active).length;

/**
 * The sidebar's entries in the designed order, their words marked for translation where they render. TI is not here: it sits apart, below a rule.
 * The gaps that group them, and any order the person picked, are the layout's (shell/layout).
 * Keys are bound in use-keyboard-shortcuts.ts.
 */
export function navItems({ layersOn, arcgisCount, historyOn = false }: { layersOn: number; arcgisCount: number; historyOn?: boolean }): NavItem[] {
  return [
    { id: 'layers', label: msg('Layers'), hint: msg('Choose what the map shows'), kbd: 'L', icon: Layers, badge: layersOn },
    { id: 'alerts', label: msg('Alerts'), hint: msg('Quakes, conflicts, breaking news'), kbd: 'A', icon: TriangleAlert },
    { id: 'draw', label: msg('Areas'), hint: msg('Draw an area and watch it'), kbd: 'D', icon: Pentagon },
    { id: 'history', label: msg('History'), hint: msg('The past on a timeline'), kbd: 'H', icon: Hourglass, running: historyOn },
    { id: 'space', label: msg('Space'), hint: msg('Spacecraft and the ISS, live'), icon: Orbit },
    { id: 'directions', label: msg('Route'), hint: msg('Directions, turn by turn'), icon: Route },
    { id: 'recon', label: msg('Recon'), hint: msg('Look up an IP, domain or name'), kbd: 'I', icon: Radar },
    { id: 'arcgis', label: msg('ArcGIS'), hint: msg('Find and add ArcGIS layers'), icon: Database, badge: arcgisCount },
  ];
}

/** The entries in the person's order, grouped where they asked for a gap; a hidden entry's gap passes to the next one shown. */
export function railGroups(items: NavItem[], { rail, railBreaks, hidden }: Pick<DesktopLayout, 'rail' | 'railBreaks' | 'hidden'>): NavItem[][] {
  const byId = new Map(items.map(item => [item.id, item]));
  const groups: NavItem[][] = [];
  let gap = false;
  for (const id of rail) {
    if (railBreaks.includes(id)) gap = true;
    const item = byId.get(id);
    if (!item || hidden.includes(`rail:${id}`)) continue;
    if (!groups.length || gap) groups.push([]);
    gap = false;
    groups[groups.length - 1].push(item);
  }
  return groups;
}
