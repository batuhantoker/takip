export interface ArcGISResult {
  id: string;
  title: string;
  url: string;
  snippet: string;
  owner: string;
  numViews: number;
  extent: number[][];
  tags: string[];
}

export interface ImportedLayer {
  id: string;
  title: string;
  url: string;
  geojson: any;
  color: string;
  visible: boolean;
  opacity: number;
}

export const CATEGORIES = [
  { label: 'Pipelines', query: 'pipeline' },
  { label: 'Power Grid', query: 'power grid transmission' },
  { label: 'Infrastructure', query: 'critical infrastructure' },
  { label: 'Military', query: 'military base installation' },
  { label: 'Emergency', query: 'emergency shelter evacuation' },
] as const;

export const LAYER_COLORS = [
  '#D4AF37', // Gold (default)
  '#00E5FF', // Cyan
  '#FF6B6B', // Red
  '#00E676', // Green
  '#FF9800', // Orange
  '#AB47BC', // Purple
  '#29B6F6', // Blue
  '#FFEE58', // Yellow
  '#EC407A', // Pink
  '#26A69A', // Teal
];

export function toBboxParam(mapBounds?: { west: number; south: number; east: number; north: number } | null): string {
  return mapBounds
    ? `${mapBounds.west},${mapBounds.south},${mapBounds.east},${mapBounds.north}`
    : '';
}

export function countFeatures(geojson: { type?: string; features?: unknown[] }): number {
  return (
    geojson.features?.length ??
    (geojson.type === 'FeatureCollection' ? 0 : 1)
  );
}

export function pickLayerColor(importedLayers: { color: string }[]): string {
  // Assign a color that doesn't overlap with existing layers
  const usedColors = importedLayers.map(l => l.color);
  return LAYER_COLORS.find(c => !usedColors.includes(c)) || LAYER_COLORS[importedLayers.length % LAYER_COLORS.length];
}
