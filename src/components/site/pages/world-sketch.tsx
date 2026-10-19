import { WORLD_LAND_PATH } from '@/lib/platform/site/world-land.generated';
import type { MapView } from '@/lib/platform/site/map-link';

/** The world's land in one path, with places marked: the stand-in before a page has a picture, and the spot thumbnails. */
export function WorldSketch({ points = [], focus, className = '' }: { points?: MapView[]; focus?: MapView; className?: string }) {
  // A spot's thumbnail centres on it, a little zoomed; the full sketch shows the whole world but the poles.
  const box = focus
    ? (() => {
        const w = Math.max(30, 360 / 2 ** Math.max(0, focus.zoom - 2.5));
        const x = Math.min(360 - w, Math.max(0, focus.lon + 180 - w / 2));
        const y = Math.min(180 - w / 2, Math.max(0, 90 - focus.lat - w / 4));
        return `${x} ${y} ${w} ${w / 2}`;
      })()
    : '0 8 360 150';
  return (
    <svg viewBox={box} preserveAspectRatio="xMidYMid slice" aria-hidden className={`block size-full ${className}`}>
      <rect x="0" y="0" width="360" height="180" className="fill-surface-1" />
      <path d={WORLD_LAND_PATH} className="fill-surface-3" />
      {[...points, ...(focus ? [focus] : [])].map(p => (
        <g key={`${p.lat},${p.lon}`}>
          <circle cx={p.lon + 180} cy={90 - p.lat} r={focus ? 1.6 : 2.4} className="fill-accent/25" />
          <circle cx={p.lon + 180} cy={90 - p.lat} r={focus ? 0.7 : 1.1} className="fill-accent" />
        </g>
      ))}
    </svg>
  );
}
