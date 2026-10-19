'use client';

import { useMemo } from 'react';
import { useT } from '@/components/ui/use-t';

interface ScaleBarProps {
  zoom: number;
  latitude: number;
}

const SCALE_STEPS = [5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01, 0.005, 0.002, 0.001, 0.0005, 0.0002, 0.0001, 0.00005, 0.00002, 0.00001];

export function scaleFor(zoom: number, latitude: number): { barWidth: number; label: string } {
  // MapLibre uses a 512px world at zoom zero, not the 256px raster convention.
  // This is an approximate centre scale for pitched/globe views.
  const safeZoom = Number.isFinite(zoom) ? Math.max(0, Math.min(24, zoom)) : 0;
  const safeLatitude = Number.isFinite(latitude) ? Math.max(-85.051129, Math.min(85.051129, latitude)) : 0;
  const metersPerPx = (40075016.686 / 512) * Math.cos(safeLatitude * Math.PI / 180) / 2 ** safeZoom;
  const maxWidth = 100; // Max bar width in pixels
  const maxMeters = metersPerPx * maxWidth;
  const maxKm = maxMeters / 1000;

  // Fall back to the smallest step: past ~z16 nothing in the table fits, and
  // leaving it on the 5000 km head blew the bar out to millions of pixels.
  let bestStep = SCALE_STEPS[SCALE_STEPS.length - 1];
  for (const step of SCALE_STEPS) {
    if (step <= maxKm) { bestStep = step; break; }
  }

  const barWidth = Math.round((bestStep * 1000) / metersPerPx);
  const label = bestStep >= 1 ? `${bestStep} km` : bestStep >= 0.001 ? `${Math.round(bestStep * 1000)} m` : `${Math.round(bestStep * 100000)} cm`;

  return { barWidth, label };
}

/** How far a stretch of the map is at its centre: a hairline with end ticks, and the distance beside it. */
export default function ScaleBar({ zoom, latitude }: ScaleBarProps) {
  const t = useT();
  const { barWidth, label } = useMemo(() => scaleFor(zoom, latitude), [zoom, latitude]);
  return (
    <div className="flex items-end gap-1.5 select-none" role="img" aria-label={t('Scale at the map centre: {distance}', { distance: label })}>
      <span aria-hidden className="h-1.5 border-x border-b border-ink-3" style={{ width: barWidth }} />
      <span className="font-mono text-meta leading-none text-ink-3 tabular-nums [text-shadow:0_0_3px_var(--surface-0)]">{label}</span>
    </div>
  );
}
