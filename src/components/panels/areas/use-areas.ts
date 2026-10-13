'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { toShape, queryArea, type DrawMode, type DrawnShape, type DrawProgress, type DrawResult } from '@/lib/areas/draw';
import { selectInArea } from '@/lib/areas/aoi';
import { diffSweep, appendEvents, type WatchBaseline, type WatchEvent } from '@/lib/areas/watch';
import { STORAGE_KEY, serializeShapes, deserializeShapes, shapesToGeoJSON, downloadFile } from '@/lib/areas/aoi-export';

export type DrawAction = 'undo' | 'finish' | 'cancel';

/**
 * Drawn areas and their tripwires. WorldMap owns the draw interaction and the
 * polygon rendering; this turns a finished ring into a measured, named record,
 * keeps it across reloads, and re-sweeps watched areas on every data refresh.
 */
export function useAreas(dataRef: RefObject<unknown>, dataVersion: number) {
  const [drawMode, setDrawMode] = useState<DrawMode | null>(null);
  const [drawProgress, setDrawProgress] = useState<DrawProgress | null>(null);
  const [drawCommand, setDrawCommand] = useState<{ action: DrawAction; seq: number } | null>(null);
  const [drawnPolygons, setDrawnPolygons] = useState<DrawnShape[]>([]);
  const [selectedPolygon, setSelectedPolygon] = useState<string | null>(null);
  /** Areas whose contents are being watched for arrivals and departures. */
  const [watched, setWatched] = useState<Set<string>>(new Set());
  const [watchEvents, setWatchEvents] = useState<WatchEvent[]>([]);
  const watchBaselines = useRef<Record<string, WatchBaseline>>({});

  const sendDraw = useCallback((action: DrawAction) => {
    setDrawCommand(c => ({ action, seq: (c?.seq ?? 0) + 1 }));
  }, []);
  const stopDrawing = useCallback(() => { setDrawMode(null); setDrawProgress(null); }, []);

  // Work that vanishes on refresh is work the operator will not trust the tool with.
  useEffect(() => {
    try {
      const restored = deserializeShapes(localStorage.getItem(STORAGE_KEY));
      if (restored.length) setDrawnPolygons(restored);
    } catch { /* storage unavailable — start empty */ }
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, serializeShapes(drawnPolygons)); } catch { /* quota or private mode */ }
  }, [drawnPolygons]);

  // Keyed off dataVersion rather than the data so this runs once per refresh, not once per render.
  useEffect(() => {
    if (watched.size === 0) return;
    const now = Date.now();
    const fresh: WatchEvent[] = [];
    for (const shape of drawnPolygons) {
      if (!watched.has(shape.id)) continue;
      const area = queryArea(shape);
      if (!area) continue;
      const report = selectInArea(area, (dataRef.current ?? {}) as Record<string, unknown>);
      const prev = watchBaselines.current[shape.id] ?? null;
      const { baseline, events } = diffSweep(shape.id, report, prev, now);
      watchBaselines.current[shape.id] = baseline;
      fresh.push(...events);
    }
    if (fresh.length) setWatchEvents(log => appendEvents(log, fresh));
  }, [dataVersion, watched, drawnPolygons, dataRef]);

  const toggleWatch = useCallback((id: string) => {
    setWatched(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        // Re-arming starts clean rather than reporting everything that moved while the watch was off.
        delete watchBaselines.current[id];
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleDrawComplete = useCallback((result: DrawResult) => {
    setDrawnPolygons(prev => [toShape(result, prev, prev.length), ...prev]);
    // One shape per arming: staying armed is how the click that dismisses the first makes a second.
    stopDrawing();
  }, [stopDrawing]);

  const exportGeoJSON = useCallback(() => {
    downloadFile(
      `takip-aoi-${new Date().toISOString().slice(0, 10)}.geojson`,
      JSON.stringify(shapesToGeoJSON(drawnPolygons), null, 2),
      'application/geo+json',
    );
  }, [drawnPolygons]);

  return {
    drawMode, setDrawMode, drawProgress, setDrawProgress, drawCommand, sendDraw, stopDrawing,
    drawnPolygons, setDrawnPolygons, selectedPolygon, setSelectedPolygon,
    watched, watchEvents, toggleWatch, handleDrawComplete, exportGeoJSON,
  };
}

export type Areas = ReturnType<typeof useAreas>;
