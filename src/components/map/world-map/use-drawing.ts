'use client';

import { useEffect, useRef, type RefObject } from 'react';
import type * as maplibregl from 'maplibre-gl';
import { buildGeometry, closeRing, drawReducer, initialDrawState, measure, type DrawAction, type DrawState } from '@/lib/draw';
import type { MapRef, WorldMapProps } from './types';

interface DrawingArgs {
  mapRef: MapRef;
  mapReady: boolean;
  drawMode: WorldMapProps['drawMode'];
  drawCommand: WorldMapProps['drawCommand'];
  onDrawComplete: WorldMapProps['onDrawComplete'];
  onDrawProgress: WorldMapProps['onDrawProgress'];
  onDrawCancel: WorldMapProps['onDrawCancel'];
  drawingCoordsRef: RefObject<number[][]>;
}

export function useDrawing({ mapRef, mapReady, drawMode, drawCommand, onDrawComplete, onDrawProgress, onDrawCancel, drawingCoordsRef }: DrawingArgs) {
  const drawCbRef = useRef({ onDrawComplete, onDrawProgress, onDrawCancel });
  /** Set by the drawing effect so on-screen buttons can dispatch into it. */
  const drawApplyRef = useRef<((a: DrawAction) => void) | null>(null);
  drawCbRef.current = { onDrawComplete, onDrawProgress, onDrawCancel };

  // ── DRAWING MODE ──
  // A four-mode state machine over one set of map handlers.
  //
  // Every mode collects points; what differs is how many are needed and what
  // geometry they produce. Rectangle and circle are two-click shapes, so the
  // cursor stands in for their second point until it is committed — which is
  // what makes the preview and the final shape come from the same code path
  // instead of two that can disagree.
  //
  // Escape cancels, Backspace removes the last vertex, Enter or a double click
  // finishes. Drawing without an undo is the difference between a tool and a
  // demo: a misplaced vertex twenty clicks in should not cost the whole shape.
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;

    const SRC = 'draw-temp-source';
    const IDS = ['draw-fill-temp', 'draw-line-temp', 'draw-points-temp'];

    const teardown = () => {
      IDS.forEach(id => { if (map.getLayer(id)) map.removeLayer(id); });
      if (map.getSource(SRC)) map.removeSource(SRC);
      drawingCoordsRef.current = [];
      map.getCanvas().style.cursor = '';
      map.doubleClickZoom.enable();
    };

    if (!drawMode) {
      teardown();
      drawCbRef.current.onDrawProgress?.(null);
      return;
    }
    // useRegionPick owns region mode, including its progress.
    if (drawMode === 'region') {
      teardown();
      return;
    }

    map.doubleClickZoom.disable();
    map.getCanvas().style.cursor = 'crosshair';
    drawingCoordsRef.current = [];

    if (!map.getSource(SRC)) {
      map.addSource(SRC, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: 'draw-fill-temp', type: 'fill', source: SRC,
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: { 'fill-color': '#00E5FF', 'fill-opacity': 0.12 },
      });
      map.addLayer({
        id: 'draw-line-temp', type: 'line', source: SRC,
        filter: ['match', ['geometry-type'], ['LineString', 'Polygon'], true, false],
        paint: { 'line-color': '#00E5FF', 'line-width': 2, 'line-dasharray': [3, 2] },
      });
      map.addLayer({
        id: 'draw-points-temp', type: 'circle', source: SRC,
        filter: ['==', ['geometry-type'], 'MultiPoint'],
        paint: { 'circle-color': '#00E5FF', 'circle-radius': 4, 'circle-stroke-width': 1.5, 'circle-stroke-color': '#04040A' },
      });
    }

    // Declared before paint(), which closes over it. Leaving it below would
    // work only while no call happens in between — a temporal-dead-zone crash
    // waiting for someone to add one.
    let state: DrawState = initialDrawState(drawMode);

    /** Redraw the preview from committed points plus an optional cursor point. */
    const paint = (cursor?: [number, number]) => {
      const committed = state.points;
      const pts = cursor ? [...committed, cursor] : committed;
      const src = map.getSource(SRC) as maplibregl.GeoJSONSource;
      if (!src) return;

      drawCbRef.current.onDrawProgress?.(pts.length ? measure(drawMode, pts) : null);

      if (pts.length === 0) {
        src.setData({ type: 'FeatureCollection', features: [] });
        return;
      }

      const features: any[] = [
        { type: 'Feature', properties: {}, geometry: { type: 'MultiPoint', coordinates: committed } },
      ];

      const geom = buildGeometry(drawMode, pts);
      if (drawMode === 'line') {
        if (pts.length > 1) {
          features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: geom } });
        }
      } else if (geom.length >= 3) {
        // Show the enclosed area as it will be, not just its outline.
        features.push({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [closeRing(geom)] } });
      } else if (geom.length === 2) {
        features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: geom } });
      }

      src.setData({ type: 'FeatureCollection', features });
    };

    // The interaction lives in drawReducer, which is unit tested. This is the
    // adapter: map events in, reducer out, preview repainted.
    const apply = (action: DrawAction) => {
      const t = drawReducer(state, action);
      state = t.state;
      drawingCoordsRef.current = state.points;
      if (t.result) drawCbRef.current.onDrawComplete?.(t.result);
      if (t.cancelled) drawCbRef.current.onDrawCancel?.();
      paint();
    };

    let dblGuard = false;

    const onClick = (e: any) => {
      if (dblGuard) return;
      apply({ type: 'click', at: [e.lngLat.lng, e.lngLat.lat] });
    };

    const onMove = (e: any) => {
      if (state.points.length === 0) return;
      paint([e.lngLat.lng, e.lngLat.lat]);
    };

    const onDblClick = (e: any) => {
      e.preventDefault();
      dblGuard = true;
      setTimeout(() => { dblGuard = false; }, 300);
      apply({ type: 'dblclick' });
    };

    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') { ev.preventDefault(); apply({ type: 'cancel' }); }
      else if (ev.key === 'Backspace' || ev.key === 'Delete') { ev.preventDefault(); apply({ type: 'undo' }); }
      else if (ev.key === 'Enter') { ev.preventDefault(); apply({ type: 'finish' }); }
    };
    drawApplyRef.current = apply;

    map.on('click', onClick);
    map.on('mousemove', onMove);
    map.on('dblclick', onDblClick);
    window.addEventListener('keydown', onKey);

    return () => {
      map.off('click', onClick);
      map.off('mousemove', onMove);
      map.off('dblclick', onDblClick);
      window.removeEventListener('keydown', onKey);
      drawApplyRef.current = null;
      teardown();
    };
  }, [mapReady, drawMode, mapRef, drawingCoordsRef]);

  // Buttons dispatch into the same reducer the map events use, so a shape
  // finished by clicking "Finish" is identical to one finished by Enter.
  const lastCmdSeq = useRef(-1);
  useEffect(() => {
    if (!drawCommand || drawCommand.seq === lastCmdSeq.current) return;
    lastCmdSeq.current = drawCommand.seq;
    drawApplyRef.current?.({ type: drawCommand.action } as DrawAction);
  }, [drawCommand]);
}
