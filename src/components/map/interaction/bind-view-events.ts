import type * as maplibregl from 'maplibre-gl';
import type { WorldMapProps } from '@/components/map/types';

/** Two right-clicks count as one double right-click this close in time… */
const DOUBLE_RIGHT_MS = 500;
/** …and this close on screen, so a second click elsewhere starts afresh. */
const DOUBLE_RIGHT_SLOP_PX = 12;

interface ViewEventHandlers {
  onMouseCoords: WorldMapProps['onMouseCoords'];
  onRightClick: WorldMapProps['onRightClick'];
  onViewStateChange: WorldMapProps['onViewStateChange'];
}

export function bindViewEvents(map: maplibregl.Map, container: HTMLDivElement, { onMouseCoords, onRightClick, onViewStateChange }: ViewEventHandlers) {
  // Events
  let lastMove = 0;
  map.on('mousemove', e => {
    const now = Date.now();
    if (now - lastMove > 100) {
      lastMove = now;
      onMouseCoords?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    }
  });
  /* The region dossier opens on a double right-click: two within
     DOUBLE_RIGHT_MS and a few pixels of each other. A single right-click
     was too easy to make by accident — it opened a panel and set off a
     place lookup and a country's worth of Wikidata requests. A touch
     long-press is already deliberate, so on a phone one still opens it;
     asking for two there would make it all but unreachable. */
  let lastRightClick: { at: number; x: number; y: number } | null = null;
  map.on('contextmenu', e => {
    e.preventDefault();
    const open = () => onRightClick?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    if ((e.originalEvent as PointerEvent).pointerType === 'touch') { open(); return; }

    const now = performance.now();
    const { x, y } = e.point;
    const isSecond = lastRightClick !== null
      && now - lastRightClick.at < DOUBLE_RIGHT_MS
      && Math.hypot(x - lastRightClick.x, y - lastRightClick.y) < DOUBLE_RIGHT_SLOP_PX;
    if (isSecond) {
      lastRightClick = null;
      open();
    } else {
      lastRightClick = { at: now, x, y };
    }
  });
  const reportViewState = () => { const c = map.getCenter(); onViewStateChange?.({ zoom: map.getZoom(), latitude: c.lat }); };
  map.on('load', reportViewState);
  map.on('moveend', reportViewState);
  // Lightweight settled-view diagnostics for camera/terrain regressions.
  const reportCamera = () => {
    const center = map.getCenter();
    container.dataset.mapCamera = JSON.stringify({ zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing(), lat: center.lat, lng: center.lng });
  };
  map.on('load', reportCamera);
  map.on('moveend', reportCamera);
  map.on('idle', reportCamera);
  reportCamera();
}
