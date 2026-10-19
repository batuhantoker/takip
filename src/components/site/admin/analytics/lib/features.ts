import { MAP_LAYER_SECTIONS, type MapLayerSection } from '@takip/core/entitlements';
import { LAYER_GROUPS } from '@/components/panels/layers/layer-groups';
import { sectionTitle } from '@/components/panels/layers/lib/layer-gates';

const VIEWS: Record<string, string> = {
  map: 'Map',
  space: 'Space view',
  history: 'History',
  replay: 'Replay',
  wall: 'Hit the time limit',
};

// Panel ids are the sidebar's ToolId and the phone's MobilePanel.
const PANELS: Record<string, string> = {
  layers: 'Layers',
  alerts: 'Alerts',
  draw: 'Areas',
  history: 'History',
  space: 'Space',
  directions: 'Route',
  recon: 'Recon',
  arcgis: 'ArcGIS',
  ai: 'TI',
  markets: 'Markets',
  intel: 'Intel',
  search: 'Search',
  none: 'No panel open',
};

const WINDOWS: Record<string, string> = { camera: 'Camera', feed: 'Live feed', dossier: 'Region dossier', search: 'Search' };
const DEVICES: Record<string, string> = { desktop: 'Desktop', mobile: 'Phone' };

let layerLabels: Map<string, string> | null = null;
const layerLabel = (key: string) => {
  layerLabels ??= new Map(LAYER_GROUPS.flatMap(g => g.layers.map(l => [l.key, l.label] as const)));
  return layerLabels.get(key);
};

// The Layers panel's sections ('section:air' → "Air"), as the map counts them: a section with any layer on.
const sectionLabel = (id: string) => ((MAP_LAYER_SECTIONS as readonly string[]).includes(id) ? sectionTitle(id as MapLayerSection) : undefined);

/** The sections in the Layers panel's own order, so each keeps its place in lists and charts. */
export const SECTION_ORDER = MAP_LAYER_SECTIONS;

const humanize = (id: string) => {
  const words = id.replace(/[_-]+/g, ' ').trim();
  return words ? words[0].toUpperCase() + words.slice(1) : id;
};

export type FeatureKind = 'view' | 'panel' | 'layer' | 'section' | 'window' | 'device' | 'other';

export function splitFeature(feature: string): { kind: FeatureKind; id: string } {
  const at = feature.indexOf(':');
  const kind = feature.slice(0, at);
  const id = feature.slice(at + 1);
  return ['view', 'panel', 'layer', 'section', 'window', 'device'].includes(kind) ? { kind: kind as FeatureKind, id } : { kind: 'other', id: feature };
}

/** 'panel:directions' → 'Route', 'layer:wx_radar' → 'Radar', 'section:air' → 'Air', 'view:wall' → 'Hit the time limit'. */
export function featureLabel(feature: string) {
  const { kind, id } = splitFeature(feature);
  const table = kind === 'view' ? VIEWS : kind === 'panel' ? PANELS : kind === 'window' ? WINDOWS : kind === 'device' ? DEVICES : null;
  return table?.[id] ?? (kind === 'layer' ? layerLabel(id) : kind === 'section' ? sectionLabel(id) : undefined) ?? humanize(id);
}

/** 'panel:directions' → 'Route panel', for lists that mix kinds. */
export function featureLongLabel(feature: string) {
  const { kind, id } = splitFeature(feature);
  const label = featureLabel(feature);
  if (kind === 'panel') return id === 'none' ? label : `${label} panel`;
  if (kind === 'layer') return `${label} layer`;
  if (kind === 'section') return `${label} section`;
  if (kind === 'window') return `${label} window`;
  if (kind === 'view' && id !== 'wall') return `${label} view`;
  return label;
}

/** A visitor's first arrival with no referring site: typed, bookmarked, or the referrer was withheld. */
export const DIRECT_ARRIVAL = 'Direct or hidden';

/** The fixed slot each view takes in SERIES_INK, so a view keeps its colour whatever else is shown. */
export const VIEW_ORDER = ['map', 'space', 'history', 'replay', 'wall'] as const;
