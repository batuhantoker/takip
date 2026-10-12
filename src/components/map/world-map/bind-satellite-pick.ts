import type * as maplibregl from 'maplibre-gl';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { SatelliteDetail } from '@/components/map/satellite-card';
import { satColorFor, type MapPalette } from '@/lib/map-palette';
import type { OiGlobe } from '@/lib/oi/globe';
import { parseColor } from '@/lib/satellite-layer';
import { hitsClickableLayer } from './clickable-layers';
import type { SatelliteLayer, SatelliteRow } from './types';

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
  clearSat: () => void;
}

export function bindSatellitePick(map: maplibregl.Map, { satLayerRef, oiGlobeRef, satRowsRef, satPickedRef, satSelectedIdRef, satEpochRef, popupRef, paletteRef, setSelectedSat, clearSat }: SatellitePickArgs) {
  // ── Satellites (SatNOGS powered) ──
  // Satellites are picked on the GPU: the pick pass runs the same vertex
  // shader as the visible one, so the target is always exactly where the
  // marker was drawn — including its altitude. A ground-projected hit test
  // would put the target under the satellite instead of on it.
  map.on('click', e => {
    const layer = satLayerRef.current;
    if (!layer) return;
    // Defer to any layer that has its own click handler, so a camera or an
    // aircraft under the cursor is not stolen by a satellite behind it.
    if (hitsClickableLayer(map, e.point)) return;
    // An OI arc or point is picked on the GPU too, and it is in front: the click is OI's.
    if (oiGlobeRef.current?.hit(e.point)) return;
    const idx = layer.pick(e.point.x, e.point.y);
    const p = idx == null ? null : satRowsRef.current[idx];
    // Clicking past every satellite is how a selection is dismissed, so an
    // empty click has to clear the ring and the track rather than leave them
    // lit over nothing.
    if (idx == null || !p) { clearSat(); return; }

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
      const over = layer.pick(e.point.x, e.point.y) != null;
      if (over) canvas.style.cursor = 'pointer';
      else if (canvas.style.cursor === 'pointer') canvas.style.cursor = '';
    });
  });

  return () => cancelAnimationFrame(hoverFrame);
}
