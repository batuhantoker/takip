import { useEffect, useRef } from 'react';
import type * as maplibregl from 'maplibre-gl';
import { floorZoom, type GlobeLink, type GlobeView } from '@/lib/space/globe-match';
import type { MapRef } from '@/components/map/types';

/**
 * Zooming out past the whole globe leaves the map for space: once the map is
 * at its minimum zoom, further wheel or trackpad-pinch out builds up until it
 * is plainly deliberate, then hands over. The way back, space reads and moves
 * the map through a GlobeLink.
 */

/** Wheel delta (px) to gather at the floor: one firm notch, so the hand-over follows the wheel. */
const PUSH_PX = 90;
/** Below this zoom the space view is fetched ahead, so the hand-over has nothing to wait for. */
const WARM_ZOOM = 3;
/** A pause this long starts the gathering over. */
const IDLE_MS = 700;
const FLOOR_SLACK = 0.03;

function globeView(map: maplibregl.Map): GlobeView {
  const c = map.getCenter();
  return { lat: c.lat, lng: c.lng, zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing(), height: map.getCanvas().clientHeight, fov: map.getVerticalFieldOfView(), minZoom: map.getMinZoom() };
}

export function useZoomPastGlobe({ mapRef, mapReady, onZoomPastGlobe, onNearGlobe, onGlobeLink }: {
  mapRef: MapRef;
  mapReady: boolean;
  onZoomPastGlobe?: (view: GlobeView) => void;
  onNearGlobe?: () => void;
  onGlobeLink?: (link: GlobeLink | null) => void;
}) {
  const handler = useRef(onZoomPastGlobe);
  const warm = useRef(onNearGlobe);
  const linked = useRef(onGlobeLink);
  useEffect(() => { handler.current = onZoomPastGlobe; warm.current = onNearGlobe; linked.current = onGlobeLink; }, [onZoomPastGlobe, onNearGlobe, onGlobeLink]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    const pose = (to: Parameters<GlobeLink['jump']>[0]) => ({ center: [to.lng, to.lat] as [number, number], zoom: to.zoom, pitch: to.pitch, bearing: to.bearing });
    linked.current?.({
      view: () => globeView(map),
      moving: () => map.isMoving(),
      jump: to => { map.stop(); map.jumpTo(pose(to)); },
      fly: (to, ms) => map.flyTo({ ...pose(to), duration: ms }),
    });
    return () => linked.current?.(null);
  }, [mapRef, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    const el = map.getCanvasContainer();
    let pushed = 0, last = 0, warmed = false;
    const onZoom = () => {
      if (warmed || map.getZoom() > WARM_ZOOM) return;
      warmed = true;
      warm.current?.();
    };
    map.on('zoom', onZoom);
    onZoom();
    const onWheel = (e: WheelEvent) => {
      const now = performance.now();
      if (now - last > IDLE_MS) pushed = 0;
      last = now;
      if (e.deltaY <= 0 || map.getZoom() > floorZoom(map.getMinZoom(), map.getCenter().lat) + FLOOR_SLACK) { pushed = 0; return; }
      const px = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
      pushed += e.ctrlKey ? px * 4 : px;
      if (pushed < PUSH_PX || !handler.current) return;
      pushed = 0;
      handler.current(globeView(map));
    };
    el.addEventListener('wheel', onWheel, { passive: true });
    return () => { el.removeEventListener('wheel', onWheel); map.off('zoom', onZoom); };
  }, [mapRef, mapReady]);
}
