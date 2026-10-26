import type { MapView } from '@/lib/platform/site/map-link';
import { WORLD_LAND_PATH } from '@/lib/platform/site/world-land.generated';

const LAND = 'spot-land';

/** The world's land once on the page, for every spot thumbnail to draw by reference: inline, each would carry all 44 KB of it. */
export function SpotLand() {
  return (
    <svg aria-hidden width="0" height="0" className="absolute">
      <defs><path id={LAND} d={WORLD_LAND_PATH} /></defs>
    </svg>
  );
}

/** A spot's thumbnail, WorldSketch's focused view drawn from SpotLand: the land around the spot, a little zoomed, the spot marked. */
export function SpotSketch({ view }: { view: MapView }) {
  const w = Math.max(30, 360 / 2 ** Math.max(0, view.zoom - 2.5));
  const x = Math.min(360 - w, Math.max(0, view.lon + 180 - w / 2));
  const y = Math.min(180 - w / 2, Math.max(0, 90 - view.lat - w / 4));
  return (
    <svg viewBox={`${x} ${y} ${w} ${w / 2}`} preserveAspectRatio="xMidYMid slice" aria-hidden className="block size-full">
      <rect x="0" y="0" width="360" height="180" className="fill-surface-1" />
      <use href={`#${LAND}`} className="fill-surface-3" />
      <circle cx={view.lon + 180} cy={90 - view.lat} r={1.6} className="fill-accent/25" />
      <circle cx={view.lon + 180} cy={90 - view.lat} r={0.7} className="fill-accent" />
    </svg>
  );
}
