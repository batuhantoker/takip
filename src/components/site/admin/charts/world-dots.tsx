'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Globe, Maximize2, Minus, Plus } from 'lucide-react';
import { NEUTRAL } from '@/components/site/admin/analytics/lib/series';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { Modal } from '@/components/ui/modal';
import { Tooltip } from '@/components/ui/tooltip';
import { WORLD_LAND_PATH } from '@/lib/platform/site/world-land.generated';
import { MAX_ZOOM, usePanZoom } from './hooks/use-pan-zoom';
import { loadCountryPath } from './lib/country-path';
import { placeLabels } from './lib/dot-labels';

/**
 * `title` names the dot in the readout instead of its coordinates; `label`, a shorter name written beside it once
 * zoomed in (the title otherwise); `color` overrides the neutral ink.
 */
export type WorldPoint = { latitude: number; longitude: number; value: number; title?: string; label?: string; color?: string };

const W = 720;
const H = 360;
const LONS = [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150];
const LATS = [-60, -30, 0, 30, 60];
const x = (lon: number) => ((lon + 180) / 360) * W;
const y = (lat: number) => ((90 - lat) / 180) * H;
/** Screen pixels per viewBox unit from which dots get names. */
const NAMES_FROM = 1.5;

const coord = (lat: number, lon: number) =>
  `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`;

/**
 * Dots on an equirectangular world, area in proportion to the value, over Natural Earth's land and a faint graticule:
 * no basemap, so it loads nothing until zoomed. Zooming swaps in country outlines and names the dots that have room;
 * the expand button opens the same map large. The readout line above names the dot under the pointer (the biggest
 * one otherwise).
 */
