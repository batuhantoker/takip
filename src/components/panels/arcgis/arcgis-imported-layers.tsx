'use client';

import { useEffect, useState } from 'react';
import { Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ListRow } from '@/components/ui/list-row';
import { PanelSection } from '@/components/ui/panel';
import { Switch } from '@/components/ui/switch';
import { useT, type RichTranslate } from '@/components/ui/use-t';
import { countFeatures, type ImportedLayer } from '@/lib/map/layers/arcgis';
import { ArcgisLayerOptions } from './arcgis-layer-options';
import { layerTitle } from './arcgis-result-row';

const UNDO_FOR_MS = 8000;

// The API asks ArcGIS for at most this many features per layer.
const FEATURE_CAP = 2000;

const number = (n: number, t: RichTranslate) => <span className="font-mono tabular-nums">{n.toLocaleString(t.intl)}</span>;

const features = (n: number, t: RichTranslate) => n === 0 ? t('No features where you searched')
  : n >= FEATURE_CAP ? t.rich('{n, plural, one {First {count} feature} other {First {count} features}}', { n, count: number(n, t) })
  : t.rich('{n, plural, one {{count} feature} other {{count} features}}', { n, count: number(n, t) });

/** "1 layer", or "3 layers · 4,210 features" once there are several to add up. */
function layerCount(n: number, features: number, t: RichTranslate) {
  if (!n) return undefined;
  if (n === 1) return t('{n, plural, one {# layer} other {# layers}}', { n });
  return t.rich('{n, plural, one {# layer} other {# layers}} · {features, plural, one {{count} feature} other {{count} features}}', { n, features, count: number(features, t) });
}

export default function ArcGISImportedLayers({ importedLayers, onUpdateLayer, onRemoveLayer, onRestoreLayer }: {
  importedLayers: ImportedLayer[];
  onUpdateLayer: (id: string, updates: Partial<{ color: string; visible: boolean; opacity: number }>) => void;
  onRemoveLayer: (id: string) => void;
  onRestoreLayer: (layer: ImportedLayer) => void;
}) {
  const t = useT();
  const [removed, setRemoved] = useState<ImportedLayer | null>(null);

  useEffect(() => {
    if (!removed) return;
    const timer = window.setTimeout(() => setRemoved(null), UNDO_FOR_MS);
    return () => window.clearTimeout(timer);
  }, [removed]);

  const counts = new Map(importedLayers.map(l => [l.id, countFeatures(l.geojson ?? {})]));
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const undoable = removed && !importedLayers.some(l => l.id === removed.id) ? removed : null;
  if (!importedLayers.length && !undoable) return null;

  return (
    <PanelSection title={t('On the map')} hint={layerCount(importedLayers.length, total, t)}>
      {importedLayers.map(layer => (
        <ListRow
          key={layer.id}
          leading={<span aria-hidden className="size-2.5 rounded-full" style={{ background: layer.color, opacity: layer.visible ? 1 : 0.35 }} />}
          title={layerTitle(layer.title)}
          subtitle={layer.visible ? features(counts.get(layer.id) ?? 0, t) : t('Hidden')}
          trailing={
            <>
              <Switch size="sm" hideLabel label={t('Show {layer}', { layer: layer.title })} checked={layer.visible}
                onChange={visible => onUpdateLayer(layer.id, { visible })} className="mr-1.5" />
              <ArcgisLayerOptions layer={layer} onUpdate={u => onUpdateLayer(layer.id, u)}
                onRemove={() => { onRemoveLayer(layer.id); setRemoved(layer); }} />
            </>
          }
        />
      ))}
      {undoable && (
        <div role="status" className="mt-2 flex items-center gap-2 text-small text-ink-2">
          <span className="min-w-0 flex-1 truncate">{t('Removed “{layer}”', { layer: layerTitle(undoable.title) })}</span>
          <Button variant="ghost" size="sm" icon={Undo2} onClick={() => { onRestoreLayer(undoable); setRemoved(null); }}>{t('Undo')}</Button>
        </div>
      )}
    </PanelSection>
  );
}
