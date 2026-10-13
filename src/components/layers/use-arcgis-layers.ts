'use client';

import { useCallback, useState } from 'react';
import type { ImportedLayer } from '@/lib/arcgis-layers';
import type { ArcGISPanelProps } from './arcgis-panel';

/** Layers imported from ArcGIS, and the panel's handlers for them. */
export function useArcgisLayers() {
  const [arcgisLayers, setArcgisLayers] = useState<ImportedLayer[]>([]);

  const importLayer: ArcGISPanelProps['onImportLayer'] = useCallback(layer => setArcgisLayers(prev => [
    ...prev.filter(l => l.id !== layer.id),
    { ...layer, color: layer.color || '#D4AF37', visible: true, opacity: layer.opacity ?? 0.8 },
  ]), []);
  const removeLayer = useCallback((id: string) => setArcgisLayers(prev => prev.filter(l => l.id !== id)), []);
  const updateLayer: ArcGISPanelProps['onUpdateLayer'] = useCallback((id, updates) => setArcgisLayers(prev => prev.map(l => (l.id === id ? { ...l, ...updates } : l))), []);

  const onMap = arcgisLayers.filter(l => l.visible).map(l => ({ id: l.id, title: l.title, geojson: l.geojson, color: l.color, opacity: l.opacity }));

  return { arcgisLayers, importLayer, removeLayer, updateLayer, onMap };
}

export type ArcgisLayers = ReturnType<typeof useArcgisLayers>;
