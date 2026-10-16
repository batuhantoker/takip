'use client';

import { useEffect, useState } from 'react';
import { Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ListRow } from '@/components/ui/list-row';
import { PanelSection } from '@/components/ui/panel';
import { Switch } from '@/components/ui/switch';
import { countFeatures, type ImportedLayer } from '@/lib/map/layers/arcgis';
import { ArcgisLayerOptions } from './arcgis-layer-options';
import { layerTitle } from './arcgis-result-row';

const UNDO_FOR_MS = 8000;

// The API asks ArcGIS for at most this many features per layer.
const FEATURE_CAP = 2000;

const features = (n: number) => n === 0 ? 'No features where you searched' : (
  <>{n >= FEATURE_CAP && 'First '}<span className="font-mono tabular-nums">{n.toLocaleString()}</span> {n === 1 ? 'feature' : 'features'}</>
);

/** "1 layer", or "3 layers · 4,210 features" once there are several to add up. */
function layerCount(n: number, features: number) {
  if (!n) return undefined;
  if (n === 1) return '1 layer';
  return <>{n} layers · <span className="font-mono tabular-nums">{features.toLocaleString()}</span> {features === 1 ? 'feature' : 'features'}</>;
}

export default function ArcGISImportedLayers({ importedLayers, onUpdateLayer, onRemoveLayer, onRestoreLayer }: {
  importedLayers: ImportedLayer[];
  onUpdateLayer: (id: string, updates: Partial<{ color: string; visible: boolean; opacity: number }>) => void;
  onRemoveLayer: (id: string) => void;
  onRestoreLayer: (layer: ImportedLayer) => void;
}) {
  const [removed, setRemoved] = useState<ImportedLayer | null>(null);

  useEffect(() => {
    if (!removed) return;
    const t = window.setTimeout(() => setRemoved(null), UNDO_FOR_MS);
    return () => window.clearTimeout(t);
  }, [removed]);

  const counts = new Map(importedLayers.map(l => [l.id, countFeatures(l.geojson ?? {})]));
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const undoable = removed && !importedLayers.some(l => l.id === removed.id) ? removed : null;
  if (!importedLayers.length && !undoable) return null;

  return (
    <PanelSection title="On the map" hint={layerCount(importedLayers.length, total)}>
      {importedLayers.map(layer => (
        <ListRow
          key={layer.id}
          leading={<span aria-hidden className="size-2.5 rounded-full" style={{ background: layer.color, opacity: layer.visible ? 1 : 0.35 }} />}
          title={layerTitle(layer.title)}
          subtitle={layer.visible ? features(counts.get(layer.id) ?? 0) : 'Hidden'}
          trailing={
            <>
              <Switch size="sm" hideLabel label={`Show ${layer.title}`} checked={layer.visible}
                onChange={visible => onUpdateLayer(layer.id, { visible })} className="mr-1.5" />
              <ArcgisLayerOptions layer={layer} onUpdate={u => onUpdateLayer(layer.id, u)}
                onRemove={() => { onRemoveLayer(layer.id); setRemoved(layer); }} />
            </>
          }
        />
      ))}
      {undoable && (
        <div role="status" className="mt-2 flex items-center gap-2 text-small text-ink-2">
          <span className="min-w-0 flex-1 truncate">Removed “{layerTitle(undoable.title)}”</span>
          <Button variant="ghost" size="sm" icon={Undo2} onClick={() => { onRestoreLayer(undoable); setRemoved(null); }}>Undo</Button>
        </div>
      )}
    </PanelSection>
  );
}
