import type * as maplibregl from 'maplibre-gl';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { SatelliteDetail } from '@/components/map/inspect/cards/satellite-inspect';
import { satColorFor, type MapPalette } from '@/lib/map/palette';
import type { OiGlobe } from '@/lib/oi/globe';
import { globeCamera, inFrontOfGlobe } from '@/lib/map/globe-occlusion';
import { displayElevation, parseColor } from '@/lib/satellites/layer';
import { touchSlop } from '@/lib/map/touch-targets';
import { hitsClickableLayer } from '@/lib/map/clickable-layers';
import type { SatelliteLayer, SatelliteRow } from '@/components/map/types';

interface SatellitePickArgs {
  satLayerRef: RefObject<SatelliteLayer | null>;
  oiGlobeRef: RefObject<OiGlobe | null>;
  satRowsRef: RefObject<SatelliteRow[]>;
  satPickedRef: RefObject<number | null>;
  satSelectedIdRef: RefObject<string | null>;
  satEpochRef: RefObject<number | null>;
  popupRef: RefObject<maplibregl.Popup | null>;
  paletteRef: RefObject<MapPalette>;
  setSelectedSat: Dispatch<SetStateAction<SatelliteDetail | null>>;
  /** A click on open map, with nothing under it. */
  onEmpty: () => void;
  /** The satellite under the pointer after each hover pick, for the hover tooltip. */
  onHover?: (row: SatelliteRow | null) => void;
}

const EARTH_M = 6_371_000;

/**
 * The pick buffer has no globe in it, so a satellite behind the Earth still answers a click
 * on the near side. Only one the camera can actually see counts.
 */
function visibleTo(map: maplibregl.Map, rows: SatelliteRow[]) {
  if (!JSON.stringify(map.getProjection()?.type ?? '').includes('globe')) return () => true;
  const c = map.getCenter();
  const camera = globeCamera({
    lng: c.lng, lat: c.lat, zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing(),
    fovDeg: map.getVerticalFieldOfView(), heightPx: map.getCanvas().clientHeight,
  });
  return (index: number) => {
    const row = rows[index];
    return !!row && inFrontOfGlobe({ lng: row.lng, lat: row.lat, radius: 1 + displayElevation(row.alt) / EARTH_M }, camera);
  };
}

export function bindSatellitePick(map: maplibregl.Map, { satLayerRef, oiGlobeRef, satRowsRef, satPickedRef, satSelectedIdRef, satEpochRef, popupRef, paletteRef, setSelectedSat, onEmpty, onHover }: SatellitePickArgs) {
  // ── Satellites (SatNOGS powered) ──
  // Satellites are picked on the GPU: the pick pass runs the same vertex
  // shader as the visible one, so the target is always exactly where the
  // marker was drawn — including its altitude. A ground-projected hit test
  // would put the target under the satellite instead of on it.
  map.on('click', e => {
    const layer = satLayerRef.current;
    // Defer to any layer that has its own click handler, so a camera or an
    // aircraft under the cursor is not stolen by a satellite behind it.
    if (hitsClickableLayer(map, e.point, touchSlop(e))) return;
    // An OI arc or point is picked on the GPU too, and it is in front: the click is OI's.
    if (oiGlobeRef.current?.hit(e.point)) return;
    const idx = layer ? layer.pick(e.point.x, e.point.y, visibleTo(map, satRowsRef.current)) : null;
    const p = idx == null ? null : satRowsRef.current[idx];
    // Open map; with satellites off this still runs, so the map hears every empty click.
    if (idx == null || !p || !layer) { onEmpty(); return; }

    // The readout is a panel, not a MapLibre popup: a popup can only anchor
    // to a ground coordinate, and these markers are drawn at altitude. Any
    // other layer's popup is still welcome to the screen, but not on top of
    // this selection.
    popupRef.current?.remove();
    layer.setOrbit(null);
    satPickedRef.current = idx;
    satSelectedIdRef.current = p.noradId ?? null;
    layer.setSelected(idx);
    setSelectedSat({ ...p, periodMinutes: null, track: p.noradId ? 'loading' : 'unavailable' });

    // Draw the selected satellite's orbit. Fetched per click rather than
    // bundled with the catalogue: that payload is already megabytes, and an
    // operator looks at one orbit at a time.
    if (p.noradId) {
      const wanted = p.noradId;
      // A slower reply for a satellite the operator has already moved on
      // from must not draw over the one they are looking at now.
      const stale = () => satSelectedIdRef.current !== wanted;
      const mark = (track: SatelliteDetail['track'], periodMinutes: number | null = null) =>
        setSelectedSat(prev => (prev && prev.noradId === wanted ? { ...prev, track, periodMinutes } : prev));
      const at = satEpochRef.current;
      fetch(`/api/satellites/orbit?id=${encodeURIComponent(wanted)}${at ? `&t=${at}` : ''}`)
        .then(r => (r.ok ? r.json() : null))
        .then(d => {
          if (stale()) return;
          if (!d?.segments?.length) { mark('unavailable'); return; }
          layer.setOrbit(
            d.segments.map((seg: number[][]) => seg.map(([lng, lat, altKm]) => ({ lng, lat, altKm }))),
            parseColor(satColorFor(p.category, p.color, paletteRef.current)),
          );
          mark('ready', typeof d.periodMinutes === 'number' ? d.periodMinutes : null);
        })
        // No track is fine; the satellite still shows — but the readout says so
        // rather than sitting on 'plotting' forever.
        .catch(() => { if (!stale()) mark('unavailable'); });
    }
  });

  // The cursor should say a satellite is clickable, like every other layer.
  // Picking re-renders the entire catalogue and reads back from the GPU.
  // Keep that work out of camera gestures and limit hover checks to 10/sec.
  // Click selection above remains immediate and full precision.
  let hoverFrame = 0;
  let lastHoverPick = -Infinity;
  // Only the pointer this pick set is this pick's to clear; a ship or camera sets its own.
  let ownPointer = false;
  map.on('mousemove', e => {
    const layer = satLayerRef.current;
    if (!layer || hoverFrame || map.isMoving() || performance.now() - lastHoverPick < 100) return;
    hoverFrame = requestAnimationFrame(() => {
      hoverFrame = 0;
      if (map.isMoving()) return;
      const canvas = map.getCanvas();
      // Never fight another layer that has already claimed the cursor.
      if (canvas.style.cursor && canvas.style.cursor !== 'pointer') return;
      lastHoverPick = performance.now();
      const idx = layer.pick(e.point.x, e.point.y, visibleTo(map, satRowsRef.current));
      onHover?.(idx == null ? null : satRowsRef.current[idx] ?? null);
      if (idx != null) {
        if (!canvas.style.cursor) ownPointer = true;
        canvas.style.cursor = 'pointer';
      } else if (ownPointer) {
        ownPointer = false;
        if (canvas.style.cursor === 'pointer' && !hitsClickableLayer(map, e.point)) canvas.style.cursor = '';
      }
    });
  });

  return () => cancelAnimationFrame(hoverFrame);
}