export function WorldDots({ points, label, format, expanded = false }: {
  points: WorldPoint[]; label: string; format: (n: number) => string; expanded?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const { ref, view, width, viewBox, handlers, zoomIn, zoomOut, reset } = usePanZoom(W, H);
  const { k } = view;
  const borders = useCountryPath(expanded || k > 1);
  const max = Math.max(1, ...points.map(p => p.value));
  // Biggest first, so small dots draw on top and stay reachable.
  const dots = points.map((p, i) => ({ ...p, i, r: 2.5 + 9 * Math.sqrt(p.value / max) })).sort((a, b) => b.r - a.r);
  const biggest = dots[0] ?? null;
  const focus = hover != null ? dots.find(d => d.i === hover) ?? null : biggest;

  const scale = width / W;
  const px = scale * k;
  const names = px >= NAMES_FROM
    ? placeLabels(dots.map(d => ({
      x: (x(d.longitude) - view.x) * px, y: (y(d.latitude) - view.y) * px, r: d.r * scale, text: d.label ?? d.title ?? '',
    })), width, width * (H / W))
    : [];

  return (
    // Large, it still fits the dialog's height.
    <div className={cx('flex flex-col gap-2', expanded && 'mx-auto')} style={expanded ? { width: 'min(100%, calc((88vh - 9rem) * 2))' } : undefined}>
      <p className="h-4 text-[12px] text-ink-2" aria-live="polite">
        {focus && (
          <>
            <span className="text-ink-3">{hover == null ? 'Most: ' : ''}{focus.title ?? coord(focus.latitude, focus.longitude)} · </span>
            <span className="font-mono tabular-nums text-ink-1">{format(focus.value)}</span>
          </>
        )}
      </p>
      <div className="relative overflow-hidden rounded-[6px] border border-line">
        <svg ref={ref} viewBox={viewBox} role="img" aria-label={label} {...handlers}
          onPointerLeave={() => setHover(null)}
          className={cx('block h-auto w-full select-none', k > 1 && 'cursor-grab active:cursor-grabbing')}
          // A phone still scrolls the page past an unzoomed map.
          style={{ touchAction: expanded || k > 1 ? 'none' : 'pan-y' }}>
          {LONS.map(lon => <line key={`m${lon}`} x1={x(lon)} x2={x(lon)} y1={0} y2={H} vectorEffect="non-scaling-stroke"
            stroke={lon === 0 ? 'var(--line-strong)' : 'var(--line)'} />)}
          {LATS.map(lat => <line key={`p${lat}`} x1={0} x2={W} y1={y(lat)} y2={y(lat)} vectorEffect="non-scaling-stroke"
            stroke={lat === 0 ? 'var(--line-strong)' : 'var(--line)'} />)}
          {/* Both land paths are one unit per degree (360 × 180). */}
          {borders
            ? <path d={borders} transform={`scale(${W / 360} ${H / 180})`} className="fill-surface-3" stroke="var(--line-strong)"
              strokeWidth={0.75} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            : <path d={WORLD_LAND_PATH} transform={`scale(${W / 360} ${H / 180})`} className="fill-surface-3" />}
          {/* Dots keep their on-screen size as the map zooms, so a crowded region spreads out instead of growing. */}
          {dots.map(d => (
            <g key={d.i} onPointerEnter={() => setHover(d.i)}>
              <circle cx={x(d.longitude)} cy={y(d.latitude)} r={d.r / k} fill={d.color ?? NEUTRAL} fillOpacity={hover === d.i ? 1 : 0.8}
                stroke="var(--surface-1)" strokeWidth={2 / k} />
              {/* A hit target bigger than the mark. */}
              <circle cx={x(d.longitude)} cy={y(d.latitude)} r={(d.r + 5) / k} fill="transparent" />
            </g>
          ))}
          {names.map(n => (
            <text key={dots[n.index].i} x={view.x + n.x / px} y={view.y + n.y / px} textAnchor={n.anchor} dominantBaseline="central"
              fontSize={11 / px} className="pointer-events-none fill-ink-2" stroke="var(--surface-1)" strokeWidth={3 / px}
              strokeLinejoin="round" paintOrder="stroke">
              {dots[n.index].label ?? dots[n.index].title}
            </text>
          ))}
        </svg>
        <div className="absolute right-2 bottom-2 flex flex-col divide-y divide-line overflow-hidden rounded-[8px] border border-line bg-surface-1/90 shadow-float">
          {!expanded && <MapButton label="Open larger" onClick={() => setOpen(true)}><Maximize2 aria-hidden className="size-3.5" /></MapButton>}
          <MapButton label="Zoom in (or scroll)" onClick={zoomIn} disabled={k >= MAX_ZOOM}>
            <Plus aria-hidden className="size-4" strokeWidth={1.75} />
          </MapButton>
          <MapButton label="Zoom out" onClick={zoomOut} disabled={k <= 1}><Minus aria-hidden className="size-4" strokeWidth={1.75} /></MapButton>
          {k > 1 && <MapButton label="Whole world" onClick={reset}><Globe aria-hidden className="size-3.5" /></MapButton>}
        </div>
      </div>
      {!expanded && (
        <Modal open={open} onClose={() => setOpen(false)} title={label} className="max-w-6xl">
          <WorldDots points={points} label={label} format={format} expanded />
        </Modal>
      )}
    </div>
  );
}

function MapButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <Tooltip label={label} side="left">
      <button type="button" aria-label={label} onClick={onClick} disabled={disabled}
        className={cx(
          'flex size-7 items-center justify-center text-ink-2 hover:bg-surface-2 hover:text-ink-1 disabled:cursor-not-allowed disabled:opacity-35',
          FOCUS_RING, 'focus-visible:-outline-offset-2', TRANSITION,
        )}>
        {children}
      </button>
    </Tooltip>
  );
}

/** Country outlines once the map is zoomed or open large; the coarse land stays if the file can't be had. */
function useCountryPath(enabled: boolean) {
  const [path, setPath] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled || path) return;
    let live = true;
    loadCountryPath().then(p => { if (live) setPath(p); }, () => {});
    return () => { live = false; };
  }, [enabled, path]);
  return path;
}
