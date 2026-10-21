'use client';

import { useState } from 'react';
import { NEUTRAL } from '@/components/site/admin/analytics/lib/series';
import { WORLD_LAND_PATH } from '@/lib/platform/site/world-land.generated';

/** `title` names the dot in the readout instead of its coordinates; `color` overrides the neutral ink. */
export type WorldPoint = { latitude: number; longitude: number; value: number; title?: string; color?: string };

const W = 720;
const H = 360;
const LONS = [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150];
const LATS = [-60, -30, 0, 30, 60];
const x = (lon: number) => ((lon + 180) / 360) * W;
const y = (lat: number) => ((90 - lat) / 180) * H;

const coord = (lat: number, lon: number) =>
  `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`;

/**
 * Dots on an equirectangular world, area in proportion to the value, over Natural Earth's land and a faint graticule:
 * no basemap, so it loads nothing. The readout line above names the dot under the pointer (the biggest one otherwise).
 */
export function WorldDots({ points, label, format }: { points: WorldPoint[]; label: string; format: (n: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...points.map(p => p.value));
  // Biggest first, so small dots draw on top and stay reachable.
  const dots = points.map((p, i) => ({ ...p, i, r: 2.5 + 9 * Math.sqrt(p.value / max) })).sort((a, b) => b.r - a.r);
  const biggest = dots[0] ?? null;
  const focus = hover != null ? dots.find(d => d.i === hover) ?? null : biggest;

  return (
    <div className="flex flex-col gap-2">
      <p className="h-4 text-[12px] text-ink-2" aria-live="polite">
        {focus && (
          <>
            <span className="text-ink-3">{hover == null ? 'Most: ' : ''}{focus.title ?? coord(focus.latitude, focus.longitude)} · </span>
            <span className="font-mono tabular-nums text-ink-1">{format(focus.value)}</span>
          </>
        )}
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="h-auto w-full" onPointerLeave={() => setHover(null)}>
        <rect x={0} y={0} width={W} height={H} rx={6} fill="none" stroke="var(--line)" />
        {LONS.map(lon => <line key={`m${lon}`} x1={x(lon)} x2={x(lon)} y1={0} y2={H} stroke={lon === 0 ? 'var(--line-strong)' : 'var(--line)'} />)}
        {LATS.map(lat => <line key={`p${lat}`} x1={0} x2={W} y1={y(lat)} y2={y(lat)} stroke={lat === 0 ? 'var(--line-strong)' : 'var(--line)'} />)}
        {/* The land path is one unit per degree (360 × 180). */}
        <path d={WORLD_LAND_PATH} transform={`scale(${W / 360} ${H / 180})`} className="fill-surface-3" />
        {dots.map(d => (
          <g key={d.i} onPointerEnter={() => setHover(d.i)}>
            <circle cx={x(d.longitude)} cy={y(d.latitude)} r={d.r} fill={d.color ?? NEUTRAL} fillOpacity={hover === d.i ? 1 : 0.8} stroke="var(--surface-1)" strokeWidth={2} />
            {/* A hit target bigger than the mark. */}
            <circle cx={x(d.longitude)} cy={y(d.latitude)} r={d.r + 5} fill="transparent" />
          </g>
        ))}
      </svg>
    </div>
  );
}
