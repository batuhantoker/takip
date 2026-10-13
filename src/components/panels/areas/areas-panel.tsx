'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, PenLine, Trash2, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Panel, PanelSection } from '@/components/ui/panel';
import type { DrawMode, DrawProgress, DrawnShape } from '@/lib/areas/draw';
import type { WatchEvent } from '@/lib/areas/watch';
import AoiContents from '@/components/panels/areas/parts/aoi-contents';
import AreaRow from '@/components/panels/areas/parts/area-row';
import { framing } from './area-view';
import ShapePicker from '@/components/panels/areas/parts/shape-picker';
import WatchLog from '@/components/panels/areas/parts/watch-log';

interface DrawingToolbarProps {
  drawMode: DrawMode | null;
  onSetDrawMode: (m: DrawMode | null) => void;
  progress: DrawProgress | null;
  polygons: DrawnShape[];
  onDeletePolygon: (id: string) => void;
  onClearAll: () => void;
  /** Puts deleted shapes back: gets the current list, returns the restored one. */
  onRestore?: (update: (current: DrawnShape[]) => DrawnShape[]) => void;
  onExportGeoJSON: () => void;
  selectedPolygon: string | null;
  onSelectPolygon: (id: string | null) => void;
  onRenamePolygon: (id: string, name: string) => void;
  /** Live entity store, swept for whatever falls inside each shape. */
  data?: Record<string, unknown>;
  onLocateEntity?: (lat: number, lng: number) => void;
  /** Frame a whole shape on the map. */
  onLocateArea?: (lat: number, lng: number, zoom: number) => void;
  watched?: Set<string>;
  onToggleWatch?: (id: string) => void;
  watchEvents?: WatchEvent[];
  onClose?: () => void;
}

const UNDO_MS = 8000;

/** Areas: draw a shape, see what is inside it, watch it for changes. */
export default function DrawingToolbar({
  drawMode, onSetDrawMode, progress, polygons, onDeletePolygon, onClearAll, onRestore, onExportGeoJSON,
  selectedPolygon, onSelectPolygon, onRenamePolygon, data, onLocateEntity, onLocateArea,
  watched, onToggleWatch, watchEvents = [], onClose,
}: DrawingToolbarProps) {
  const [undo, setUndo] = useState<{ message: string; shapes: DrawnShape[] } | null>(null);
  const undoTimer = useRef<number | undefined>(undefined);
  const seen = useRef<Set<string> | null>(null);

  // A shape just drawn is the one you want to look inside; one brought back by Undo is not new.
  useEffect(() => {
    const ids = polygons.map(p => p.id);
    const fresh = seen.current && ids.find(id => !seen.current!.has(id));
    if (fresh) onSelectPolygon(fresh);
    seen.current = new Set([...(seen.current ?? []), ...ids]);
  }, [polygons, onSelectPolygon]);

  useEffect(() => () => window.clearTimeout(undoTimer.current), []);

  const offerUndo = useCallback((message: string) => {
    if (!onRestore) return;
    setUndo({ message, shapes: polygons });
    window.clearTimeout(undoTimer.current);
    undoTimer.current = window.setTimeout(() => setUndo(null), UNDO_MS);
  }, [onRestore, polygons]);

  const restore = () => {
    if (!undo || !onRestore) return;
    const kept = new Set(undo.shapes.map(s => s.id));
    // Anything drawn since the delete stays, ahead of what comes back.
    onRestore(current => [...current.filter(s => !kept.has(s.id)), ...undo.shapes]);
    window.clearTimeout(undoTimer.current);
    setUndo(null);
  };

  const remove = (shape: DrawnShape) => {
    offerUndo(`Deleted ${shape.name}`);
    if (selectedPolygon === shape.id) onSelectPolygon(null);
    onDeletePolygon(shape.id);
  };

  const clearAll = () => {
    offerUndo(`Cleared ${polygons.length} ${polygons.length === 1 ? 'shape' : 'shapes'}`);
    onClearAll();
  };

  const show = (shape: DrawnShape) => {
    const f = framing(shape);
    if (f) onLocateArea?.(f.lat, f.lng, f.zoom);
  };

  const select = (shape: DrawnShape) => {
    if (selectedPolygon === shape.id) { onSelectPolygon(null); return; }
    onSelectPolygon(shape.id);
    show(shape);
  };

  const selected = polygons.find(p => p.id === selectedPolygon) ?? null;
  const watchCount = polygons.filter(p => watched?.has(p.id)).length;
  const subtitle = polygons.length === 0
    ? 'Draw a shape to see what’s inside it'
    : `${polygons.length} ${polygons.length === 1 ? 'shape' : 'shapes'}${watchCount ? ` · ${watchCount} watched` : ''}`;

  const footer = undo ? (
    <>
      <span className="min-w-0 flex-1 truncate text-small text-ink-2" role="status">{undo.message}</span>
      <Button size="sm" icon={Undo2} onClick={restore}>Undo</Button>
    </>
  ) : polygons.length > 0 ? (
    <>
      <Button size="sm" icon={Download} onClick={onExportGeoJSON}>Export GeoJSON</Button>
      <Button size="sm" variant="ghost" icon={Trash2} className="-mr-2 ml-auto" onClick={clearAll}>Clear all</Button>
    </>
  ) : undefined;

  return (
    <Panel title="Areas" subtitle={subtitle} onClose={onClose} closeOnEscape={!drawMode} footer={footer}>
      <PanelSection title="Draw">
        <ShapePicker mode={drawMode} onChange={onSetDrawMode} busy={(progress?.vertices ?? 0) > 0} />
      </PanelSection>

      <PanelSection title="Your shapes" hint={polygons.length || undefined}>
        {polygons.length === 0 ? (
          <EmptyState icon={PenLine} title="No shapes yet"
            body="What you draw is kept here between visits. Select a shape to see what’s inside it or to watch it." className="py-6" />
        ) : (
          <ul className="flex flex-col">
            {polygons.map(p => (
              <li key={p.id}>
                <AreaRow
                  shape={p}
                  selected={p.id === selectedPolygon}
                  watched={!!watched?.has(p.id)}
                  onSelect={() => select(p)}
                  onToggleWatch={onToggleWatch ? () => onToggleWatch(p.id) : undefined}
                  onRename={name => onRenamePolygon(p.id, name)}
                  onDelete={() => remove(p)}
                  onShow={() => show(p)}
                />
              </li>
            ))}
          </ul>
        )}
      </PanelSection>

      {selected && (
        <>
          <AoiContents shape={selected} data={data} onLocateEntity={onLocateEntity} />
          {onToggleWatch && selected.kind !== 'line' && (
            <WatchLog watched={!!watched?.has(selected.id)} onToggle={() => onToggleWatch(selected.id)}
              events={watchEvents.filter(e => e.aoiId === selected.id)} />
          )}
          {/* The outline stays on the map, so its licence's credit stays with it. */}
          {selected.meta?.boundary?.source && (
            <p className="mt-6 text-meta text-ink-3">Outline from {selected.meta.boundary.source}</p>
          )}
        </>
      )}
    </Panel>
  );
}
