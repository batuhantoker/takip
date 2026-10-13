'use client';

import { useEffect, useRef } from 'react';
import { useRings } from '@/components/map/inspect/rings';
import { useWindows } from '@/components/map/windows';
import { getArea } from '@/components/map/windows/map-area';
import type { MapRef } from '@/components/map/types';
import { globeCamera, inFrontOfGlobe } from '@/lib/map/globe-occlusion';

/** Stops short of the selection ring around the camera. */
const RING = 14;

/**
 * A thin line from each camera window to the spot it shows. Redrawn every frame while a
 * camera window is open, so it keeps up with a pan, a zoom or a window being dragged.
 */
export function CameraLeaders({ mapRef }: { mapRef: MapRef }) {
  const rings = useRings();
  const { list } = useWindows();
  const cams = list.filter(w => w.kind === 'camera' && rings[w.id]).sort((a, b) => a.z - b.z);
  const svg = useRef<SVGSVGElement>(null);
  const key = cams.map(w => `${w.id}@${rings[w.id].lat},${rings[w.id].lng}`).join('|');

  useEffect(() => {
    const map = mapRef.current;
    const el = svg.current;
    if (!map || !el || !key) return;
    const targets = key.split('|').map(s => {
      const [id, at] = s.split('@');
      const [lat, lng] = at.split(',').map(Number);
      return { id, lat, lng };
    });
    let frame = 0;
    const draw = () => {
      frame = requestAnimationFrame(draw);
      const canvas = map.getCanvas().getBoundingClientRect();
      const area = getArea();
      const globe = JSON.stringify(map.getProjection()?.type ?? '').includes('globe');
      const c = map.getCenter();
      const eye = globe ? globeCamera({ lng: c.lng, lat: c.lat, zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing(), fovDeg: map.getVerticalFieldOfView(), heightPx: canvas.height }) : null;
      const lines = el.querySelectorAll('line');
      targets.forEach((t, i) => {
        const line = lines[i];
        const win = document.querySelector(`[data-window="${CSS.escape(t.id)}"]`);
        if (!line) return;
        const hide = () => line.setAttribute('visibility', 'hidden');
        if (!win || (eye && !inFrontOfGlobe({ lng: t.lng, lat: t.lat, radius: 1 }, eye))) return hide();
        const p = map.project([t.lng, t.lat]);
        const px = p.x + canvas.left, py = p.y + canvas.top;
        if (px < area.left || px > area.right || py < area.top || py > area.bottom) return hide();
        const r = win.getBoundingClientRect();
        // From the nearest point on the window's edge.
        const sx = Math.max(r.left, Math.min(px, r.right)), sy = Math.max(r.top, Math.min(py, r.bottom));
        const d = Math.hypot(px - sx, py - sy);
        if (d < RING + 8) return hide();
        line.setAttribute('x1', String(sx));
        line.setAttribute('y1', String(sy));
        line.setAttribute('x2', String(px - ((px - sx) / d) * RING));
        line.setAttribute('y2', String(py - ((py - sy) / d) * RING));
        line.setAttribute('visibility', 'visible');
      });
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [mapRef, key]);

  if (!cams.length) return null;
  return (
    // Under the windows, over the map and its controls.
    <svg ref={svg} aria-hidden className="pointer-events-none fixed inset-0 z-[349] size-full">
      {cams.map((w, i) => (
        <line key={w.id} visibility="hidden" stroke="var(--ink-2)" strokeWidth={1} strokeLinecap="round"
          strokeOpacity={i === cams.length - 1 ? 0.75 : 0.4} />
      ))}
    </svg>
  );
}
