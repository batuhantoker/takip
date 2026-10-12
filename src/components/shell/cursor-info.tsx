'use client';

import type { RefObject } from 'react';
import type { MapView } from './dashboard-types';

/** Where the pointer is: the status bar's left end. The coordinates are written straight into the ref, off React. */
export default function CursorInfo({ coordsDisplayRef, locationLabel, mapView }: {
  coordsDisplayRef: RefObject<HTMLDivElement | null>;
  locationLabel: string;
  mapView: MapView;
}) {
  return (
    <div className="h-full flex items-center gap-3 px-3 text-[10.5px] text-[var(--text-muted)] border-r border-white/[0.05] min-w-0">
      <div ref={coordsDisplayRef} title="Pointer coordinates" className="font-mono tabular-nums text-[var(--text-secondary)] w-[132px] shrink-0">—</div>
      <span title="Place under the pointer" className="truncate max-w-[220px] text-[var(--text-secondary)]">{locationLabel || 'Hover the map'}</span>
      <span title="Zoom level" className="shrink-0">Zoom <span className="font-mono tabular-nums text-[var(--text-secondary)]">{mapView.zoom.toFixed(1)}</span></span>
    </div>
  );
}
